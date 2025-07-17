import { SearchAgent } from '../search-agent';
import { SearchQuery } from '../../types';
import { config } from '../../config';

// Mock serpapi module
jest.mock('serpapi', () => ({
  getJson: jest.fn(),
  SerpApiParams: {},
  SerpApiResponse: {}
}));

describe('SearchAgent', () => {
  let searchAgent: SearchAgent;
  const mockGetJson = require('serpapi').getJson;

  beforeEach(() => {
    jest.clearAllMocks();
    searchAgent = new SearchAgent();
  });

  describe('generateSearchQueries', () => {
    it('should generate search queries with monthly date ranges', () => {
      const queries = searchAgent.generateSearchQueries();
      
      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toHaveProperty('id');
      expect(queries[0]).toHaveProperty('query');
      expect(queries[0]).toHaveProperty('dateRange');
      expect(queries[0]).toHaveProperty('geographic');
      expect(queries[0]).toHaveProperty('status', 'pending');
    });

    it('should include configured months in search queries', () => {
      const queries = searchAgent.generateSearchQueries();
      const monthQueries = queries.filter(q => config.dateRanges.searchMonths.includes(q.dateRange));
      
      expect(monthQueries.length).toBeGreaterThan(0);
    });

    it('should include configured quarters in search queries', () => {
      const queries = searchAgent.generateSearchQueries();
      const quarterQueries = queries.filter(q => config.dateRanges.searchQuarters.includes(q.dateRange));
      
      expect(quarterQueries.length).toBeGreaterThan(0);
    });

    it('should generate queries with nonprofit keywords', () => {
      const queries = searchAgent.generateSearchQueries();
      
      queries.forEach(query => {
        expect(query.query).toContain('nonprofit');
      });
    });
  });

  describe('executeSearch', () => {
    it('should execute search successfully with valid query', async () => {
      const mockResponse = {
        organic_results: [
          {
            title: 'Test Nonprofit Travel Auction',
            snippet: 'Annual charity travel auction event',
            link: 'https://example.org/auction'
          }
        ],
        search_metadata: {
          id: 'test-id',
          status: 'Success',
          created_at: '2025-01-01T00:00:00Z',
          processed_at: '2025-01-01T00:00:01Z'
        }
      };

      mockGetJson.mockResolvedValue(mockResponse);

      const searchQuery: SearchQuery = {
        id: 'test-query',
        query: 'nonprofit travel auction March 2025',
        dateRange: 'March',
        geographic: 'US',
        createdAt: new Date(),
        resultsCount: 0,
        status: 'pending'
      };

      const results = await searchAgent.executeSearch(searchQuery);

      expect(mockGetJson).toHaveBeenCalledWith({
        q: 'nonprofit travel auction March 2025',
        engine: 'google',
        api_key: config.apis.serpapi.apiKey,
        num: 10,
        gl: 'us',
        hl: 'en',
        safe: 'active'
      });

      expect(results).toEqual(mockResponse.organic_results);
      expect(searchQuery.status).toBe('completed');
      expect(searchQuery.resultsCount).toBe(1);
    });

    it('should handle search failures gracefully', async () => {
      mockGetJson.mockRejectedValue(new Error('API Error'));

      const searchQuery: SearchQuery = {
        id: 'test-query',
        query: 'nonprofit travel auction',
        dateRange: 'March',
        geographic: 'US',
        createdAt: new Date(),
        resultsCount: 0,
        status: 'pending'
      };

      await expect(searchAgent.executeSearch(searchQuery)).rejects.toThrow('API Error');
      expect(searchQuery.status).toBe('failed');
    });

    it('should respect daily search limit', async () => {
      // Set up agent with reached limit
      for (let i = 0; i < config.limits.maxSearchQueries; i++) {
        mockGetJson.mockResolvedValue({ organic_results: [] });
        await searchAgent.executeSearch({
          id: `query-${i}`,
          query: 'test',
          dateRange: 'March',
          geographic: 'US',
          createdAt: new Date(),
          resultsCount: 0,
          status: 'pending'
        });
      }

      const searchQuery: SearchQuery = {
        id: 'limit-test',
        query: 'should fail',
        dateRange: 'March',
        geographic: 'US',
        createdAt: new Date(),
        resultsCount: 0,
        status: 'pending'
      };

      await expect(searchAgent.executeSearch(searchQuery)).rejects.toThrow('Daily search limit');
    });
  });

  describe('executeBatchSearch', () => {
    it('should execute multiple searches with rate limiting', async () => {
      const mockResponse = {
        organic_results: [{ title: 'Test Result' }],
        search_metadata: { id: 'test-id' }
      };

      mockGetJson.mockResolvedValue(mockResponse);

      const queries: SearchQuery[] = [
        {
          id: 'query1',
          query: 'nonprofit travel auction March',
          dateRange: 'March',
          geographic: 'US',
          createdAt: new Date(),
          resultsCount: 0,
          status: 'pending'
        },
        {
          id: 'query2',
          query: 'charity travel raffle April',
          dateRange: 'April',
          geographic: 'US',
          createdAt: new Date(),
          resultsCount: 0,
          status: 'pending'
        }
      ];

      const results = await searchAgent.executeBatchSearch(queries);

      expect(results.size).toBe(2);
      expect(results.get('query1')).toEqual(mockResponse.organic_results);
      expect(results.get('query2')).toEqual(mockResponse.organic_results);
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
        title: 'New York Fundraising Event',
        snippet: 'Travel packages available in NYC',
        displayed_link: 'nynonprofit.org'
      },
      {
        title: 'Alaska Wildlife Foundation',
        snippet: 'Travel auction in Anchorage, AK',
        displayed_link: 'alaskawildlife.org'
      }
    ];

    it('should filter results by target states', () => {
      // Mock config for California targeting
      const originalStates = config.geographic.states;
      config.geographic.states = ['CA'];

      const filtered = searchAgent.filterByGeography(mockResults);

      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toContain('California');

      // Restore original config
      config.geographic.states = originalStates;
    });

    it('should exclude results from excluded states', () => {
      // Mock config with Alaska excluded
      const originalStates = config.geographic.states;
      const originalExcluded = config.geographic.excludeStates;
      
      config.geographic.states = ['CA', 'NY', 'AK'];
      config.geographic.excludeStates = ['AK'];

      const filtered = searchAgent.filterByGeography(mockResults);

      expect(filtered.length).toBe(2);
      expect(filtered.some(r => r.title.includes('Alaska'))).toBe(false);

      // Restore original config
      config.geographic.states = originalStates;
      config.geographic.excludeStates = originalExcluded;
    });

    it('should return all results when no geographic filtering is configured', () => {
      const originalStates = config.geographic.states;
      config.geographic.states = [];

      const filtered = searchAgent.filterByGeography(mockResults);

      expect(filtered.length).toBe(3);

      // Restore original config
      config.geographic.states = originalStates;
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const stats = searchAgent.getStats();

      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('dailyLimit');
      expect(stats).toHaveProperty('remainingRequests');
      expect(stats.requestCount).toBe(0);
      expect(stats.dailyLimit).toBe(config.limits.maxSearchQueries);
      expect(stats.remainingRequests).toBe(config.limits.maxSearchQueries);
    });
  });

  describe('resetDailyCount', () => {
    it('should reset request count to zero', () => {
      searchAgent.resetDailyCount();
      const stats = searchAgent.getStats();

      expect(stats.requestCount).toBe(0);
    });
  });
}); 