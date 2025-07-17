import { config } from '../config';
import { ScrapedContent } from '../types';
import OpenAI from 'openai';

/**
 * Classification Result Interface
 */
export interface ClassificationResult {
  id: string;
  isRelevant: boolean;
  confidenceScore: number;
  hasAuctionKeywords: boolean;
  hasTravelKeywords: boolean;
  isNonprofit: boolean;
  reasoning: string;
  keywordMatches: {
    auction: string[];
    travel: string[];
    nonprofit: string[];
  };
  dateRelevance: boolean;
  geographicRelevance: boolean;
  selfConsistencyScore: number;
  modelUsed: string;
  classifiedAt: Date;
  reviewFlag: boolean; // True if needs human review
  error?: string; // Error message if classification failed
}

/**
 * High-Precision Classifier Agent
 * Uses OpenAI o4-mini for reasoning tasks (classification, analysis)
 * Use gpt-4.1-mini for simple, no-reasoning tasks
 */
export class ClassifierAgent {
  private openaiClient: OpenAI;
  private confidenceThreshold: number;
  private classificationPrompts: {
    primary: string;
    consistency: string;
    review: string;
  } = {
    primary: '',
    consistency: '',
    review: ''
  };

  constructor() {
    this.confidenceThreshold = config.precision.confidenceThreshold;
    
    // Initialize OpenAI client
    this.openaiClient = new OpenAI({
      apiKey: config.apis.openai.apiKey,
    });
    
    console.log('🤖 ClassifierAgent initialized with REAL OpenAI API');
    
    this.setupPrompts();
  }

  /**
   * Setup high-precision classification prompts
   */
  private setupPrompts(): void {
    this.classificationPrompts = {
      primary: `
You are a highly precise classifier for nonprofit travel auction events. Your task is to determine if the given content describes a U.S. nonprofit organization running a travel package auction or raffle.

STRICT CRITERIA (ALL must be present for positive classification):
1. AUCTION/RAFFLE: Must mention auction, raffle, bidding, gala fundraiser with bidding component
2. TRAVEL PACKAGE: Must include travel destinations, trips, vacations, cruises, resort stays, or flight packages
3. NONPROFIT: Must be a U.S. nonprofit organization (501c3, charity, foundation, church, school)
4. FUNDRAISING: Must be for charitable/fundraising purposes

EXCLUSIONS (classify as NOT relevant):
- School raffles without travel packages
- Individual travel bookings or commercial travel sites
- For-profit event companies
- International organizations (non-US)
- Completed/past events (unless specifically mentioned as recurring)
- Generic charity information without auction/raffle events

Respond with a JSON object containing:
{
  "isRelevant": boolean,
  "confidenceScore": number (0-1),
  "hasAuctionKeywords": boolean,
  "hasTravelKeywords": boolean,
  "isNonprofit": boolean,
  "reasoning": "detailed explanation of classification decision",
  "keywordMatches": {
    "auction": ["matched auction keywords"],
    "travel": ["matched travel keywords"],
    "nonprofit": ["matched nonprofit keywords"]
  }
}

CONTENT TO ANALYZE:
`,
      consistency: `
Perform a secondary consistency check on this classification. Review the same content with fresh analysis.

Focus on potential false positives:
- Is this definitely a nonprofit travel auction/raffle?
- Are there any red flags that suggest this is not relevant?
- Does the confidence score seem appropriate?

Provide a consistency score (0-1) where 1 means fully consistent with the original classification.
`,
      review: `
Determine if this classification result requires human review based on:
- Borderline confidence score (0.6-0.8)
- Conflicting signals in the content
- Unusual or ambiguous nonprofit status
- Complex event structure

Return true if human review is recommended.
`
    };
  }

