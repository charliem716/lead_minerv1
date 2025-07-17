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
   * Generate search queries based on configuration with enhanced exclusion patterns
   */
  generateSearchQueries(): SearchQuery[] {
    const queries: SearchQuery[] = [];
    const baseKeywords = [
      // Educational institutions (prioritized)
      '"school travel auction" "fundraiser"',
      '"university travel raffle" "donate"',
      '"college vacation auction" "support"',
      '"pta travel packages" "fundraising"',
      '"student travel auction" "501c3"',
      '"alumni travel raffle" "mission"',
      
      // General nonprofit travel fundraising
      '"nonprofit travel packages" "donate"',
      '"charity vacation auction" "support our"',
      '"foundation travel raffle" "fundraising"',
      '"travel packages fundraiser" "501c3"',
      '"vacation donations" "nonprofit"',
      
      // Event-specific terms
      '"silent auction travel" "charity"',
      '"gala vacation packages" "fundraiser"',
      '"annual travel auction" "donate"'
    ];

    // Generate queries with date range filtering
    for (const month of config.dateRanges.searchMonths) {
      for (const baseKeyword of baseKeywords) {
        const query = this.buildSearchQuery(baseKeyword, month);
        queries.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query,
          dateRange: month,
          geographic: 'US',
          createdAt: new Date(),
          resultsCount: 0,
          status: 'pending'
        });
      }
    }

    // Generate queries with quarterly filtering
    for (const quarter of config.dateRanges.searchQuarters) {
      for (const baseKeyword of baseKeywords) {
        const query = this.buildSearchQuery(baseKeyword, quarter);
        queries.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query,
          dateRange: quarter,
          geographic: 'US',
          createdAt: new Date(),
          resultsCount: 0,
          status: 'pending'
        });
      }
    }

    return queries;
  }

  /**
   * Build search query with geographic and date filtering
   */
  private buildSearchQuery(baseKeyword: string, dateRange: string): string {
    let query = baseKeyword;

    // Add date range filtering
    if (dateRange.startsWith('Q')) {
      // Quarterly filtering
      const yearQuarter = `2025 ${dateRange}`;
      query += ` "${yearQuarter}" OR "${dateRange} 2025"`;
    } else {
      // Monthly filtering
      query += ` "${dateRange} 2025" OR "${dateRange}"`;
    }

    // Add geographic filtering
    if (config.geographic.states.length > 0) {
      const stateFilters = config.geographic.states.map(state => `"${state}"`).join(' OR ');
      query += ` (${stateFilters})`;
    } else {
      query += ' site:org OR site:nonprofit OR site:charity';
    }

    // Add event date range filtering
    if (config.dateRanges.eventDateRange) {
      const [startDate, endDate] = config.dateRanges.eventDateRange.split(' to ');
      query += ` after:${startDate} before:${endDate}`;
    }

    // Exclude B2B service providers and false positive domains
    query += ' -site:facebook.com -site:twitter.com -site:instagram.com -site:linkedin.com';
    query += ' -site:winspire.com -site:biddingforgood.com -site:auctionpackages.com -site:charitybuzz.com';
    query += ' -site:32auctions.com -site:givesmart.com -site:handbid.com';
    
    // Exclude B2B service language
    query += ' -"we provide" -"our services" -"contact for quote" -"packages starting"';
    query += ' -"auction items for sale" -"we donate" -"fundraising packages available"';
    query += ' -"call to book" -"pricing" -"vendor" -"supplier"';
    
    // Exclude political and government
    query += ' -"campaign" -"political" -"government" -"municipal" -"federal"';
    query += ' -"state agency" -"department of" -"city of" -"county of"';
    
    // Exclude for-profit indicators
    query += ' -"corporation" -"llc" -"inc." -"shareholders" -"investors"';

    return query;
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