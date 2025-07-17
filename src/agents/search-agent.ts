import { getJson, SerpApiParams, SerpApiResponse } from 'serpapi';
import { config } from '../config';
import { SearchQuery } from '../types';

/**
 * Search Agent for Lead Miner
 * Handles search query generation and execution via SerpAPI
 * Implements configurable date range and geographic filtering
 */
export class SearchAgent {
  private apiKey: string;
  private requestCount: number = 0;
  private dailyLimit: number;

  constructor() {
    this.apiKey = config.apis.serpapi.apiKey;
    this.dailyLimit = config.limits.maxSearchQueries;
  }

  /**
   * Generate diverse search queries with multiple strategies to maximize results
   */
  generateSearchQueries(): SearchQuery[] {
    const queries: SearchQuery[] = [];
    
    // Strategy 1: Direct nonprofit event searches (most effective)
    const directEventQueries = [
      'site:org "travel auction" 2025 OR 2026',
      'site:org "vacation raffle" 2025 OR 2026',
      'site:org "silent auction" travel 2025 OR 2026',
      'site:org "gala" "travel packages" 2025 OR 2026',
      'site:edu "travel auction" fundraiser 2025 OR 2026',
      'site:edu "vacation raffle" charity 2025 OR 2026',
      '"school travel auction" 2025 OR 2026',
      '"university travel raffle" 2025 OR 2026',
      '"church travel auction" 2025 OR 2026',
      '"nonprofit travel fundraiser" 2025 OR 2026'
    ];

    // Strategy 2: Specific organization types
    const organizationQueries = [
      '"501c3" "travel auction" 2025 OR 2026',
      '"501(c)(3)" "vacation raffle" 2025 OR 2026',
      '"charity" "travel packages" auction 2025 OR 2026',
      '"foundation" "travel raffle" 2025 OR 2026',
      '"museum" "travel auction" 2025 OR 2026',
      '"hospital foundation" "travel" auction 2025 OR 2026',
      '"animal shelter" "travel auction" 2025 OR 2026',
      '"food bank" "travel raffle" 2025 OR 2026',
      '"community center" "travel auction" 2025 OR 2026',
      '"youth organization" "travel raffle" 2025 OR 2026'
    ];

    // Strategy 3: Event-specific searches
    const eventQueries = [
      '"annual gala" "travel packages" 2025 OR 2026',
      '"benefit dinner" "travel auction" 2025 OR 2026',
      '"fundraising event" "vacation raffle" 2025 OR 2026',
      '"charity ball" "travel packages" 2025 OR 2026',
      '"auction night" "travel" 2025 OR 2026',
      '"silent auction" "cruise" "vacation" 2025 OR 2026',
      '"live auction" "travel packages" 2025 OR 2026',
      '"raffle prizes" "travel" 2025 OR 2026',
      '"wine auction" "travel packages" 2025 OR 2026',
      '"art auction" "vacation" 2025 OR 2026'
    ];

    // Strategy 4: Geographic + event searches
    const geographicQueries = [
      '"California nonprofit" "travel auction" 2025 OR 2026',
      '"New York charity" "travel raffle" 2025 OR 2026',
      '"Texas foundation" "travel packages" 2025 OR 2026',
      '"Florida nonprofit" "vacation auction" 2025 OR 2026',
      '"Chicago charity" "travel raffle" 2025 OR 2026',
      '"Los Angeles nonprofit" "travel auction" 2025 OR 2026',
      '"Boston charity" "vacation raffle" 2025 OR 2026',
      '"Seattle nonprofit" "travel packages" 2025 OR 2026',
      '"Denver charity" "travel auction" 2025 OR 2026',
      '"Atlanta nonprofit" "vacation raffle" 2025 OR 2026'
    ];

    // Strategy 5: Specific travel types
    const travelTypeQueries = [
      '"cruise auction" nonprofit 2025 OR 2026',
      '"vacation rental" charity auction 2025 OR 2026',
      '"resort package" nonprofit raffle 2025 OR 2026',
      '"airline tickets" charity auction 2025 OR 2026',
      '"hotel stay" nonprofit raffle 2025 OR 2026',
      '"Disney trip" charity auction 2025 OR 2026',
      '"European vacation" nonprofit raffle 2025 OR 2026',
      '"Hawaii trip" charity auction 2025 OR 2026',
      '"ski vacation" nonprofit raffle 2025 OR 2026',
      '"beach vacation" charity auction 2025 OR 2026'
    ];

    // Combine all strategies
    const allQueryStrings = [
      ...directEventQueries,
      ...organizationQueries,
      ...eventQueries,
      ...geographicQueries,
      ...travelTypeQueries
    ];

    // Create SearchQuery objects
    allQueryStrings.forEach((queryString, index) => {
      queries.push({
        id: `diverse-${Date.now()}-${index}`,
        query: queryString,
        dateRange: 'future',
        geographic: 'US',
        createdAt: new Date(),
        resultsCount: 0,
        status: 'pending'
      });
    });

    console.log(`✅ Generated ${queries.length} diverse search queries using multiple strategies`);
    return queries.slice(0, this.dailyLimit); // Respect daily limit
  }