  /**
   * Classify scraped content for relevance
   */
  async classifyContent(content: ScrapedContent): Promise<ClassificationResult> {
    console.log(`Classifying content: ${content.url}`);
    
    try {
      // Primary classification
      const primaryResult = await this.performPrimaryClassification(content);
      
      // Self-consistency check
      const consistencyScore = await this.performConsistencyCheck(content, primaryResult);
      
      // Human review flag
      const reviewFlag = await this.checkForHumanReview(primaryResult);
      
      const result: ClassificationResult = {
        id: content.id,
        isRelevant: primaryResult.isRelevant || false,
        confidenceScore: primaryResult.confidenceScore || 0,
        hasAuctionKeywords: primaryResult.hasAuctionKeywords || false,
        hasTravelKeywords: primaryResult.hasTravelKeywords || false,
        isNonprofit: primaryResult.isNonprofit || false,
        reasoning: primaryResult.reasoning || '',
        keywordMatches: primaryResult.keywordMatches || { auction: [], travel: [], nonprofit: [] },
        dateRelevance: primaryResult.dateRelevance || false,
        geographicRelevance: primaryResult.geographicRelevance || false,
        selfConsistencyScore: consistencyScore,
        reviewFlag,
        modelUsed: 'o4-mini',
        classifiedAt: new Date()
      };
      
      console.log(`Classification complete: ${result.isRelevant ? 'RELEVANT' : 'NOT RELEVANT'} (${result.confidenceScore.toFixed(2)})`);
      
      return result;
      
    } catch (error) {
      console.error('Classification failed:', error);
      return this.createErrorResult(content.id, error);
    }
  }

