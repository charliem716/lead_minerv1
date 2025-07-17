import { GeoFilter } from '../geo-filter';
import { config } from '../../config';

describe('GeoFilter', () => {
  let geoFilter: GeoFilter;

  beforeEach(() => {
    geoFilter = new GeoFilter();
  });

  describe('getStateName', () => {
    it('should return full state name from abbreviation', () => {
      expect(geoFilter.getStateName('CA')).toBe('California');
      expect(geoFilter.getStateName('NY')).toBe('New York');
      expect(geoFilter.getStateName('TX')).toBe('Texas');
    });

    it('should be case insensitive', () => {
      expect(geoFilter.getStateName('ca')).toBe('California');
      expect(geoFilter.getStateName('ny')).toBe('New York');
    });

    it('should return original input for invalid abbreviations', () => {
      expect(geoFilter.getStateName('XX')).toBe('XX');
      expect(geoFilter.getStateName('ZZ')).toBe('ZZ');
    });
  });

  describe('getStateAbbreviation', () => {
    it('should return abbreviation from full state name', () => {
      expect(geoFilter.getStateAbbreviation('California')).toBe('CA');
      expect(geoFilter.getStateAbbreviation('New York')).toBe('NY');
      expect(geoFilter.getStateAbbreviation('Texas')).toBe('TX');
    });

    it('should be case insensitive', () => {
      expect(geoFilter.getStateAbbreviation('california')).toBe('CA');
      expect(geoFilter.getStateAbbreviation('NEW YORK')).toBe('NY');
    });

    it('should return original input for invalid state names', () => {
      expect(geoFilter.getStateAbbreviation('Invalid State')).toBe('Invalid State');
    });
  });

  describe('getStatesForRegion', () => {
    it('should return correct states for Northeast region', () => {
      const states = geoFilter.getStatesForRegion('Northeast');
      expect(states).toContain('NY');
      expect(states).toContain('MA');
      expect(states).toContain('CT');
    });

    it('should return correct states for West Coast region', () => {
      const states = geoFilter.getStatesForRegion('West Coast');
      expect(states).toContain('CA');
      expect(states).toContain('OR');
      expect(states).toContain('WA');
    });

    it('should return empty array for invalid region', () => {
      const states = geoFilter.getStatesForRegion('Invalid Region');
      expect(states).toEqual([]);
    });
  });

  describe('getAllConfiguredStates', () => {
    it('should return empty array when no states configured', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = [];
      config.geographic.regions = [];
      
      const states = geoFilter.getAllConfiguredStates();
      expect(states).toEqual([]);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });

    it('should include direct state configurations', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = ['California', 'Texas'];
      config.geographic.regions = [];
      
      const states = geoFilter.getAllConfiguredStates();
      expect(states).toContain('CA');
      expect(states).toContain('TX');
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });

    it('should include states from regions', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = [];
      config.geographic.regions = ['West Coast'];
      
      const states = geoFilter.getAllConfiguredStates();
      expect(states).toContain('CA');
      expect(states).toContain('OR');
      expect(states).toContain('WA');
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });
  });

  describe('isStateIncluded', () => {
    it('should include all states when none configured', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      const originalExcluded = config.geographic.excludeStates;
      
      config.geographic.states = [];
      config.geographic.regions = [];
      config.geographic.excludeStates = [];
      
      expect(geoFilter.isStateIncluded('California')).toBe(true);
      expect(geoFilter.isStateIncluded('Texas')).toBe(true);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
      config.geographic.excludeStates = originalExcluded;
    });

    it('should exclude specifically excluded states', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      const originalExcluded = config.geographic.excludeStates;
      
      config.geographic.states = [];
      config.geographic.regions = [];
      config.geographic.excludeStates = ['AK', 'HI'];
      
      expect(geoFilter.isStateIncluded('Alaska')).toBe(false);
      expect(geoFilter.isStateIncluded('Hawaii')).toBe(false);
      expect(geoFilter.isStateIncluded('California')).toBe(true);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
      config.geographic.excludeStates = originalExcluded;
    });

    it('should only include configured states', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      const originalExcluded = config.geographic.excludeStates;
      
      config.geographic.states = ['CA', 'TX'];
      config.geographic.regions = [];
      config.geographic.excludeStates = [];
      
      expect(geoFilter.isStateIncluded('California')).toBe(true);
      expect(geoFilter.isStateIncluded('Texas')).toBe(true);
      expect(geoFilter.isStateIncluded('New York')).toBe(false);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
      config.geographic.excludeStates = originalExcluded;
    });
  });

  describe('extractLocations', () => {
    it('should extract states from text', () => {
      const text = 'Annual charity auction in California and Texas';
      const locations = geoFilter.extractLocations(text);
      
      expect(locations.states).toContain('CA');
      expect(locations.states).toContain('TX');
    });

    it('should extract states from abbreviations', () => {
      const text = 'Event happening in CA, NY, and FL';
      const locations = geoFilter.extractLocations(text);
      
      expect(locations.states).toContain('CA');
      expect(locations.states).toContain('NY');
      expect(locations.states).toContain('FL');
    });

    it('should extract cities and their states', () => {
      const text = 'Fundraiser in San Francisco and Austin';
      const locations = geoFilter.extractLocations(text);
      
      expect(locations.cities).toContain('San Francisco');
      expect(locations.cities).toContain('Austin');
      expect(locations.states).toContain('CA'); // San Francisco -> CA
      expect(locations.states).toContain('TX'); // Austin -> TX
    });

    it('should extract regions from text', () => {
      const text = 'Travel auction across the Northeast and West Coast';
      const locations = geoFilter.extractLocations(text);
      
      expect(locations.regions).toContain('Northeast');
      expect(locations.regions).toContain('West Coast');
    });

    it('should handle mixed case text', () => {
      const text = 'Event in CALIFORNIA and new york';
      const locations = geoFilter.extractLocations(text);
      
      expect(locations.states).toContain('CA');
      expect(locations.states).toContain('NY');
    });
  });

  describe('filterByGeography', () => {
    const mockResults = [
      {
        title: 'California Nonprofit Travel Auction',
        snippet: 'Annual charity auction in Los Angeles, CA',
        displayed_link: 'californiacharity.org'
      },
      {
        title: 'Texas Fundraising Event',
        snippet: 'Travel packages available in Houston, TX',
        displayed_link: 'texasnonprofit.org'
      },
      {
        title: 'Florida Charity Raffle',
        snippet: 'Miami travel auction event',
        displayed_link: 'floridacharity.org'
      },
      {
        title: 'Northeast Regional Auction',
        snippet: 'Multi-state charity event',
        displayed_link: 'northeastcharity.org'
      }
    ];

    it('should filter results by configured states', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = ['CA', 'TX'];
      config.geographic.regions = [];
      
      const filtered = geoFilter.filterByGeography(mockResults);
      
      expect(filtered.length).toBe(2);
      expect(filtered.some(r => r.title.includes('California'))).toBe(true);
      expect(filtered.some(r => r.title.includes('Texas'))).toBe(true);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });

    it('should filter results by configured regions', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = [];
      config.geographic.regions = ['Northeast'];
      
      const filtered = geoFilter.filterByGeography(mockResults);
      
      expect(filtered.length).toBe(1);
      expect(filtered.some(r => r.title.includes('Northeast'))).toBe(true);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });
  });

  describe('generateGeoSearchTerms', () => {
    it('should generate terms for configured states', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = ['CA'];
      config.geographic.regions = [];
      
      const terms = geoFilter.generateGeoSearchTerms('nonprofit auction');
      
      expect(terms).toContain('nonprofit auction "California"');
      expect(terms).toContain('nonprofit auction "CA"');
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });

    it('should generate terms for configured regions', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = [];
      config.geographic.regions = ['Northeast'];
      
      const terms = geoFilter.generateGeoSearchTerms('charity raffle');
      
      expect(terms).toContain('charity raffle "Northeast"');
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });

    it('should generate terms for major cities', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      
      config.geographic.states = ['CA'];
      config.geographic.regions = [];
      
      const terms = geoFilter.generateGeoSearchTerms('travel auction');
      
      expect(terms).toContain('travel auction "Los Angeles"');
      expect(terms).toContain('travel auction "San Francisco"');
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
    });
  });

  describe('buildGeoQueryFilters', () => {
    it('should build filters for configured states', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      const originalExcluded = config.geographic.excludeStates;
      
      config.geographic.states = ['CA', 'TX'];
      config.geographic.regions = [];
      config.geographic.excludeStates = [];
      
      const filters = geoFilter.buildGeoQueryFilters();
      
      expect(filters.length).toBeGreaterThan(0);
      expect(filters[0]).toContain('California');
      expect(filters[0]).toContain('Texas');
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
      config.geographic.excludeStates = originalExcluded;
    });

    it('should build exclusion filters', () => {
      const originalStates = config.geographic.states;
      const originalRegions = config.geographic.regions;
      const originalExcluded = config.geographic.excludeStates;
      
      config.geographic.states = [];
      config.geographic.regions = [];
      config.geographic.excludeStates = ['AK', 'HI'];
      
      const filters = geoFilter.buildGeoQueryFilters();
      
      expect(filters.some(f => f.includes('-"Alaska"'))).toBe(true);
      expect(filters.some(f => f.includes('-"Hawaii"'))).toBe(true);
      
      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.regions = originalRegions;
      config.geographic.excludeStates = originalExcluded;
    });
  });

  describe('getGeoStats', () => {
    const mockResults = [
      {
        title: 'California Event',
        snippet: 'In Los Angeles, CA',
        displayed_link: 'example.com'
      },
      {
        title: 'Texas Event',
        snippet: 'In Houston, TX',
        displayed_link: 'example.com'
      },
      {
        title: 'Another California Event',
        snippet: 'In San Francisco, CA',
        displayed_link: 'example.com'
      }
    ];

    it('should count states correctly', () => {
      const stats = geoFilter.getGeoStats(mockResults);
      
      expect(stats.states['CA']).toBe(2);
      expect(stats.states['TX']).toBe(1);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = geoFilter.validateConfiguration();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid states', () => {
      const originalStates = config.geographic.states;
      config.geographic.states = ['InvalidState'];
      
      const result = geoFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid state: InvalidState');
      
      // Restore original config
      config.geographic.states = originalStates;
    });

    it('should detect invalid regions', () => {
      const originalRegions = config.geographic.regions;
      config.geographic.regions = ['InvalidRegion'];
      
      const result = geoFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid region: InvalidRegion');
      
      // Restore original config
      config.geographic.regions = originalRegions;
    });

    it('should detect invalid excluded states', () => {
      const originalExcluded = config.geographic.excludeStates;
      config.geographic.excludeStates = ['InvalidState'];
      
      const result = geoFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid excluded state: InvalidState');
      
      // Restore original config
      config.geographic.excludeStates = originalExcluded;
    });
  });
}); 