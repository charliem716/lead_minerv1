import { config } from '../config';
import { Lead, SearchQuery, ScrapedContent, ClassificationResult, NonprofitVerification, AgentExecutionContext } from '../types';
import { SearchAgent } from '../agents/search-agent';
import { ScraperAgent } from '../agents/scraper-agent';
import { ClassifierAgent } from '../agents/classifier-agent';
import { NonprofitVerifier } from '../agents/nonprofit-verifier';
import { SheetsAgent } from '../agents/sheets-agent';

export interface PipelineResult {
  id: string;
  sessionId: string;
  startTime: Date;
  endTime: Date;
  results: {
    searchQueries: SearchQuery[];
    scrapedContent: ScrapedContent[];
    classificationResults: ClassificationResult[];
    verificationResults: NonprofitVerification[];
    finalLeads: Lead[];
    duplicatesRemoved: number;
    humanReviewItems: number;
  };
  stats: {
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    budgetUsed: number;
    qualityScore: number;
  };
  errors: string[];
  warnings: string[];
}

export interface PipelineConfig {
  maxLeads: number;
  maxSearchQueries: number;
  enableVectorDeduplication: boolean;
  enableHumanReview: boolean;
  outputToSheets: boolean;
  dryRun: boolean;
  parallelProcessing: boolean;
  batchSize: number;
}

/**
 * Lead-Miner Pipeline Orchestrator
 * 
 * Coordinates the complete data pipeline:
 * Search → Scrape → Classify → Verify → Enrich → Deduplicate → Output
 */
export class PipelineOrchestrator {
  private context: AgentExecutionContext;
  private sessionId: string;
  private results: PipelineResult;
  private config: PipelineConfig;
  
  // Real agent instances
  private searchAgent: SearchAgent;
  private scraperAgent: ScraperAgent;
  private classifierAgent: ClassifierAgent;
  private nonprofitVerifier: NonprofitVerifier;
  private sheetsAgent: SheetsAgent;

  constructor(customConfig?: Partial<PipelineConfig>) {
    this.sessionId = 'pipeline-' + Date.now();
    this.config = {
      maxLeads: config.limits.maxLeadsPerDay,
      maxSearchQueries: config.limits.maxSearchQueries,
      enableVectorDeduplication: true,
      enableHumanReview: true,
      outputToSheets: true,
      dryRun: false,
      parallelProcessing: true,
      batchSize: 10,
      ...customConfig
    };

    this.context = {
      requestId: this.sessionId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      budgetUsed: 0,
      budgetRemaining: config.limits.budgetLimit,
      rateLimitStatus: {
        openai: 0,
        serpapi: 0,
        google: 0
      }
    };

    // Initialize real agents
    this.searchAgent = new SearchAgent();
    this.scraperAgent = new ScraperAgent();
    this.classifierAgent = new ClassifierAgent();
    this.nonprofitVerifier = new NonprofitVerifier();
    this.sheetsAgent = new SheetsAgent();

    this.results = this.initializeResults();
    console.log('🚀 Pipeline Orchestrator initialized with REAL agents');
  }