  /**
   * Execute search query via SerpAPI with retry logic
   */
  async executeSearch(searchQuery: SearchQuery): Promise<any[]> {
    if (this.requestCount >= this.dailyLimit) {
      throw new Error(`Daily search limit of ${this.dailyLimit} reached`);
    }

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Executing search (attempt ${attempt}/${maxRetries}): ${searchQuery.query}`);
        
        const searchParams: SerpApiParams = {
          q: searchQuery.query,
          engine: 'google',
          api_key: this.apiKey,
          num: 10, // Limit results to manage costs
          gl: 'us', // Geographic location
          hl: 'en', // Language
          safe: 'active'
        };

        const response: SerpApiResponse = await Promise.race([
          getJson(searchParams),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
          )
        ]) as SerpApiResponse;

        this.requestCount++;

        // Update search query status
        searchQuery.status = 'completed';
        searchQuery.processedAt = new Date();
        searchQuery.resultsCount = response.organic_results?.length || 0;

        console.log(`✅ Search completed: ${searchQuery.resultsCount} results found`);
        
        return response.organic_results || [];
      } catch (error) {
        lastError = error;
        console.error(`❌ Search attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    console.error(`❌ Search failed after ${maxRetries} attempts for query: ${searchQuery.query}`);
    searchQuery.status = 'failed';
    throw lastError;
  }

  /**
   * Execute multiple search queries with rate limiting
   */
  async executeBatchSearch(queries: SearchQuery[]): Promise<Map<string, any[]>> {
    const results = new Map<string, any[]>();
    
    for (const query of queries) {
      if (this.requestCount >= this.dailyLimit) {
        console.warn(`Stopping batch search: Daily limit of ${this.dailyLimit} reached`);
        break;
      }

      try {
        // Rate limiting: 1 search per 2 seconds to respect API limits
        await this.delay(2000);
        
        const searchResults = await this.executeSearch(query);
        results.set(query.id, searchResults);
        
        console.log(`Batch search progress: ${results.size}/${queries.length} queries completed`);
      } catch (error) {
        console.error(`Batch search failed for query ${query.id}:`, error);
        // Continue with other queries
      }
    }

    return results;
  }

  /**
   * Filter search results by geographic region
   */
  filterByGeography(results: any[]): any[] {
    if (config.geographic.states.length === 0) {
      return results; // No geographic filtering
    }

    return results.filter(result => {
      const content = `${result.title} ${result.snippet} ${result.displayed_link}`.toLowerCase();
      
      // Check if result matches target states
      const matchesTargetStates = config.geographic.states.some(state => 
        content.includes(state.toLowerCase()) || 
        content.includes(this.getStateName(state).toLowerCase())
      );

      // Check if result matches excluded states
      const matchesExcludedStates = config.geographic.excludeStates.some(state => 
        content.includes(state.toLowerCase()) || 
        content.includes(this.getStateName(state).toLowerCase())
      );

      return matchesTargetStates && !matchesExcludedStates;
    });
  }

  /**
   * Get full state name from abbreviation
   */
  private getStateName(abbreviation: string): string {
    const stateMap: Record<string, string> = {
      'CA': 'California',
      'NY': 'New York',
      'TX': 'Texas',
      'FL': 'Florida',
      'AK': 'Alaska',
      'HI': 'Hawaii',
      // Add more states as needed
    };
    return stateMap[abbreviation] || abbreviation;
  }

  /**
   * Get search statistics
   */
  getStats(): { requestCount: number; dailyLimit: number; remainingRequests: number } {
    return {
      requestCount: this.requestCount,
      dailyLimit: this.dailyLimit,
      remainingRequests: this.dailyLimit - this.requestCount
    };
  }

  /**
   * Reset daily request count
   */
  resetDailyCount(): void {
    this.requestCount = 0;
    console.log('Daily search count reset');
  }

  /**
   * Delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a default instance
export const searchAgent = new SearchAgent(); 