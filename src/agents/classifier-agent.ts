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
  businessModel: 'nonprofit' | 'b2b_service' | 'vendor' | 'unknown';
  reasoning: string;
  keywordMatches: {
    auction: string[];
    travel: string[];
    nonprofit: string[];
    b2bExclusions: string[];
    nonprofitIndicators: string[];
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
 * Enhanced with business model detection to filter out B2B service providers
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

  // B2B Service Provider Exclusion Patterns
  private b2bExclusionPatterns = [
    // Service language
    /we provide/i, /our services/i, /contact us for/i, /request a quote/i,
    /packages available/i, /pricing/i, /book now/i, /reserve/i,
    /we offer/i, /our team/i, /professional services/i, /consultation/i,
    
    // Business indicators
    /starting at \$|from \$|prices begin/i, /per person|per night|per package/i,
    /call to book/i, /availability/i, /terms and conditions/i,
    /vendor/i, /supplier/i, /provider/i, /agency/i, /company/i,
    
    // Auction service providers specifically
    /auction items/i, /donation items/i, /consignment/i, /fundraising packages/i,
    /silent auction donations/i, /charity auction packages/i,
    /we donate/i, /donated by/i, /courtesy of/i,
    
    // Political and government exclusions
    /political action committee/i, /pac/i, /campaign/i, /candidate/i,
    /government/i, /municipal/i, /federal/i, /state agency/i,
    /department of/i, /city of/i, /county of/i,
    
    // For-profit indicators
    /corporation/i, /llc/i, /inc\./i, /ltd\./i, /profit/i,
    /shareholders/i, /investors/i, /stock/i, /ipo/i
  ];

  // Nonprofit Indicator Patterns
  private nonprofitIndicatorPatterns = [
    // Donation language
    /donate/i, /donation/i, /contribute/i, /support our/i, /help us/i,
    /make a difference/i, /join our mission/i, /volunteer/i,
    
    // Fundraising language
    /fundraising/i, /raise funds/i, /support our cause/i, /our mission/i,
    /501\(c\)\(3\)/i, /tax deductible/i, /charitable/i,
    
    // Event language (from nonprofit perspective)
    /our annual/i, /join us for/i, /attend our/i, /save the date/i,
    /tickets available/i, /sponsorship/i, /become a sponsor/i,
    
    // Organizational structure
    /board of directors/i, /trustees/i, /founded in/i, /established/i,
    /ein:|tax id:/i, /nonprofit/i, /non-profit/i, /charity/i, /foundation/i,
    
    // Travel package fundraising specific
    /travel packages for/i, /vacation donations/i, /trip fundraiser/i,
    /travel auction/i, /vacation raffle/i, /getaway auction/i,
    
    // Educational institutions (prioritized)
    /school/i, /university/i, /college/i, /academy/i, /education/i,
    /student/i, /alumni/i, /pta/i, /parent teacher/i, /booster/i
  ];

  constructor() {
    this.confidenceThreshold = config.precision.confidenceThreshold;
    
    // Initialize OpenAI client
    this.openaiClient = new OpenAI({
      apiKey: config.apis.openai.apiKey,
    });
    
    console.log('🤖 ClassifierAgent initialized with enhanced business model detection');
    
    this.setupPrompts();
  }

  /**
   * Setup enhanced classification prompts with business model detection
   */
  private setupPrompts(): void {
    this.classificationPrompts = {
      primary: `
You are a highly precise classifier for nonprofit travel auction events. Your task is to identify ACTUAL nonprofits running travel auctions, NOT companies that provide services to nonprofits.

CRITICAL DISTINCTION:
- TARGET: Nonprofits/charities running their own fundraising events with travel packages
- EXCLUDE: Companies that sell/donate travel packages to nonprofits (like WinspireMe, BiddingForGood, etc.)

STRICT CRITERIA (ALL must be present for positive classification):
1. TRAVEL PACKAGE OFFERING: Must offer travel packages, trips, vacations, cruises, or getaways as fundraising items
2. NONPROFIT ORGANIZATION: Must be a verified nonprofit (501c3, charity, foundation, school, educational institution)
3. FUNDRAISING PURPOSE: The travel packages must be offered to raise funds for the organization's mission
4. NONPROFIT-RUN: The organization must be OFFERING the packages themselves, not a B2B provider selling to them

IMMEDIATE EXCLUSIONS (classify as NOT relevant):
- B2B service providers that sell/donate travel packages TO nonprofits (like WinspireMe, BiddingForGood)
- Travel agencies, tour operators, or vacation rental companies
- Auction service providers or fundraising platforms
- Political organizations, PACs, campaigns, or candidates
- Government entities (federal, state, municipal agencies)
- For-profit companies (corporations, LLCs, businesses with shareholders)
- Event planning or consulting companies
- Organizations with commercial language: "we provide", "our services", "contact for quote", "pricing"

BUSINESS MODEL INDICATORS:
- NONPROFIT LANGUAGE: "donate to us", "support our mission", "volunteer with us", "our annual fundraiser"
- B2B SERVICE LANGUAGE: "we provide", "our packages", "contact us for pricing", "we donate to charities"

Respond with a JSON object containing:
{
  "isRelevant": boolean,
  "confidenceScore": number (0-1),
  "hasAuctionKeywords": boolean,
  "hasTravelKeywords": boolean,
  "isNonprofit": boolean,
  "businessModel": "nonprofit" | "b2b_service" | "vendor" | "unknown",
  "reasoning": "detailed explanation focusing on business model distinction",
  "keywordMatches": {
    "auction": ["matched auction keywords"],
    "travel": ["matched travel keywords"],
    "nonprofit": ["matched nonprofit keywords"],
    "b2bExclusions": ["matched B2B exclusion patterns"],
    "nonprofitIndicators": ["matched nonprofit indicator patterns"]
  }
}

CONTENT TO ANALYZE:
`,
      consistency: `
Perform a secondary consistency check on this classification, specifically focusing on business model detection.

Key questions:
- Is this definitely a nonprofit running their own event, not a service provider?
- Are there any B2B service indicators that were missed?
- Does the language suggest they're seeking donations or selling services?
- Is the confidence score appropriate given the business model clarity?

Provide a consistency score (0-1) where 1 means fully consistent with the original classification.
`,
      review: `
Determine if this classification result requires human review based on:
- Unclear business model (could be nonprofit or service provider)
- Mixed signals in content (both nonprofit and B2B language)
- Borderline confidence score (0.6-0.8)
- Unusual organizational structure

Return true if human review is recommended.
`
    };
  }

  /**
   * Classify scraped content for relevance with enhanced business model detection
   */
  async classifyContent(content: ScrapedContent): Promise<ClassificationResult> {
    console.log(`Classifying content with business model detection: ${content.url}`);
    
    try {
      // Primary classification with business model detection
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
        businessModel: primaryResult.businessModel || 'unknown',
        reasoning: primaryResult.reasoning || '',
        keywordMatches: primaryResult.keywordMatches || { 
          auction: [], travel: [], nonprofit: [], b2bExclusions: [], nonprofitIndicators: [] 
        },
        dateRelevance: primaryResult.dateRelevance || false,
        geographicRelevance: primaryResult.geographicRelevance || false,
        selfConsistencyScore: consistencyScore,
        reviewFlag,
          modelUsed: 'gpt-4o-mini',
        classifiedAt: new Date()
      };
      
      // Apply business model filter - exclude B2B services
      if (result.businessModel === 'b2b_service' || result.businessModel === 'vendor') {
        result.isRelevant = false;
        result.confidenceScore = Math.min(result.confidenceScore, 0.3);
        result.reasoning += ' | EXCLUDED: Identified as B2B service provider, not target nonprofit.';
      }
      
      console.log(`Classification complete: ${result.isRelevant ? 'RELEVANT' : 'NOT RELEVANT'} (${result.confidenceScore.toFixed(2)}) - Business Model: ${result.businessModel}`);
      
      return result;
      
    } catch (error) {
      console.error('Classification failed:', error);
      return this.createErrorResult(content.id, error);
    }
  }

  /**
   * Perform primary classification with enhanced business model detection and better error handling
   */
  private async performPrimaryClassification(content: ScrapedContent): Promise<Partial<ClassificationResult>> {
    const analysisText = this.prepareContentForAnalysis(content);
    
    try {
      const response = await Promise.race([
        this.openaiClient.chat.completions.create({
          model: 'gpt-4o-mini', // Using reasoning model for complex classification
          messages: [{
            role: 'system',
            content: this.classificationPrompts.primary + analysisText
          }],
          temperature: 0.1, // Low temperature for consistent results
          max_tokens: 600
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Classification timeout after 30 seconds')), 30000)
        )
      ]) as any;
      
      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        console.warn('Empty response from OpenAI, using fallback classification');
        return this.createFallbackClassification(content);
      }
      
      // Clean markdown code blocks from OpenAI response
      const cleanedContent = this.cleanMarkdownFromResponse(messageContent);
      
      let result;
      try {
        result = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.warn('Failed to parse OpenAI response, using fallback classification:', parseError);
        return this.createFallbackClassification(content);
      }
      
      // Validate required fields
      if (typeof result.isRelevant !== 'boolean' || typeof result.confidenceScore !== 'number') {
        console.warn('Invalid response structure, using fallback classification');
        return this.createFallbackClassification(content);
      }
      
      // Enhanced keyword detection with business model patterns
      const enhancedKeywords = this.enhanceKeywordDetection(content, result.keywordMatches || {});
      
      // Business model detection
      const businessModel = this.detectBusinessModel(content, enhancedKeywords);
      
      // Date relevance check
      const dateRelevance = this.checkDateRelevance(content);
      
      // Geographic relevance check
      const geographicRelevance = this.checkGeographicRelevance(content);
      
      // Apply organization type preferences
      let adjustedConfidence = this.adjustConfidenceScore(
        result.confidenceScore, 
        dateRelevance, 
        geographicRelevance, 
        businessModel
      );
      adjustedConfidence = this.applyOrganizationPreferences(content, adjustedConfidence);
      
      return {
        ...result,
        businessModel,
        keywordMatches: enhancedKeywords,
        dateRelevance,
        geographicRelevance,
        confidenceScore: adjustedConfidence
      };
      
    } catch (apiError) {
      console.error('OpenAI API error, using fallback classification:', apiError);
      return this.createFallbackClassification(content);
    }
  }

  /**
   * Create fallback classification when OpenAI fails
   * AGGRESSIVE: Much more generous to capture all potential leads
   */
  private createFallbackClassification(content: ScrapedContent): Partial<ClassificationResult> {
    const text = `${content.title} ${content.content}`.toLowerCase();
    
    // AGGRESSIVE: Expanded keyword detection with more patterns
    const hasAuction = /auction|raffle|gala|fundraiser|benefit|silent auction|live auction|charity auction|travel auction|vacation raffle|prize drawing|sweepstakes|contest|bid|bidding|donate|donation|give|giving|support|help|raise funds|annual event|special event/.test(text);
    const hasTravel = /travel|vacation|cruise|trip|resort|getaway|hotel|flight|airline|disney|hawaii|europe|caribbean|ski|beach|tour|package|destination|stay|visit|experience|adventure|journey|retreat|spa|casino|golf|wine|dining/.test(text);
    const hasNonprofit = /nonprofit|non-profit|charity|foundation|501c3|501\(c\)\(3\)|school|university|church|hospital|museum|ymca|rotary|lions club|kiwanis|community center|food bank|pta|pto|education|health|medical|children|kids|family|community|volunteer|mission|cause/.test(text);
    const hasB2B = /we provide|our services|contact for pricing|vendor|supplier|company|corporation|llc|inc\.|profit|business|commercial|enterprise|firm|agency|consulting|marketing|sales|revenue|clients|customers/.test(text);
    
    // Enhanced keyword detection
    const enhancedKeywords = this.enhanceKeywordDetection(content, {});
    
    // Business model detection
    const businessModel = this.detectBusinessModel(content, enhancedKeywords);
    
    // AGGRESSIVE: Much more generous confidence calculation
    let confidence = 0.25; // Higher base confidence
    
    // Very generous scoring for any auction/fundraising indicators
    if (hasAuction) confidence += 0.45; // Increased significantly
    if (hasTravel) confidence += 0.35; // Increased
    if (hasNonprofit) confidence += 0.30; // Increased
    
    // Extra bonuses for strong combinations
    if (hasAuction && hasTravel) confidence += 0.20; // Bonus for combination
    if (hasNonprofit && hasAuction) confidence += 0.15; // Bonus for nonprofit + auction
    
    // Additional bonuses for specific keywords
    if (text.includes('travel auction') || text.includes('vacation raffle') || text.includes('travel raffle')) confidence += 0.25;
    if (text.includes('charity') || text.includes('foundation') || text.includes('nonprofit')) confidence += 0.15;
    if (text.includes('fundraiser') || text.includes('benefit') || text.includes('gala')) confidence += 0.15;
    if (text.includes('school') || text.includes('hospital') || text.includes('church')) confidence += 0.10;
    
    // Reduced penalty for B2B indicators
    if (hasB2B) confidence -= 0.20; // Much reduced penalty
    
    confidence = Math.max(0, Math.min(1, confidence));
    
    // AGGRESSIVE: Much more lenient relevance criteria
    const isRelevant = (hasAuction && hasTravel) || // Just need auction + travel
                      (hasAuction && hasNonprofit) || // Or auction + nonprofit
                      (confidence >= 0.25); // Or any decent confidence
    
    console.log(`AGGRESSIVE Fallback classification: ${isRelevant ? 'RELEVANT' : 'NOT RELEVANT'} (${confidence.toFixed(2)}) - ${content.url}`);
    console.log(`  Keywords found: auction=${hasAuction}, travel=${hasTravel}, nonprofit=${hasNonprofit}, b2b=${hasB2B}`);
    
    return {
      isRelevant,
      confidenceScore: confidence,
      hasAuctionKeywords: hasAuction,
      hasTravelKeywords: hasTravel,
      isNonprofit: hasNonprofit,
      businessModel,
      reasoning: `AGGRESSIVE fallback classification - Enhanced keyword analysis (auction=${hasAuction}, travel=${hasTravel}, nonprofit=${hasNonprofit})`,
      keywordMatches: enhancedKeywords,
      dateRelevance: this.checkDateRelevance(content),
      geographicRelevance: this.checkGeographicRelevance(content)
    };
  }

  /**
   * Perform self-consistency check
   */
  private async performConsistencyCheck(content: ScrapedContent, primaryResult: any): Promise<number> {
    const analysisText = this.prepareContentForAnalysis(content);
    
    const response = await this.openaiClient.chat.completions.create({
                model: 'gpt-4o-mini', // Using reasoning model for consistency analysis
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
      
      const cleanedContent = this.cleanMarkdownFromResponse(messageContent);
      const result = JSON.parse(cleanedContent);
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
   * Clean markdown code blocks from OpenAI responses
   */
  private cleanMarkdownFromResponse(content: string): string {
    // Remove markdown code blocks (```json ... ```) and extract JSON
    const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      return jsonBlockMatch[1].trim();
    }
    
    // If no code blocks, return original content (might be plain JSON)
    return content.trim();
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
   * Enhance keyword detection with business model patterns
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
      auction: [...(baseKeywords.auction || []), ...this.findMatches(text, auctionPatterns)],
      travel: [...(baseKeywords.travel || []), ...this.findMatches(text, travelPatterns)],
      nonprofit: [...(baseKeywords.nonprofit || []), ...this.findMatches(text, nonprofitPatterns)],
      b2bExclusions: [...(baseKeywords.b2bExclusions || []), ...this.findMatches(text, this.b2bExclusionPatterns)],
      nonprofitIndicators: [...(baseKeywords.nonprofitIndicators || []), ...this.findMatches(text, this.nonprofitIndicatorPatterns)]
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
   * Adjust confidence score based on date, geographic relevance, and organization type
   */
  private adjustConfidenceScore(baseScore: number, dateRelevant: boolean, geoRelevant: boolean, businessModel: 'nonprofit' | 'b2b_service' | 'vendor' | 'unknown'): number {
    let adjusted = baseScore;
    
    if (!dateRelevant) adjusted *= 0.8;
    if (!geoRelevant) adjusted *= 0.9;

    // Adjust for business model
    if (businessModel === 'b2b_service' || businessModel === 'vendor') {
      adjusted *= 0.5; // Lower confidence for B2B/Vendor
    }
    
    return Math.max(0, Math.min(1, adjusted));
  }

  /**
   * Apply organization type preferences (reduce religious orgs slightly)
   */
  private applyOrganizationPreferences(content: ScrapedContent, score: number): number {
    const text = `${content.title} ${content.content}`.toLowerCase();
    
    // Boost educational institutions
    if (text.includes('school') || text.includes('university') || 
        text.includes('college') || text.includes('pta') || 
        text.includes('student') || text.includes('education')) {
      return Math.min(1.0, score * 1.1); // 10% boost
    }
    
    // Slightly reduce religious organizations (but don't exclude)
    if (text.includes('church') || text.includes('cathedral') || 
        text.includes('synagogue') || text.includes('mosque') || 
        text.includes('temple') || text.includes('parish') ||
        text.includes('diocese') || text.includes('ministry')) {
      return score * 0.9; // 10% reduction
    }
    
    return score;
  }

  /**
   * Detect business model based on content patterns
   */
  private detectBusinessModel(content: ScrapedContent, keywords: any): 'nonprofit' | 'b2b_service' | 'vendor' | 'unknown' {
    const text = `${content.title} ${content.content}`.toLowerCase();
    const url = content.url.toLowerCase();
    
    // Check for B2B exclusion patterns
    const b2bMatches = keywords.b2bExclusions.length;
    const nonprofitMatches = keywords.nonprofitIndicators.length;
    
    // URL-based detection for known B2B providers
    if (url.includes('winspire') || url.includes('biddingforgood') || 
        url.includes('auctionpackages') || url.includes('charitybuzz') ||
        url.includes('auction') && (url.includes('services') || url.includes('packages'))) {
      return 'b2b_service';
    }
    
    // Political/Government exclusions
    if (text.includes('campaign') || text.includes('political') || 
        text.includes('government') || text.includes('municipal') ||
        text.includes('federal') || text.includes('state agency')) {
      return 'vendor'; // Treat as excluded
    }
    
    // For-profit indicators
    if (text.includes('corporation') || text.includes('llc') || 
        text.includes('shareholders') || text.includes('inc.')) {
      return 'vendor';
    }
    
    // Strong B2B indicators
    if (b2bMatches > nonprofitMatches && b2bMatches > 2) {
      return 'b2b_service';
    }
    
    // Check for vendor language
    if (text.includes('we provide') || text.includes('our services') || 
        text.includes('contact for quote') || text.includes('pricing')) {
      return 'vendor';
    }
    
    // Educational institutions get priority (schools, universities)
    if (text.includes('school') || text.includes('university') || 
        text.includes('college') || text.includes('pta') || 
        text.includes('student') || text.includes('education')) {
      return 'nonprofit';
    }
    
    // Strong nonprofit indicators
    if (nonprofitMatches > b2bMatches && nonprofitMatches > 2) {
      return 'nonprofit';
    }
    
    // Check for nonprofit-specific language
    if (text.includes('donate to us') || text.includes('support our mission') || 
        text.includes('501(c)(3)') || text.includes('our annual fundraiser')) {
      return 'nonprofit';
    }
    
    return 'unknown';
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
      businessModel: 'unknown',
      reasoning: `Classification failed: ${error.message}`,
      keywordMatches: { auction: [], travel: [], nonprofit: [], b2bExclusions: [], nonprofitIndicators: [] },
      dateRelevance: false,
      geographicRelevance: false,
      selfConsistencyScore: 0,
        modelUsed: 'gpt-4o-mini',
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