  /**
   * Execute the complete pipeline
   */
  async execute(): Promise<PipelineResult> {
    console.log('🚀 Starting Lead-Miner Pipeline Execution (REAL DATA MODE)');
    console.log('================================================');
    
    this.results.startTime = new Date();
    
    try {
      // Phase 1: Generate Search Queries
      console.log('\n📋 Phase 1: Generating Search Queries');
      const searchQueries = await this.generateSearchQueries();
      this.results.results.searchQueries = searchQueries;
      console.log(`✅ Generated ${searchQueries.length} search queries`);

      // Phase 2: REAL Search and Scraping
      console.log('\n🔍 Phase 2: Search and Scraping (REAL DATA)');
      const scrapedContent = await this.realSearchAndScrape(searchQueries);
      this.results.results.scrapedContent = scrapedContent;
      console.log(`✅ Scraped ${scrapedContent.length} pages`);

      // Phase 3: REAL Classification and Verification
      console.log('\n🤖 Phase 3: Classification and Verification (REAL DATA)');
      const classificationResults = await this.realClassification(scrapedContent);
      this.results.results.classificationResults = classificationResults;
      
      const verificationResults = await this.realVerification(scrapedContent);
      this.results.results.verificationResults = verificationResults;
      console.log(`✅ Classified ${classificationResults.length} items, verified ${verificationResults.length} nonprofits`);

      // Phase 4: Create Final Leads
      console.log('\n💎 Phase 4: Creating Final Leads');
      const finalLeads = await this.createFinalLeads(scrapedContent, classificationResults, verificationResults);
      this.results.results.finalLeads = finalLeads;
      console.log(`✅ Created ${finalLeads.length} final leads`);

      // Phase 5: Output to Google Sheets
      if (this.config.outputToSheets && !this.config.dryRun) {
        console.log('\n📊 Phase 5: Output to Google Sheets (REAL DATA)');
        await this.outputToSheets(finalLeads);
        console.log('✅ Results written to Google Sheets');
      }

      // Calculate final statistics
      this.calculateFinalStats();
      
      this.results.endTime = new Date();
      console.log(`\n🎉 Pipeline execution completed in ${this.results.endTime.getTime() - this.results.startTime.getTime()}ms`);
      console.log(`📊 Final Results: ${this.results.results.finalLeads.length} REAL leads`);
      
      return this.results;

    } catch (error) {
      console.error('❌ Pipeline execution failed:', error);
      this.results.errors.push(error instanceof Error ? error.message : String(error));
      this.results.endTime = new Date();
      throw error;
    }
  }

  /**
   * Generate search queries based on configuration
   */
  private async generateSearchQueries(): Promise<SearchQuery[]> {
    const queries: SearchQuery[] = [];
    
    // Get configured search terms
    const baseTerms = [
      'nonprofit travel auction',
      'charity vacation raffle',
      'nonprofit fundraising travel package',
      'charity silent auction travel',
      'fundraising gala travel donation',
      'nonprofit travel raffle',
      'charity auction vacation package',
      'fundraising event travel prize'
    ];

    // Get configured date ranges from config
    const months = config.dateRanges.searchMonths || ['March', 'April', 'May', 'September', 'October', 'November', 'December'];
    const quarters = config.dateRanges.searchQuarters || ['Q4'];
    const dateRanges = [...months, ...quarters];
    
    // Get configured geographic targets from config
    const states = config.geographic.states.length > 0 ? config.geographic.states : ['CA', 'NY', 'TX', 'FL', 'WA', 'MA', 'PA', 'IL', 'OH', 'GA'];

    let queryCount = 0;
    for (const baseTerm of baseTerms) {
      for (const dateRange of dateRanges) {
        for (const state of states) {
          if (queryCount >= this.config.maxSearchQueries) break;
          
          const query: SearchQuery = {
            id: `query-${queryCount}`,
            query: `${baseTerm} ${dateRange} ${state}`,
            dateRange,
            geographic: state,
            createdAt: new Date(),
            resultsCount: 0,
            status: 'pending'
          };
          
          queries.push(query);
          queryCount++;
        }
        if (queryCount >= this.config.maxSearchQueries) break;
      }
      if (queryCount >= this.config.maxSearchQueries) break;
    }

    return queries;
  }

