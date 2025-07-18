import { config } from '../config';
import { Lead, SearchQuery, ScrapedContent, ClassificationResult, NonprofitVerification, AgentExecutionContext } from '../types';
import { SearchAgent } from '../agents/search-agent';
// import { ScraperAgent } from '../agents/scraper-agent'; // No longer needed - using SerpAPI content directly
import { ClassifierAgent } from '../agents/classifier-agent';
import { NonprofitVerifier } from '../agents/nonprofit-verifier';
import { SheetsAgent } from '../agents/sheets-agent';
import { DateFilter } from '../utils/date-filter';
import { DeduplicationEngine } from '../utils/deduplication';
import { PerformanceOptimizer } from '../utils/performance-optimizer';
import * as fs from 'fs';
import * as path from 'path';

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
  // private scraperAgent: ScraperAgent; // No longer needed - using SerpAPI content directly
  private classifierAgent: ClassifierAgent;
  private nonprofitVerifier: NonprofitVerifier;
  private sheetsAgent: SheetsAgent;
  private dateFilter: DateFilter;
  
  // NEW: Deduplication and optimization
  private deduplicationEngine: DeduplicationEngine;
  private performanceOptimizer: PerformanceOptimizer;
  private persistenceDir: string;
  private searchHistoryFile: string;
  private leadsHistoryFile: string;
  private searchHistory: Set<string>;
  private leadsHistory: Map<string, Lead>;

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
    // this.scraperAgent = new ScraperAgent(); // No longer needed - using SerpAPI content directly
    this.classifierAgent = new ClassifierAgent();
    this.nonprofitVerifier = new NonprofitVerifier();
    this.sheetsAgent = new SheetsAgent();
    this.dateFilter = new DateFilter();
    
    // NEW: Initialize deduplication and optimization
    this.deduplicationEngine = new DeduplicationEngine(0.85); // 85% similarity threshold
    this.performanceOptimizer = new PerformanceOptimizer();
    
    // Setup persistence
    this.persistenceDir = path.join(process.cwd(), 'data', 'pipeline');
    this.searchHistoryFile = path.join(this.persistenceDir, 'search-history.json');
    this.leadsHistoryFile = path.join(this.persistenceDir, 'leads-history.json');
    this.searchHistory = new Set();
    this.leadsHistory = new Map();
    
    // Ensure persistence directory exists
    if (!fs.existsSync(this.persistenceDir)) {
      fs.mkdirSync(this.persistenceDir, { recursive: true });
    }
    
    // Load existing history
    this.loadSearchHistory();
    this.loadLeadsHistory();

    this.results = this.initializeResults();
    console.log('🚀 Pipeline Orchestrator initialized with REAL agents + DEDUPLICATION + CACHING');
  }

  /**
   * Execute the complete pipeline with deduplication and caching
   */
  async execute(): Promise<PipelineResult> {
    console.log('🚀 Starting Lead-Miner Pipeline Execution (OPTIMIZED + DEDUPLICATED)');
    console.log('================================================');
    
    this.results.startTime = new Date();
    
    try {
      // Phase 1: Generate Search Queries (with deduplication)
      console.log('\n📋 Phase 1: Generating Search Queries (with deduplication)');
      const searchQueries = await this.generateSearchQueries();
      
      // Filter out duplicate queries
      const uniqueQueries = searchQueries.filter(query => !this.isDuplicateSearchQuery(query));
      this.results.results.searchQueries = uniqueQueries;
      console.log(`✅ Generated ${searchQueries.length} search queries, ${uniqueQueries.length} unique (${searchQueries.length - uniqueQueries.length} duplicates filtered)`);

      // Phase 2: REAL Search and Scraping (with caching)
      console.log('\n🔍 Phase 2: Search and Scraping (CACHED + OPTIMIZED)');
      const scrapedContent = await this.realSearchAndScrape(uniqueQueries);
      
      // Deduplicate scraped content
      const deduplicatedContent = this.deduplicationEngine.deduplicateBatch(scrapedContent);
      this.results.results.scrapedContent = deduplicatedContent;
      this.results.results.duplicatesRemoved = scrapedContent.length - deduplicatedContent.length;
      console.log(`✅ Scraped ${scrapedContent.length} pages, ${deduplicatedContent.length} unique (${this.results.results.duplicatesRemoved} duplicates removed)`);

      // Phase 3: REAL Classification and Verification (with caching)
      console.log('\n🤖 Phase 3: Classification and Verification (CACHED)');
      const classificationResults = await this.realClassification(deduplicatedContent);
      this.results.results.classificationResults = classificationResults;
      
      const verificationResults = await this.realVerification(deduplicatedContent);
      this.results.results.verificationResults = verificationResults;
      console.log(`✅ Classified ${classificationResults.length} items, verified ${verificationResults.length} nonprofits`);

      // Phase 4: Create Final Leads (with deduplication)
      console.log('\n💎 Phase 4: Creating Final Leads (with deduplication)');
      const preliminaryLeads = await this.createFinalLeads(deduplicatedContent, classificationResults, verificationResults);
      
      // Filter out duplicate leads based on history
      const uniqueLeads = preliminaryLeads.filter(lead => !this.isDuplicateLead(lead));
      this.results.results.finalLeads = uniqueLeads;
      console.log(`✅ Created ${preliminaryLeads.length} preliminary leads, ${uniqueLeads.length} unique (${preliminaryLeads.length - uniqueLeads.length} duplicates filtered)`);

      // Phase 5: Output to Google Sheets (only unique leads)
      if (this.config.outputToSheets && !this.config.dryRun && uniqueLeads.length > 0) {
        console.log('\n📊 Phase 5: Output to Google Sheets (UNIQUE LEADS ONLY)');
        await this.outputToSheets(uniqueLeads);
        console.log('✅ Results written to Google Sheets');
      } else if (uniqueLeads.length === 0) {
        console.log('\n📊 Phase 5: No unique leads to output - all were duplicates');
      }

      // Calculate final statistics
      this.calculateFinalStats();
      
      this.results.endTime = new Date();
      console.log(`\n🎉 Pipeline execution completed in ${this.results.endTime.getTime() - this.results.startTime.getTime()}ms`);
      console.log(`📊 Final Results: ${this.results.results.finalLeads.length} UNIQUE leads (${this.results.results.duplicatesRemoved} duplicates removed)`);
      
      return this.results;

    } catch (error) {
      console.error('❌ Pipeline execution failed:', error);
      this.results.errors.push(error instanceof Error ? error.message : String(error));
      this.results.endTime = new Date();
      throw error;
    }
  }

  /**
   * Generate search queries using the SearchAgent's diverse strategy
   */
  private async generateSearchQueries(): Promise<SearchQuery[]> {
    return this.searchAgent.generateSearchQueries();
  }

  /**
   * REAL search using SerpAPI content directly with caching and smart rotation
   * Optimized for speed with parallel processing and early termination
   */
  private async realSearchAndScrape(queries: SearchQuery[]): Promise<ScrapedContent[]> {
    const scrapedContent: ScrapedContent[] = [];
    let processedQueries = 0;
    const maxQueries = 15; // Reduced further for speed
    const targetLeads = 8; // Reduced target for faster execution
    
    console.log(`🚀 Processing ${Math.min(queries.length, maxQueries)} search queries with caching`);
    
    // Process queries in smaller parallel batches for speed
    const batchSize = 3; // Reduced batch size for better control
    const limitedQueries = queries.slice(0, maxQueries);
    
    for (let i = 0; i < limitedQueries.length && scrapedContent.length < targetLeads * 4; i += batchSize) {
      const batch = limitedQueries.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (query) => {
        try {
          console.log(`🔍 Executing search: ${query.query}`);
          
          // Use cached operation for search
          const searchResults = await this.performanceOptimizer.cachedOperation(
            `search-${query.query}`,
            async () => {
              return await Promise.race([
                this.searchAgent.executeSearch(query),
                new Promise<any[]>((_, reject) => 
                  setTimeout(() => reject(new Error('Search timeout')), 10000) // Reduced timeout
                )
              ]);
            },
            { cost: 0.02, ttl: 3600000 } // Cache for 1 hour
          );
          
          const batchResults: ScrapedContent[] = [];
          
          // Convert SerpAPI results directly to ScrapedContent (no browser needed!)
          for (const result of searchResults.slice(0, 3)) { // Process top 3 results per query for speed
            if (result.link && this.isValidUrl(result.link)) {
              const eventInfo = this.extractEventInfoFromSnippet(result.snippet || '', result.title || '');
               
              // Only include results with future event dates
              if (eventInfo.hasFutureDate) {
                const scrapedData: ScrapedContent = {
                  id: `serp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  url: result.link,
                  title: result.title || 'No title',
                  content: result.snippet || '',
                  images: [],
                  scrapedAt: new Date(),
                  processingStatus: 'pending',
                  statusCode: 200,
                  eventInfo: eventInfo,
                  contactInfo: this.extractContactInfoFromSnippet(result.snippet || ''),
                  organizationInfo: this.extractOrgInfoFromSnippet(result.snippet || '', result.title || '')
                };
                
                batchResults.push(scrapedData);
                console.log(`✅ Found future event: ${scrapedData.title} (${eventInfo.date})`);
              } else {
                console.log(`⏭️  Skipping past event: ${result.title}`);
              }
            }
          }
          
          return batchResults;
          
        } catch (error) {
          console.error(`❌ Search failed for query: ${query.query}`, error);
          query.status = 'failed';
          return [];
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten and add results
      for (const results of batchResults) {
        scrapedContent.push(...results);
      }
      
      processedQueries += batch.length;
      console.log(`📊 Processed ${processedQueries}/${limitedQueries.length} queries, found ${scrapedContent.length} potential leads`);
      
      // Early termination if we have enough leads
      if (scrapedContent.length >= targetLeads * 3) {
        console.log(`🎯 Found ${scrapedContent.length} potential leads, stopping search early`);
        break;
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100)); // Reduced delay
    }
    
    console.log(`✅ Search completed: ${scrapedContent.length} potential leads from ${processedQueries} queries`);
    return scrapedContent;
  }

  /**
   * Extract event information from SerpAPI snippet with future date validation
   */
  private extractEventInfoFromSnippet(snippet: string, title: string): any {
    const fullText = `${title} ${snippet}`;
    
    // Extract dates and validate they are in the future
    const datePatterns = [
      /\b(\w+\s+\d{1,2},?\s+\d{4})\b/g,
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
      /\b(\d{4}-\d{2}-\d{2})\b/g
    ];
    
    const validFutureDates = [];
    for (const pattern of datePatterns) {
      const matches = fullText.match(pattern);
      if (matches) {
        for (const dateStr of matches) {
          const parsedDate = this.dateFilter.parseEventDate(dateStr);
          if (parsedDate && this.dateFilter.isValidEventDate(parsedDate)) {
            validFutureDates.push({
              dateString: dateStr,
              parsedDate: parsedDate
            });
            console.log(`✅ Found valid future event date: ${dateStr} (${parsedDate.toDateString()})`);
          } else if (parsedDate) {
            console.log(`❌ Event date ${dateStr} is in the past or invalid, skipping`);
          }
        }
      }
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
      date: validFutureDates.length > 0 ? validFutureDates[0]?.dateString : undefined,
      parsedDate: validFutureDates.length > 0 ? validFutureDates[0]?.parsedDate : undefined,
      description: snippet,
      eventTypes: eventTypes,
      hasFutureDate: validFutureDates.length > 0
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
     private extractOrgInfoFromSnippet(_snippet: string, title: string): any {
     // const fullText = `${title} ${snippet}`;
     
     // Look for organization indicators (not currently used but kept for future enhancement)
     // const orgKeywords = ['foundation', 'nonprofit', 'charity', 'organization', 'society', 'association'];
     // const matchedKeywords = orgKeywords.filter(keyword => 
     //   fullText.toLowerCase().includes(keyword)
     // );
     
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
   * REAL classification using OpenAI with caching
   */
  private async realClassification(contents: ScrapedContent[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    
    for (const content of contents) {
      try {
        console.log(`🤖 Classifying: ${content.title}`);
        
        // Use cached operation for classification
        const classificationResult = await this.performanceOptimizer.cachedOperation(
          `classification-${content.url}-${content.title}`,
          () => this.classifierAgent.classifyContent(content),
          { cost: 0.01 } // Estimated cost per classification
        );
        
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
        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms
        
      } catch (error) {
        console.error(`❌ Classification failed for ${content.title}:`, error);
      }
    }
    
    return results;
  }

  /**
   * REAL nonprofit verification with unique EIN handling and caching
   */
  private async realVerification(contents: ScrapedContent[]): Promise<NonprofitVerification[]> {
    const verifications: NonprofitVerification[] = [];
    
    for (const content of contents) {
      try {
        console.log(`🏛️ Verifying nonprofit: ${content.organizationInfo?.name}`);
        
        // Use cached operation for verification
        const verificationResult = await this.performanceOptimizer.cachedOperation(
          `verification-${content.organizationInfo?.name}`,
          () => this.nonprofitVerifier.verifyByName(content.organizationInfo?.name || 'Unknown'),
          { cost: 0.005 } // Estimated cost per verification
        );
        
        // Create verification record for each content item, regardless of success/failure
        const verification: NonprofitVerification = {
          id: `verification-${content.id}`,
          leadId: content.id,
          ein: verificationResult.ein || undefined, // Don't use same EIN for failed results
          isVerified: verificationResult.isVerified,
          source: verificationResult.source as 'irs' | 'guidestar' | 'manual',
          verifiedAt: new Date(),
          additionalInfo: verificationResult.verificationDetails
        };
        
        verifications.push(verification);
        
        console.log(`✅ Verification complete: ${verification.isVerified ? 'VERIFIED' : 'NOT VERIFIED'} - EIN: ${verification.ein || 'N/A'}`);
        
        // Rate limiting between verifications
        await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 500ms
        
      } catch (error) {
        console.error(`❌ Verification failed for ${content.organizationInfo?.name}:`, error);
        
        // Create failed verification record
        const failedVerification: NonprofitVerification = {
          id: `verification-${content.id}`,
          leadId: content.id,
          ein: undefined, // No EIN for failed verification
          isVerified: false,
          source: 'manual',
          verifiedAt: new Date(),
          additionalInfo: { error: error instanceof Error ? error.message : String(error) }
        };
        
        verifications.push(failedVerification);
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

  /**
   * Load search history from file
   */
  private loadSearchHistory(): void {
    if (fs.existsSync(this.searchHistoryFile)) {
      const historyData = JSON.parse(fs.readFileSync(this.searchHistoryFile, 'utf8'));
      this.searchHistory = new Set(historyData);
      console.log(`Loaded ${this.searchHistory.size} unique search queries from history.`);
    } else {
      console.log('No search history file found.');
    }
  }

  /**
   * Load leads history from file
   */
  private loadLeadsHistory(): void {
    if (fs.existsSync(this.leadsHistoryFile)) {
      const historyData = JSON.parse(fs.readFileSync(this.leadsHistoryFile, 'utf8'));
      this.leadsHistory = new Map(Object.entries(historyData));
      console.log(`Loaded ${this.leadsHistory.size} unique leads from history.`);
    } else {
      console.log('No leads history file found.');
    }
  }

  /**
   * Save search history to file
   */
  private saveSearchHistory(): void {
    fs.writeFileSync(this.searchHistoryFile, JSON.stringify(Array.from(this.searchHistory)));
    console.log(`Saved ${this.searchHistory.size} unique search queries to history.`);
  }

  /**
   * Save leads history to file
   */
  private saveLeadsHistory(): void {
    fs.writeFileSync(this.leadsHistoryFile, JSON.stringify(Object.fromEntries(this.leadsHistory)));
    console.log(`Saved ${this.leadsHistory.size} unique leads to history.`);
  }

  /**
   * Add a search query to history and return if it's a duplicate
   */
  private isDuplicateSearchQuery(query: SearchQuery): boolean {
    const queryString = JSON.stringify(query);
    if (this.searchHistory.has(queryString)) {
      console.log(`Skipping duplicate search query: ${query.query}`);
      return true;
    }
    this.searchHistory.add(queryString);
    this.saveSearchHistory();
    return false;
  }

  /**
   * Add a lead to history and return if it's a duplicate
   */
  private isDuplicateLead(lead: Lead): boolean {
    const leadString = JSON.stringify(lead);
    if (this.leadsHistory.has(leadString)) {
      console.log(`Skipping duplicate lead: ${lead.orgName} (${lead.ein})`);
      return true;
    }
    this.leadsHistory.set(leadString, lead);
    this.saveLeadsHistory();
    return false;
  }
}

// Export default instance
export const pipelineOrchestrator = new PipelineOrchestrator(); 