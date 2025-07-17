import { config } from '../config';

/**
 * Geographic Filtering Utility for Lead Miner
 * Handles state mapping, region filtering, and location validation
 */
export class GeoFilter {
  private stateAbbreviations: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming'
  };

  private regionMapping: Record<string, string[]> = {
    'Northeast': ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
    'Southeast': ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
    'Midwest': ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
    'Southwest': ['AZ', 'NM', 'OK', 'TX'],
    'West': ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
    'Mountain': ['AZ', 'CO', 'ID', 'MT', 'NV', 'NM', 'UT', 'WY'],
    'Pacific': ['AK', 'CA', 'HI', 'OR', 'WA'],
    'Great Lakes': ['IL', 'IN', 'MI', 'MN', 'NY', 'OH', 'PA', 'WI'],
    'South': ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
    'West Coast': ['CA', 'OR', 'WA'],
    'East Coast': ['CT', 'DE', 'FL', 'GA', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'NC', 'RI', 'SC', 'VA']
  };

  private majorCities: Record<string, string> = {
    'New York': 'NY', 'Los Angeles': 'CA', 'Chicago': 'IL', 'Houston': 'TX',
    'Phoenix': 'AZ', 'Philadelphia': 'PA', 'San Antonio': 'TX', 'San Diego': 'CA',
    'Dallas': 'TX', 'San Jose': 'CA', 'Austin': 'TX', 'Jacksonville': 'FL',
    'Fort Worth': 'TX', 'Columbus': 'OH', 'Charlotte': 'NC', 'San Francisco': 'CA',
    'Indianapolis': 'IN', 'Seattle': 'WA', 'Denver': 'CO', 'Washington': 'DC',
    'Boston': 'MA', 'El Paso': 'TX', 'Nashville': 'TN', 'Detroit': 'MI',
    'Oklahoma City': 'OK', 'Portland': 'OR', 'Las Vegas': 'NV', 'Memphis': 'TN',
    'Louisville': 'KY', 'Baltimore': 'MD', 'Milwaukee': 'WI', 'Albuquerque': 'NM',
    'Tucson': 'AZ', 'Fresno': 'CA', 'Sacramento': 'CA', 'Kansas City': 'MO',
    'Mesa': 'AZ', 'Atlanta': 'GA', 'Colorado Springs': 'CO', 'Omaha': 'NE',
    'Raleigh': 'NC', 'Miami': 'FL', 'Oakland': 'CA', 'Minneapolis': 'MN',
    'Tulsa': 'OK', 'Cleveland': 'OH', 'Wichita': 'KS', 'Arlington': 'TX',
    'Tampa': 'FL', 'New Orleans': 'LA', 'Honolulu': 'HI', 'Anaheim': 'CA',
    'Aurora': 'CO', 'Santa Ana': 'CA', 'St. Louis': 'MO', 'Riverside': 'CA',
    'Corpus Christi': 'TX', 'Lexington': 'KY', 'Pittsburgh': 'PA', 'Anchorage': 'AK',
    'Stockton': 'CA', 'Cincinnati': 'OH', 'Saint Paul': 'MN', 'Toledo': 'OH',
    'Greensboro': 'NC', 'Newark': 'NJ', 'Plano': 'TX', 'Henderson': 'NV',
    'Lincoln': 'NE', 'Buffalo': 'NY', 'Jersey City': 'NJ', 'Chula Vista': 'CA',
    'Fort Wayne': 'IN', 'Orlando': 'FL', 'St. Petersburg': 'FL', 'Chandler': 'AZ',
    'Laredo': 'TX', 'Norfolk': 'VA', 'Durham': 'NC', 'Madison': 'WI'
  };

  /**
   * Get full state name from abbreviation
   */
  getStateName(abbreviation: string): string {
    return this.stateAbbreviations[abbreviation.toUpperCase()] || abbreviation;
  }

  /**
   * Get state abbreviation from full name
   */
  getStateAbbreviation(stateName: string): string {
    const normalized = stateName.toLowerCase();
    for (const [abbr, fullName] of Object.entries(this.stateAbbreviations)) {
      if (fullName.toLowerCase() === normalized) {
        return abbr;
      }
    }
    return stateName;
  }

  /**
   * Get states for a given region
   */
  getStatesForRegion(region: string): string[] {
    return this.regionMapping[region] || [];
  }

  /**
   * Get all configured states (direct + from regions)
   */
  getAllConfiguredStates(): string[] {
    const allStates = new Set<string>();
    
    // Add direct state configurations
    config.geographic.states.forEach(state => {
      const abbr = this.getStateAbbreviation(state);
      allStates.add(abbr);
    });
    
    // Add states from regions
    config.geographic.regions.forEach(region => {
      const regionStates = this.getStatesForRegion(region);
      regionStates.forEach(state => allStates.add(state));
    });
    
    return Array.from(allStates);
  }

  /**
   * Check if a state should be included based on configuration
   */
  isStateIncluded(state: string): boolean {
    const stateAbbr = this.getStateAbbreviation(state).toUpperCase();
    const configuredStates = this.getAllConfiguredStates();
    const excludedStates = config.geographic.excludeStates.map(s => 
      this.getStateAbbreviation(s).toUpperCase()
    );
    
    // If no states configured, include all except excluded
    if (configuredStates.length === 0) {
      return !excludedStates.includes(stateAbbr);
    }
    
    // Check if state is in configured states and not excluded
    return configuredStates.includes(stateAbbr) && !excludedStates.includes(stateAbbr);
  }

  /**
   * Extract location information from text content
   */
  extractLocations(text: string): { states: string[]; cities: string[]; regions: string[] } {
    const normalizedText = text.toLowerCase();
    const locations = {
      states: [] as string[],
      cities: [] as string[],
      regions: [] as string[]
    };

    // Extract states
    for (const [abbr, fullName] of Object.entries(this.stateAbbreviations)) {
      if (normalizedText.includes(fullName.toLowerCase()) || 
          normalizedText.includes(abbr.toLowerCase())) {
        locations.states.push(abbr);
      }
    }

    // Extract cities
    for (const [city, stateAbbr] of Object.entries(this.majorCities)) {
      if (normalizedText.includes(city.toLowerCase())) {
        locations.cities.push(city);
        // Also add the state for the city
        if (!locations.states.includes(stateAbbr)) {
          locations.states.push(stateAbbr);
        }
      }
    }

    // Extract regions
    for (const region of Object.keys(this.regionMapping)) {
      if (normalizedText.includes(region.toLowerCase())) {
        locations.regions.push(region);
      }
    }

    return locations;
  }

  /**
   * Filter search results by geographic criteria
   */
  filterByGeography(results: any[]): any[] {
    const hasDirectStateConfig = config.geographic.states.length > 0;
    const hasRegionConfig = config.geographic.regions.length > 0;
    
    // If no geographic configuration, return all results
    if (!hasDirectStateConfig && !hasRegionConfig) {
      return results;
    }
    
    return results.filter(result => {
      const content = `${result.title} ${result.snippet} ${result.displayed_link}`;
      const locations = this.extractLocations(content);
      
      let matchesGeography = false;
      
      // Check direct states if configured
      if (hasDirectStateConfig) {
        const hasIncludedState = locations.states.some(state => {
          const stateAbbr = this.getStateAbbreviation(state).toUpperCase();
          const configuredStates = config.geographic.states.map(s => 
            this.getStateAbbreviation(s).toUpperCase()
          );
          const excludedStates = config.geographic.excludeStates.map(s => 
            this.getStateAbbreviation(s).toUpperCase()
          );
          return configuredStates.includes(stateAbbr) && !excludedStates.includes(stateAbbr);
        });
        matchesGeography = matchesGeography || hasIncludedState;
      }
      
      // Check regions if configured
      if (hasRegionConfig) {
        const hasIncludedRegion = locations.regions.some(region => 
          config.geographic.regions.includes(region)
        );
        matchesGeography = matchesGeography || hasIncludedRegion;
      }
      
      return matchesGeography;
    });
  }

  /**
   * Generate geographic search terms
   */
  generateGeoSearchTerms(baseKeyword: string): string[] {
    const terms: string[] = [];
    
    // Add terms for configured states
    const configuredStates = this.getAllConfiguredStates();
    configuredStates.forEach(stateAbbr => {
      const stateName = this.getStateName(stateAbbr);
      terms.push(`${baseKeyword} "${stateName}"`);
      terms.push(`${baseKeyword} "${stateAbbr}"`);
    });
    
    // Add terms for configured regions
    config.geographic.regions.forEach(region => {
      terms.push(`${baseKeyword} "${region}"`);
    });
    
    // Add terms for major cities in configured states
    configuredStates.forEach(stateAbbr => {
      for (const [city, cityState] of Object.entries(this.majorCities)) {
        if (cityState === stateAbbr) {
          terms.push(`${baseKeyword} "${city}"`);
        }
      }
    });
    
    return terms;
  }

  /**
   * Build geographic query filters for search
   */
  buildGeoQueryFilters(): string[] {
    const filters: string[] = [];
    
    const configuredStates = this.getAllConfiguredStates();
    
    if (configuredStates.length > 0) {
      // Add state-based filters
      const stateFilters = configuredStates.map(stateAbbr => {
        const stateName = this.getStateName(stateAbbr);
        return `("${stateName}" OR "${stateAbbr}")`;
      });
      filters.push(`(${stateFilters.join(' OR ')})`);
    }
    
    // Add region-based filters
    if (config.geographic.regions.length > 0) {
      const regionFilters = config.geographic.regions.map(region => 
        `"${region}"`
      );
      filters.push(`(${regionFilters.join(' OR ')})`);
    }
    
    // Add exclusion filters
    if (config.geographic.excludeStates.length > 0) {
      const excludeFilters = config.geographic.excludeStates.map(state => {
        const stateAbbr = this.getStateAbbreviation(state);
        const stateName = this.getStateName(stateAbbr);
        return `-"${stateName}" -"${stateAbbr}"`;
      });
      filters.push(...excludeFilters);
    }
    
    return filters;
  }

  /**
   * Get geographic statistics from results
   */
  getGeoStats(results: any[]): { states: Record<string, number>; regions: Record<string, number> } {
    const stats = {
      states: {} as Record<string, number>,
      regions: {} as Record<string, number>
    };
    
    results.forEach(result => {
      const content = `${result.title} ${result.snippet} ${result.displayed_link}`;
      const locations = this.extractLocations(content);
      
      // Count states
      locations.states.forEach(state => {
        stats.states[state] = (stats.states[state] || 0) + 1;
      });
      
      // Count regions
      locations.regions.forEach(region => {
        stats.regions[region] = (stats.regions[region] || 0) + 1;
      });
    });
    
    return stats;
  }

  /**
   * Validate geographic configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate states
    config.geographic.states.forEach(state => {
      const abbr = this.getStateAbbreviation(state);
      if (!this.stateAbbreviations[abbr.toUpperCase()]) {
        errors.push(`Invalid state: ${state}`);
      }
    });
    
    // Validate excluded states
    config.geographic.excludeStates.forEach(state => {
      const abbr = this.getStateAbbreviation(state);
      if (!this.stateAbbreviations[abbr.toUpperCase()]) {
        errors.push(`Invalid excluded state: ${state}`);
      }
    });
    
    // Validate regions
    config.geographic.regions.forEach(region => {
      if (!this.regionMapping[region]) {
        errors.push(`Invalid region: ${region}`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export a default instance
export const geoFilter = new GeoFilter(); 