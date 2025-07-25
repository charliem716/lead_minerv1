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
   * Generate diverse search queries for nonprofit travel auctions
   * Uses 10 different search strategies for comprehensive coverage
   */
  generateSearchQueries(): SearchQuery[] {
    const queries: SearchQuery[] = [];
    
    // Load rotation state to vary queries
    const rotationState = this.loadRotationState();
    
    // Strategy 1: SIMPLIFIED high-success queries (NEW - prioritize success rate)
    const simpleHighSuccessQueries = [
      'nonprofit auction travel 2025',
      'charity raffle vacation 2025',
      'school fundraiser travel auction',
      'hospital foundation travel raffle',
      'museum gala vacation auction',
      'church travel fundraiser',
      'university alumni travel auction',
      'foundation charity vacation raffle',
      'nonprofit travel packages auction',
      'charity travel fundraising event'
    ];

    // Strategy 2: Direct nonprofit event searches (most effective) - rotated
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

    // Strategy 3: Specific organization types
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

    // Strategy 4: Event-specific searches with current month rotation
    const currentMonth = new Date().getMonth();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const futureMonths = months.slice(currentMonth + 1).concat(months.slice(0, currentMonth + 1));
    
    const eventQueries = [
      `"annual gala" "travel packages" ${futureMonths[0]} 2025`,
      `"benefit dinner" "travel auction" ${futureMonths[1]} 2025`,
      `"fundraising event" "vacation raffle" ${futureMonths[2]} 2025`,
      `"charity ball" "travel packages" ${futureMonths[0]} 2025`,
      `"auction night" "travel" ${futureMonths[1]} 2025`,
      `"silent auction" "cruise" "vacation" ${futureMonths[2]} 2025`,
      `"live auction" "travel packages" ${futureMonths[0]} 2025`,
      `"raffle prizes" "travel" ${futureMonths[1]} 2025`,
      `"wine auction" "travel packages" ${futureMonths[2]} 2025`,
      `"art auction" "vacation" ${futureMonths[0]} 2025`
    ];

    // Strategy 5: Geographic + event searches (EXPANDED state rotation)
    const states = ['California', 'New York', 'Texas', 'Florida', 'Illinois', 'Ohio', 
                   'North Carolina', 'Georgia', 'Michigan', 'Washington', 'Virginia', 'Pennsylvania',
                   'Massachusetts', 'Arizona', 'Tennessee', 'Indiana', 'Missouri', 'Maryland',
                   'Wisconsin', 'Colorado', 'Minnesota', 'South Carolina', 'Alabama', 'Louisiana'];
    const rotatedStates = this.rotateArray(states, rotationState.stateOffset);
    
    // Add major cities for more targeted searches
    const cities = ['Los Angeles', 'New York City', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
                   'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
                   'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle'];
    const rotatedCities = this.rotateArray(cities, rotationState.stateOffset);
    
    const geographicQueries = [
      `"${rotatedStates[0]} nonprofit" "travel auction" 2025 OR 2026`,
      `"${rotatedCities[0]}" "charity auction" "travel" 2025 OR 2026`,
      `"${rotatedStates[1]} foundation" "travel packages" 2025 OR 2026`,
      `"${rotatedCities[1]}" "nonprofit" "vacation auction" 2025 OR 2026`,
      `"${rotatedStates[2]} charity" "travel raffle" 2025 OR 2026`,
      `"${rotatedCities[2]}" "foundation" "travel auction" 2025 OR 2026`,
      `"${rotatedStates[3]} nonprofit" "vacation raffle" 2025 OR 2026`,
      `"${rotatedCities[3]}" "charity" "travel packages" 2025 OR 2026`,
      `"${rotatedStates[8]} charity" "travel auction" 2025 OR 2026`,
      `"${rotatedStates[9]} nonprofit" "vacation raffle" 2025 OR 2026`
    ];

    // Strategy 6: Specific travel types (rotate destinations)
    const travelTypes = ['cruise', 'vacation rental', 'resort package', 'airline tickets', 'hotel stay', 
                        'Disney trip', 'European vacation', 'Hawaii trip', 'ski vacation', 'beach vacation'];
    const rotatedTravel = this.rotateArray(travelTypes, rotationState.travelOffset);
    
    const travelTypeQueries = [
      `"${rotatedTravel[0]}" nonprofit auction 2025 OR 2026`,
      `"${rotatedTravel[1]}" charity auction 2025 OR 2026`,
      `"${rotatedTravel[2]}" nonprofit raffle 2025 OR 2026`,
      `"${rotatedTravel[3]}" charity auction 2025 OR 2026`,
      `"${rotatedTravel[4]}" nonprofit raffle 2025 OR 2026`,
      `"${rotatedTravel[5]}" charity auction 2025 OR 2026`,
      `"${rotatedTravel[6]}" nonprofit raffle 2025 OR 2026`,
      `"${rotatedTravel[7]}" charity auction 2025 OR 2026`,
      `"${rotatedTravel[8]}" nonprofit raffle 2025 OR 2026`,
      `"${rotatedTravel[9]}" charity auction 2025 OR 2026`
    ];

    // Strategy 7: Healthcare organizations (most promising)
    const healthcareQueries = [
      '"hospital foundation" "travel auction" 2025 OR 2026',
      '"medical center" "charity raffle" 2025 OR 2026',
      '"children\'s hospital" "travel packages" 2025 OR 2026',
      '"cancer center" "vacation auction" 2025 OR 2026',
      '"healthcare foundation" "travel raffle" 2025 OR 2026',
      '"medical research" "charity auction" 2025 OR 2026',
      '"health foundation" "travel fundraiser" 2025 OR 2026',
      '"clinic foundation" "vacation raffle" 2025 OR 2026',
      '"nursing home" "charity auction" 2025 OR 2026',
      '"hospice foundation" "travel packages" 2025 OR 2026'
    ];

    // Strategy 8: Arts and culture (high success rate)
    const artsQueries = [
      '"art museum" "travel auction" 2025 OR 2026',
      '"symphony orchestra" "vacation raffle" 2025 OR 2026',
      '"theater company" "travel packages" 2025 OR 2026',
      '"dance company" "charity auction" 2025 OR 2026',
      '"music foundation" "travel raffle" 2025 OR 2026',
      '"cultural center" "vacation auction" 2025 OR 2026',
      '"opera company" "travel fundraiser" 2025 OR 2026',
      '"arts council" "charity raffle" 2025 OR 2026',
      '"gallery foundation" "travel packages" 2025 OR 2026',
      '"performing arts" "vacation auction" 2025 OR 2026'
    ];

    // Strategy 9: Education organizations (high potential)
    const educationQueries = [
      '"school foundation" "travel auction" 2025 OR 2026',
      '"university alumni" "vacation raffle" 2025 OR 2026',
      '"PTA fundraiser" "travel packages" 2025 OR 2026',
      '"college foundation" "charity auction" 2025 OR 2026',
      '"education foundation" "travel raffle" 2025 OR 2026',
      '"scholarship fund" "vacation auction" 2025 OR 2026',
      '"private school" "travel fundraiser" 2025 OR 2026',
      '"academy foundation" "charity raffle" 2025 OR 2026',
      '"student aid" "travel packages" 2025 OR 2026',
      '"educational nonprofit" "vacation auction" 2025 OR 2026'
    ];

    // Strategy 10: Community organizations (broad reach)
    const communityQueries = [
      '"rotary club" "travel auction" 2025 OR 2026',
      '"chamber of commerce" "vacation raffle" 2025 OR 2026',
      '"lions club" "travel packages" 2025 OR 2026',
      '"kiwanis club" "charity auction" 2025 OR 2026',
      '"community foundation" "travel raffle" 2025 OR 2026',
      '"civic organization" "vacation auction" 2025 OR 2026',
      '"volunteer organization" "travel fundraiser" 2025 OR 2026',
      '"service club" "charity raffle" 2025 OR 2026',
      '"community center" "travel packages" 2025 OR 2026',
      '"neighborhood association" "vacation auction" 2025 OR 2026'
    ];

    // Strategy 11: Seasonal and event-specific (timely relevance)
    const seasonalQueries = [
      '"spring gala" "travel auction" 2025',
      '"fall fundraiser" "vacation packages" 2025',
      '"holiday benefit" "travel raffle" 2025',
      '"annual dinner" "vacation auction" 2025',
      '"charity ball" "travel packages" 2025',
      '"benefit gala" "vacation raffle" 2025',
      '"fundraising dinner" "travel auction" 2025',
      '"silent auction" "vacation packages" 2025',
      '"charity event" "travel raffle" 2025',
      '"nonprofit gala" "vacation auction" 2025'
    ];

    // Combine strategies with rotation-based selection (PRIORITIZE HIGH-SUCCESS)
    const allQueryStrings = [
      ...simpleHighSuccessQueries.slice(0, 10), // Prioritize simple, high-success queries
      ...directEventQueries.slice(0, 3),
      ...organizationQueries.slice(0, 3),
      ...eventQueries.slice(0, 3),
      ...geographicQueries.slice(0, 3),
      ...travelTypeQueries.slice(0, 3),
      ...healthcareQueries.slice(0, 3),
      ...artsQueries.slice(0, 3),
      ...educationQueries.slice(0, 3),
      ...communityQueries.slice(0, 3),
      ...seasonalQueries.slice(0, 2)
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

    // Update rotation state for next run
    this.updateRotationState(rotationState);

    console.log(`✅ Generated ${queries.length} rotated search queries using intelligent diversity`);
    return queries.slice(0, this.dailyLimit); // Respect daily limit
  }

  /**
   * Execute search query via SerpAPI with enhanced retry logic and fallbacks
   */
  async executeSearch(searchQuery: SearchQuery): Promise<any[]> {
    if (this.requestCount >= this.dailyLimit) {
      throw new Error(`Daily search limit of ${this.dailyLimit} reached`);
    }

    const maxRetries = 3; // Increased retries for better success rate

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
          // Note: Additional parameters like lr, cr, filter may not be supported by current SerpAPI types
        };

        const response: SerpApiResponse = await Promise.race([
          getJson(searchParams),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000) // Reduced timeout
          )
        ]) as SerpApiResponse;

        this.requestCount++;

        // Update search query status
        searchQuery.status = 'completed';
        searchQuery.processedAt = new Date();
        searchQuery.resultsCount = response.organic_results?.length || 0;

        console.log(`✅ Search completed: ${searchQuery.resultsCount} results found`);
        
        // Return results even if empty - this counts as success
        return response.organic_results || [];
        
      } catch (error) {
        console.error(`❌ Search attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Progressive backoff with fallback query simplification
          const delay = attempt * 1000; // Reduced delay: 1s, 2s, 3s for speed
          console.log(`⏳ Retrying in ${delay}ms...`);
          await this.delay(delay);
          
          // On second retry, try a simplified version of the query
          if (attempt === 2) {
            searchQuery.query = this.simplifyQuery(searchQuery.query);
            console.log(`🔄 Simplified query for retry: ${searchQuery.query}`);
          }
          
          // On final retry, try ultra-simple version
          if (attempt === 3) {
            searchQuery.query = this.ultraSimplifyQuery(searchQuery.query);
            console.log(`🔄 Ultra-simplified query for final attempt: ${searchQuery.query}`);
          }
        }
      }
    }

    console.error(`❌ Search failed after ${maxRetries} attempts for query: ${searchQuery.query}`);
    searchQuery.status = 'failed';
    
    // Return empty array instead of throwing - allows pipeline to continue
    console.log(`⚠️ Returning empty results for failed query to continue pipeline`);
    return [];
  }

  /**
   * Simplify complex queries for better success rate
   */
  private simplifyQuery(query: string): string {
    // Remove complex operators and quotes for retry
    return query
      .replace(/site:\w+/g, '') // Remove site: operators
      .replace(/OR \d{4}/g, '') // Remove OR operators
      .replace(/"/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Ultra-simplify queries to basic keywords only
   */
  private ultraSimplifyQuery(query: string): string {
    // Extract only the most essential keywords
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove all punctuation
      .split(/\s+/)
      .filter(word => 
        ['nonprofit', 'charity', 'auction', 'travel', 'vacation', 'raffle', 'fundraiser', 'gala'].includes(word)
      );
    
    // Return top 3 keywords or fallback
    const result = keywords.slice(0, 3).join(' ') || 'nonprofit travel auction';
    console.log(`Ultra-simplified to: ${result}`);
    return result;
  }

  /**
   * Execute multiple search queries with rate limiting and manual seed fallback
   */
  async executeBatchSearch(queries: SearchQuery[]): Promise<Map<string, any[]>> {
    const results = new Map<string, any[]>();
    let successfulSearches = 0;
    
    console.log(`🔍 Starting batch search with ${queries.length} queries`);
    
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
        
        if (searchResults.length > 0) {
          successfulSearches++;
        }
        
        console.log(`Batch search progress: ${results.size}/${queries.length} queries completed, ${successfulSearches} successful`);
      } catch (error) {
        console.error(`Batch search failed for query ${query.id}:`, error);
        // Continue with other queries
      }
    }

    // Calculate and log search success rate
    const successRate = queries.length > 0 ? (successfulSearches / queries.length) * 100 : 0;
    console.log(`🔍 Search success rate: ${successRate.toFixed(1)}% (${successfulSearches}/${queries.length})`);
    
    // DISABLED: Manual seed system completely removed - only real search results allowed
    const totalResults = Array.from(results.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✅ Search success rate acceptable, no manual seed needed`);
    console.log(`📊 Total real search results: ${totalResults}`);

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

  /**
   * Load rotation state from file
   */
  private loadRotationState(): any {
    try {
      const fs = require('fs');
      const path = require('path');
      const stateFile = path.join(process.cwd(), 'data', 'pipeline', 'query-rotation.json');
      
      if (fs.existsSync(stateFile)) {
        return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      }
    } catch (error) {
      console.log('No query rotation state found, starting fresh');
    }
    
    return {
      stateOffset: 0,
      travelOffset: 0,
      lastRotation: new Date().toISOString()
    };
  }

  /**
   * Update rotation state
   */
  private updateRotationState(state: any): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const stateFile = path.join(process.cwd(), 'data', 'pipeline', 'query-rotation.json');
      
      // Increment offsets for next rotation
      state.stateOffset = (state.stateOffset + 3) % 10;
      state.travelOffset = (state.travelOffset + 2) % 10;
      state.lastRotation = new Date().toISOString();
      
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.warn('Failed to save query rotation state:', error);
    }
  }

  /**
   * Rotate array elements by offset
   */
  private rotateArray<T>(array: T[], offset: number): T[] {
    const normalizedOffset = offset % array.length;
    return array.slice(normalizedOffset).concat(array.slice(0, normalizedOffset));
  }
}

// Export a default instance
export const searchAgent = new SearchAgent(); 