  /**
   * REAL search using SerpAPI content directly (no browser scraping needed)
   */
  private async realSearchAndScrape(queries: SearchQuery[]): Promise<ScrapedContent[]> {
    const scrapedContent: ScrapedContent[] = [];
    
    // Process queries in batches to manage rate limits
    const batchSize = Math.min(this.config.batchSize, 5); // Limit to 5 to avoid overwhelming APIs
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      for (const query of batch) {
        try {
          console.log(`🔍 Executing search: ${query.query}`);
          
          // Execute real search
          const searchResults = await this.searchAgent.executeSearch(query);
          
          // Convert SerpAPI results directly to ScrapedContent (no browser needed!)
          for (const result of searchResults.slice(0, 5)) { // Process top 5 results per query
            if (result.link && this.isValidUrl(result.link)) {
                             const scrapedData: ScrapedContent = {
                 id: `serp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                 url: result.link,
                 title: result.title || 'No title',
                 content: result.snippet || '',
                 images: [],
                 scrapedAt: new Date(),
                 processingStatus: 'pending',
                 statusCode: 200,
                 eventInfo: this.extractEventInfoFromSnippet(result.snippet || '', result.title || ''),
                 contactInfo: this.extractContactInfoFromSnippet(result.snippet || ''),
                 organizationInfo: this.extractOrgInfoFromSnippet(result.snippet || '', result.title || '')
               };
              
              scrapedContent.push(scrapedData);
              console.log(`✅ Processed SerpAPI result: ${scrapedData.title}`);
            }
          }
          
          // Rate limiting between queries
          await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced from 2000ms
          
        } catch (error) {
          console.error(`❌ Search failed for query: ${query.query}`, error);
          query.status = 'failed';
        }
      }
    }
    
    return scrapedContent;
  }

  /**
   * Extract event information from SerpAPI snippet
   */
  private extractEventInfoFromSnippet(snippet: string, title: string): any {
    const fullText = `${title} ${snippet}`;
    
    // Extract dates
    const datePatterns = [
      /\b(\w+\s+\d{1,2},?\s+\d{4})\b/g,
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
      /\b(\d{4}-\d{2}-\d{2})\b/g
    ];
    
    const dates = [];
    for (const pattern of datePatterns) {
      const matches = fullText.match(pattern);
      if (matches) dates.push(...matches);
    }
    
    // Extract event types
    const eventTypes = [];
    const eventKeywords = ['auction', 'gala', 'fundraiser', 'benefit', 'charity event', 'raffle', 'silent auction'];
    for (const keyword of eventKeywords) {
      if (fullText.toLowerCase().includes(keyword)) {
        eventTypes.push(keyword);
      }
    }
    
         return {
       title: title,
       date: dates[0] || undefined,
       description: snippet
     };
  }

  /**
   * Extract contact information from SerpAPI snippet
   */
  private extractContactInfoFromSnippet(snippet: string): any {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    
    const emails = snippet.match(emailPattern) || [];
    const phones = snippet.match(phonePattern) || [];
    
              return {
       emails: emails,
       phones: phones,
       address: this.extractLocationFromSnippet(snippet)
     };
  }

  /**
   * Extract organization information from SerpAPI snippet
   */
  private extractOrgInfoFromSnippet(snippet: string, title: string): any {
    const fullText = `${title} ${snippet}`;
    
    // Look for organization indicators
    const orgKeywords = ['foundation', 'nonprofit', 'charity', 'organization', 'society', 'association'];
    const matchedKeywords = orgKeywords.filter(keyword => 
      fullText.toLowerCase().includes(keyword)
    );
    
    // Extract potential organization name from title
    const orgName = title.split(' - ')[0] || title.split(' | ')[0] || title;
    
         return {
       name: orgName,
       ein: undefined // Will be extracted during verification
     };
  }

  /**
   * Extract location information from text
   */
     private extractLocationFromSnippet(text: string): string | undefined {
     // Common US state patterns
     const statePattern = /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/gi;
     
     const stateMatch = text.match(statePattern);
     return stateMatch ? stateMatch[0] : undefined;
   }

  /**
   * REAL classification using OpenAI
   */
  private async realClassification(contents: ScrapedContent[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (const content of contents) {
      try {
        console.log(`🤖 Classifying: ${content.title}`);
        
        const classificationResult = await this.classifierAgent.classifyContent(content);
        
        // Convert to pipeline ClassificationResult format
        const pipelineResult: ClassificationResult = {
          id: classificationResult.id,
          leadId: content.id,
          isRelevant: classificationResult.isRelevant,
          confidenceScore: classificationResult.confidenceScore,
          hasAuctionKeywords: classificationResult.hasAuctionKeywords,
          hasTravelKeywords: classificationResult.hasTravelKeywords,
          reasoning: classificationResult.reasoning,
          classifiedAt: classificationResult.classifiedAt,
          modelUsed: classificationResult.modelUsed
        };
        
        results.push(pipelineResult);
        
        console.log(`✅ Classification complete: ${pipelineResult.isRelevant ? 'RELEVANT' : 'NOT RELEVANT'} (${(pipelineResult.confidenceScore * 100).toFixed(1)}%)`);
        
        // Rate limiting between classifications
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Classification failed for ${content.title}:`, error);
      }
    }
    
    return results;
  }

  /**
   * REAL nonprofit verification
   */
  private async realVerification(contents: ScrapedContent[]): Promise<NonprofitVerification[]> {
    const verifications: NonprofitVerification[] = [];
    
    for (const content of contents) {
      try {
        console.log(`🏛️ Verifying nonprofit: ${content.organizationInfo?.name}`);
        
        // Use verifyByName method which exists in NonprofitVerifier
        const verificationResult = await this.nonprofitVerifier.verifyByName(
          content.organizationInfo?.name || 'Unknown'
        );
        
        // Only add verification if it's not failed
        if (verificationResult.source !== 'failed') {
          const verification: NonprofitVerification = {
            id: `verification-${content.id}`,
            leadId: content.id,
            ein: verificationResult.ein,
            isVerified: verificationResult.isVerified,
            source: verificationResult.source as 'irs' | 'guidestar' | 'manual',
            verifiedAt: new Date(),
            additionalInfo: verificationResult.verificationDetails
          };
          
          verifications.push(verification);
          
          console.log(`✅ Verification complete: ${verification.isVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);
        } else {
          console.log(`❌ Verification failed for ${content.organizationInfo?.name}`);
        }
        
        // Rate limiting between verifications
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Verification failed for ${content.organizationInfo?.name}:`, error);
      }
    }
    
    return verifications;
  }

  /**
   * Create final leads from all pipeline data
   */
  private async createFinalLeads(
    contents: ScrapedContent[],
    classifications: ClassificationResult[],
    verifications: NonprofitVerification[]
  ): Promise<Lead[]> {
    const leads: Lead[] = [];
    
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      const classification = classifications[i];
      const verification = verifications[i];
      
      if (!content) {
        console.warn('⚠️ Content is undefined, skipping lead creation');
        continue;
      }
      
      if (classification && classification.isRelevant && classification.confidenceScore >= config.precision.confidenceThreshold) {
        const lead: Lead = {
          id: content.id,
          orgName: content.organizationInfo?.name || 'Unknown',
          ein: verification?.ein,
          eventName: content.eventInfo?.title || 'Unknown Event',
          eventDate: content.eventInfo?.date ? new Date(content.eventInfo.date) : undefined,
          url: content.url,
          travelKeywords: classification.hasTravelKeywords,
          auctionKeywords: classification.hasAuctionKeywords,
          usVerified: verification?.isVerified || false,
          score: classification.confidenceScore,
          contactEmail: content.contactInfo?.emails?.[0],
          contactPhone: content.contactInfo?.phones?.[0],
          staffSize: 0, // Staff size unknown (would come from enrichment data)
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'qualified'
        };
        
        leads.push(lead);
      }
    }
    
    return leads.slice(0, this.config.maxLeads);
  }

  /**
   * Output leads to Google Sheets (REAL)
   */
  private async outputToSheets(leads: Lead[]): Promise<void> {
    if (leads.length === 0) {
      console.log('No leads to output');
      return;
    }

    console.log(`📊 Writing ${leads.length} REAL leads to Google Sheets`);
    
    try {
      await this.sheetsAgent.addLeads(leads);
      console.log('✅ Leads written to Google Sheets successfully');
    } catch (error) {
      console.error('❌ Failed to write leads to Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Validate URL for scraping
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      // Skip social media and other non-relevant domains
      const skipDomains = [
        'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
        'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
        'amazon.com', 'ebay.com', 'craigslist.org'
      ];
      
      return !skipDomains.some(skipDomain => domain.includes(skipDomain));
    } catch {
      return false;
    }
  }

  /**
   * Calculate quality score for leads
   */
  private calculateQualityScore(leads: Lead[]): number {
    if (leads.length === 0) return 0;
    
    const totalScore = leads.reduce((sum, lead) => sum + lead.score, 0);
    return totalScore / leads.length;
  }

  /**
   * Calculate final statistics
   */
  private calculateFinalStats(): void {
    const totalProcessed = this.results.results.scrapedContent.length;
    const successfulLeads = this.results.results.finalLeads.length;
    const processingTime = this.results.endTime.getTime() - this.results.startTime.getTime();
    
    this.results.stats = {
      totalProcessed,
      successRate: totalProcessed > 0 ? successfulLeads / totalProcessed : 0,
      averageProcessingTime: totalProcessed > 0 ? processingTime / totalProcessed : 0,
      budgetUsed: this.context.budgetUsed,
      qualityScore: this.calculateQualityScore(this.results.results.finalLeads)
    };
  }

  /**
   * Initialize results object
   */
  private initializeResults(): PipelineResult {
    return {
      id: this.sessionId,
      sessionId: this.sessionId,
      startTime: new Date(),
      endTime: new Date(),
      results: {
        searchQueries: [],
        scrapedContent: [],
        classificationResults: [],
        verificationResults: [],
        finalLeads: [],
        duplicatesRemoved: 0,
        humanReviewItems: 0
      },
      stats: {
        totalProcessed: 0,
        successRate: 0,
        averageProcessingTime: 0,
        budgetUsed: 0,
        qualityScore: 0
      },
      errors: [],
      warnings: []
    };
  }

  /**
   * Get pipeline status
   */
  getStatus(): {
    sessionId: string;
    isRunning: boolean;
    progress: number;
    currentPhase: string;
    budgetUsed: number;
    budgetRemaining: number;
  } {
    return {
      sessionId: this.sessionId,
      isRunning: this.results.endTime.getTime() === this.results.startTime.getTime(),
      progress: this.calculateProgress(),
      currentPhase: this.getCurrentPhase(),
      budgetUsed: this.context.budgetUsed,
      budgetRemaining: this.context.budgetRemaining
    };
  }

  /**
   * Calculate pipeline progress
   */
  private calculateProgress(): number {
    const phases = ['queries', 'scraping', 'classification', 'verification', 'leads', 'output'];
    let completedPhases = 0;
    
    if (this.results.results.searchQueries.length > 0) completedPhases++;
    if (this.results.results.scrapedContent.length > 0) completedPhases++;
    if (this.results.results.classificationResults.length > 0) completedPhases++;
    if (this.results.results.verificationResults.length > 0) completedPhases++;
    if (this.results.results.finalLeads.length > 0) completedPhases++;
    
    return completedPhases / phases.length;
  }

  /**
   * Get current phase
   */
  private getCurrentPhase(): string {
    const progress = this.calculateProgress();
    const phases = ['Search Queries', 'Scraping', 'Classification', 'Verification', 'Final Leads', 'Output'];
    
    return phases[Math.floor(progress * phases.length)] || 'Starting';
  }
}

// Export default instance
export const pipelineOrchestrator = new PipelineOrchestrator(); 