  /**
   * Perform primary classification using o4-mini (reasoning model)
   */
  private async performPrimaryClassification(content: ScrapedContent): Promise<Partial<ClassificationResult>> {
    const analysisText = this.prepareContentForAnalysis(content);
    
    const response = await this.openaiClient.chat.completions.create({
      model: 'o4-mini', // Using reasoning model for complex classification
      messages: [{
        role: 'system',
        content: this.classificationPrompts.primary + analysisText
      }],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 500
    });
    
    try {
      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error('No content in OpenAI response');
      }
      
      const result = JSON.parse(messageContent);
      
      // Enhanced keyword detection
      const enhancedKeywords = this.enhanceKeywordDetection(content, result.keywordMatches);
      
      // Date relevance check
      const dateRelevance = this.checkDateRelevance(content);
      
      // Geographic relevance check
      const geographicRelevance = this.checkGeographicRelevance(content);
      
      return {
        ...result,
        keywordMatches: enhancedKeywords,
        dateRelevance,
        geographicRelevance,
        confidenceScore: this.adjustConfidenceScore(result.confidenceScore, dateRelevance, geographicRelevance)
      };
      
    } catch (parseError) {
      console.error('Failed to parse classification response:', parseError);
      throw new Error('Invalid classification response format');
    }
  }

  /**
   * Perform self-consistency check
   */
  private async performConsistencyCheck(content: ScrapedContent, primaryResult: any): Promise<number> {
    const analysisText = this.prepareContentForAnalysis(content);
    
    const response = await this.openaiClient.chat.completions.create({
      model: 'o4-mini', // Using reasoning model for consistency analysis
      messages: [{
        role: 'system',
        content: this.classificationPrompts.consistency + analysisText + '\n\nOriginal Classification: ' + JSON.stringify(primaryResult)
      }],
      temperature: 0.1,
      max_tokens: 200
    });
    
    try {
      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        return 0.5; // Default if no content
      }
      
      const result = JSON.parse(messageContent);
      return result.consistencyScore || 0.5;
    } catch {
      return 0.5; // Default consistency score if parsing fails
    }
  }

  /**
   * Check if human review is needed
   */
  private async checkForHumanReview(result: any): Promise<boolean> {
    // Rule-based human review triggers
    const borderlineConfidence = result.confidenceScore >= 0.6 && result.confidenceScore <= 0.8;
    const conflictingSignals = result.hasAuctionKeywords && !result.hasTravelKeywords;
    const lowConsistency = result.selfConsistencyScore < 0.7;
    
    return borderlineConfidence || conflictingSignals || lowConsistency;
  }

  /**
   * Prepare content for analysis
   */
  private prepareContentForAnalysis(content: ScrapedContent): string {
    return `
URL: ${content.url}
TITLE: ${content.title}
CONTENT: ${content.content.substring(0, 2000)}
EVENT INFO: ${JSON.stringify(content.eventInfo)}
CONTACT INFO: ${JSON.stringify(content.contactInfo)}
ORG INFO: ${JSON.stringify(content.organizationInfo)}
`.trim();
  }

  /**
   * Enhance keyword detection with additional patterns
   */
  private enhanceKeywordDetection(content: ScrapedContent, baseKeywords: any): any {
    const text = `${content.title} ${content.content}`.toLowerCase();
    
    const auctionPatterns = [
      /silent auction/i, /live auction/i, /bid/i, /bidding/i, /raffle/i, 
      /gala/i, /fundraiser/i, /charity auction/i, /prize/i, /drawing/i
    ];
    
    const travelPatterns = [
      /travel/i, /trip/i, /vacation/i, /cruise/i, /resort/i, /hotel/i,
      /flight/i, /destination/i, /getaway/i, /package/i, /tour/i
    ];
    
    const nonprofitPatterns = [
      /nonprofit/i, /non-profit/i, /charity/i, /foundation/i, /501c3/i,
      /501\(c\)\(3\)/i, /church/i, /school/i, /university/i, /museum/i
    ];
    
    return {
      auction: [...baseKeywords.auction, ...this.findMatches(text, auctionPatterns)],
      travel: [...baseKeywords.travel, ...this.findMatches(text, travelPatterns)],
      nonprofit: [...baseKeywords.nonprofit, ...this.findMatches(text, nonprofitPatterns)]
    };
  }

  /**
   * Find pattern matches in text
   */
  private findMatches(text: string, patterns: RegExp[]): string[] {
    const matches: string[] = [];
    patterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    });
    return matches;
  }

  /**
   * Check date relevance based on configuration
   */
  private checkDateRelevance(content: ScrapedContent): boolean {
    if (!content.eventInfo?.date) return true; // No date info available
    
    // TODO: Implement date range checking against config
    return true;
  }

  /**
   * Check geographic relevance
   */
  private checkGeographicRelevance(_content: ScrapedContent): boolean {
    // TODO: Implement geographic filtering
    return true;
  }

  /**
   * Adjust confidence score based on date and geographic relevance
   */
  private adjustConfidenceScore(baseScore: number, dateRelevant: boolean, geoRelevant: boolean): number {
    let adjusted = baseScore;
    
    if (!dateRelevant) adjusted *= 0.8;
    if (!geoRelevant) adjusted *= 0.9;
    
    return Math.max(0, Math.min(1, adjusted));
  }

  /**
   * Create error result for failed classifications
   */
  private createErrorResult(contentId: string, error: any): ClassificationResult {
    return {
      id: contentId,
      isRelevant: false,
      confidenceScore: 0,
      hasAuctionKeywords: false,
      hasTravelKeywords: false,
      isNonprofit: false,
      reasoning: `Classification failed: ${error.message}`,
      keywordMatches: { auction: [], travel: [], nonprofit: [] },
      dateRelevance: false,
      geographicRelevance: false,
      selfConsistencyScore: 0,
      modelUsed: 'o4-mini',
      classifiedAt: new Date(),
      reviewFlag: true,
      error: `Classification failed: ${error.message}`
    };
  }

  /**
   * Batch classify multiple content items
   */
  async classifyBatch(contents: ScrapedContent[]): Promise<ClassificationResult[]> {
    console.log(`Starting batch classification of ${contents.length} items`);
    
    const results: ClassificationResult[] = [];
    
    for (const content of contents) {
      const result = await this.classifyContent(content);
      results.push(result);
      
      // Rate limiting to avoid API overuse
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Batch classification complete: ${results.filter(r => r.isRelevant).length}/${results.length} relevant`);
    
    return results;
  }

  /**
   * Get classification statistics
   */
  getClassificationStats(results: ClassificationResult[]): any {
    const relevant = results.filter(r => r.isRelevant);
    const needsReview = results.filter(r => r.reviewFlag);
    
    return {
      total: results.length,
      relevant: relevant.length,
      irrelevant: results.length - relevant.length,
      needsReview: needsReview.length,
      averageConfidence: relevant.reduce((sum, r) => sum + r.confidenceScore, 0) / relevant.length || 0,
      averageConsistency: Math.round((results.reduce((sum, r) => sum + r.selfConsistencyScore, 0) / results.length || 0) * 10000) / 10000
    };
  }

  /**
   * Filter results by confidence threshold
   */
  filterByConfidence(results: ClassificationResult[]): ClassificationResult[] {
    return results.filter(r => r.confidenceScore >= this.confidenceThreshold);
  }
}

// Export singleton instance
export const classifierAgent = new ClassifierAgent(); 