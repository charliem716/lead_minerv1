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
   * Generate search queries based on configuration
   */
  generateSearchQueries(): SearchQuery[] {
    const queries: SearchQuery[] = [];
    const baseKeywords = [
      'nonprofit travel auction',
      'charity travel package raffle',
      'fundraising travel auction',
      'nonprofit vacation auction',
      'charity trip raffle',
      'fundraising travel packages'
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

    // Exclude certain domains that are likely to be false positives
    query += ' -site:facebook.com -site:twitter.com -site:instagram.com -site:linkedin.com';

    return query;
  }

  /**
   * Execute search query via SerpAPI
   */
  async executeSearch(searchQuery: SearchQuery): Promise<any[]> {
    if (this.requestCount >= this.dailyLimit) {
      throw new Error(`Daily search limit of ${this.dailyLimit} reached`);
    }

    try {
      console.log(`Executing search: ${searchQuery.query}`);
      
      const searchParams: SerpApiParams = {
        q: searchQuery.query,
        engine: 'google',
        api_key: this.apiKey,
        num: 10, // Limit results to manage costs
        gl: 'us', // Geographic location
        hl: 'en', // Language
        safe: 'active'
      };

      const response: SerpApiResponse = await getJson(searchParams);
      this.requestCount++;

      // Update search query status
      searchQuery.status = 'completed';
      searchQuery.processedAt = new Date();
      searchQuery.resultsCount = response.organic_results?.length || 0;

      console.log(`Search completed: ${searchQuery.resultsCount} results found`);
      
      return response.organic_results || [];
    } catch (error) {
      console.error('Search execution failed:', error);
      searchQuery.status = 'failed';
      throw error;
    }
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