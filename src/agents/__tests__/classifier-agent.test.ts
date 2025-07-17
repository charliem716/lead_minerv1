import { classifierAgent, ClassifierAgent, ClassificationResult } from '../classifier-agent';
import { ScrapedContent } from '../../types';

// Mock the config
jest.mock('../../config', () => ({
  config: {
    precision: {
      confidenceThreshold: 0.85
    }
  }
}));

describe('ClassifierAgent', () => {
  let agent: ClassifierAgent;
  
  beforeEach(() => {
    agent = new ClassifierAgent();
  });

  describe('classifyContent', () => {
    it('should classify relevant nonprofit travel auction content', async () => {
      const content: ScrapedContent = {
        id: 'test-1',
        url: 'https://example.org/auction',
        title: 'St. Mary\'s Charity Travel Auction Gala',
        content: 'Join us for our annual charity auction featuring amazing travel packages including trips to Hawaii, Europe cruise, and mountain resort getaways. All proceeds benefit our nonprofit organization.',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '<html>...</html>',
        statusCode: 200,
        eventInfo: {
          title: 'Annual Travel Auction',
          date: '2025-05-15',
          description: 'Charity auction with travel packages'
        },
        contactInfo: {
          emails: ['info@stmarys.org'],
          phones: ['555-123-4567'],
          address: '123 Main St, Springfield, IL'
        },
        organizationInfo: {
          name: 'St. Mary\'s Charity Foundation',
          ein: '12-3456789',
          mission: 'Supporting community through charitable work'
        }
      };

      const result = await agent.classifyContent(content);

      expect(result.isRelevant).toBe(true);
      expect(result.hasAuctionKeywords).toBe(true);
      expect(result.hasTravelKeywords).toBe(true);
      expect(result.isNonprofit).toBe(true);
      expect(result.confidenceScore).toBeGreaterThan(0.8);
      expect(result.modelUsed).toBe('o4-mini');
      expect(result.keywordMatches.auction).toContain('auction');
      expect(result.keywordMatches.travel).toContain('travel');
      expect(result.keywordMatches.nonprofit).toContain('charity');
    });

    it('should classify commercial travel site as not relevant', async () => {
      const content: ScrapedContent = {
        id: 'test-2',
        url: 'https://traveldeals.com/booking',
        title: 'Best Travel Deals - Book Your Flight Now',
        content: 'Find the cheapest flights and hotel packages. Commercial travel booking site with competitive prices.',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '<html>...</html>',
        statusCode: 200
      };

      const result = await agent.classifyContent(content);

      expect(result.isRelevant).toBe(false);
      expect(result.hasTravelKeywords).toBe(true);
      expect(result.hasAuctionKeywords).toBe(false);
      expect(result.isNonprofit).toBe(false);
      expect(result.confidenceScore).toBeLessThan(0.5);
    });

    it('should classify school raffle without travel as not relevant', async () => {
      const content: ScrapedContent = {
        id: 'test-3',
        url: 'https://school.edu/raffle',
        title: 'Elementary School Raffle - Win Gift Cards',
        content: 'Join our school raffle to win gift cards to local restaurants and stores. Raffle tickets available at the school office.',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '<html>...</html>',
        statusCode: 200,
        eventInfo: {
          title: 'School Raffle',
          date: '2025-04-20',
          description: 'Gift card raffle'
        },
        contactInfo: {
          emails: ['office@school.edu'],
          phones: ['555-987-6543']
        },
        organizationInfo: {
          name: 'Springfield Elementary School',
          mission: 'Educational excellence for all students'
        }
      };

      const result = await agent.classifyContent(content);

      expect(result.isRelevant).toBe(false);
      expect(result.hasAuctionKeywords).toBe(true);
      expect(result.hasTravelKeywords).toBe(false);
      expect(result.confidenceScore).toBeLessThan(0.5);
    });

    it('should handle classification errors gracefully', async () => {
      const content: ScrapedContent = {
        id: 'test-error',
        url: 'https://invalid.com',
        title: '',
        content: '',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '',
        statusCode: 500
      };

      // Mock the OpenAI client to throw an error
      const originalClient = (agent as any).openaiClient;
      (agent as any).openaiClient = {
        chat: {
          completions: {
            create: async () => {
              throw new Error('API Error');
            }
          }
        }
      };

      const result = await agent.classifyContent(content);

      expect(result.isRelevant).toBe(false);
      expect(result.confidenceScore).toBe(0);
      expect(result.reviewFlag).toBe(true);
      expect(result.error).toContain('Classification failed');

      // Restore original client
      (agent as any).openaiClient = originalClient;
    });
  });

  describe('classifyBatch', () => {
    it('should classify multiple content items', async () => {
      const contents: ScrapedContent[] = [
        {
          id: 'batch-1',
          url: 'https://charity1.org/auction',
          title: 'Charity Travel Auction',
          content: 'Travel packages auction for nonprofit fundraising',
          images: [],
          scrapedAt: new Date(),
          processingStatus: 'pending',
          rawHtml: '<html>...</html>',
          statusCode: 200
        },
        {
          id: 'batch-2',
          url: 'https://commercial.com/travel',
          title: 'Commercial Travel Site',
          content: 'Book your next vacation with us',
          images: [],
          scrapedAt: new Date(),
          processingStatus: 'pending',
          rawHtml: '<html>...</html>',
          statusCode: 200
        }
      ];

      const results = await agent.classifyBatch(contents);

      expect(results).toHaveLength(2);
      expect(results[0]?.isRelevant).toBe(true);
      expect(results[1]?.isRelevant).toBe(false);
    });
  });

  describe('getClassificationStats', () => {
    it('should calculate correct statistics', () => {
      const results: ClassificationResult[] = [
        {
          id: 'stat-1',
          isRelevant: true,
          confidenceScore: 0.9,
          hasAuctionKeywords: true,
          hasTravelKeywords: true,
          isNonprofit: true,
          reasoning: 'Test',
          keywordMatches: { auction: [], travel: [], nonprofit: [] },
          dateRelevance: true,
          geographicRelevance: true,
          selfConsistencyScore: 0.8,
          modelUsed: 'o4-mini',
          classifiedAt: new Date(),
          reviewFlag: false
        },
        {
          id: 'stat-2',
          isRelevant: false,
          confidenceScore: 0.2,
          hasAuctionKeywords: false,
          hasTravelKeywords: true,
          isNonprofit: false,
          reasoning: 'Test',
          keywordMatches: { auction: [], travel: [], nonprofit: [] },
          dateRelevance: true,
          geographicRelevance: true,
          selfConsistencyScore: 0.9,
          modelUsed: 'o4-mini',
          classifiedAt: new Date(),
          reviewFlag: false
        },
        {
          id: 'stat-3',
          isRelevant: true,
          confidenceScore: 0.7,
          hasAuctionKeywords: true,
          hasTravelKeywords: true,
          isNonprofit: true,
          reasoning: 'Test',
          keywordMatches: { auction: [], travel: [], nonprofit: [] },
          dateRelevance: true,
          geographicRelevance: true,
          selfConsistencyScore: 0.6,
          modelUsed: 'o4-mini',
          classifiedAt: new Date(),
          reviewFlag: true
        }
      ];

      const stats = agent.getClassificationStats(results);

      expect(stats.total).toBe(3);
      expect(stats.relevant).toBe(2);
      expect(stats.irrelevant).toBe(1);
      expect(stats.needsReview).toBe(1);
      expect(stats.averageConfidence).toBe(0.8); // (0.9 + 0.7) / 2
      expect(stats.averageConsistency).toBe(0.7667); // (0.8 + 0.9 + 0.6) / 3
    });
  });

  describe('filterByConfidence', () => {
    it('should filter results by confidence threshold', () => {
      const results: ClassificationResult[] = [
        {
          id: 'filter-1',
          isRelevant: true,
          confidenceScore: 0.9,
          hasAuctionKeywords: true,
          hasTravelKeywords: true,
          isNonprofit: true,
          reasoning: 'Test',
          keywordMatches: { auction: [], travel: [], nonprofit: [] },
          dateRelevance: true,
          geographicRelevance: true,
          selfConsistencyScore: 0.8,
          modelUsed: 'o4-mini',
          classifiedAt: new Date(),
          reviewFlag: false
        },
        {
          id: 'filter-2',
          isRelevant: true,
          confidenceScore: 0.7,
          hasAuctionKeywords: true,
          hasTravelKeywords: true,
          isNonprofit: true,
          reasoning: 'Test',
          keywordMatches: { auction: [], travel: [], nonprofit: [] },
          dateRelevance: true,
          geographicRelevance: true,
          selfConsistencyScore: 0.8,
          modelUsed: 'o4-mini',
          classifiedAt: new Date(),
          reviewFlag: false
        }
      ];

      const filtered = agent.filterByConfidence(results);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.confidenceScore).toBe(0.9);
    });
  });

  describe('keyword enhancement', () => {
    it('should enhance keyword detection with additional patterns', async () => {
      const content: ScrapedContent = {
        id: 'keyword-test',
        url: 'https://example.org/silent-auction',
        title: 'Silent Auction Fundraiser - Cruise Getaway Prize',
        content: 'Join our silent auction fundraiser featuring a luxury cruise getaway to the Caribbean. This 501(c)(3) nonprofit organization raises funds for community programs.',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '<html>...</html>',
        statusCode: 200
      };

      const result = await agent.classifyContent(content);

      expect(result.keywordMatches.auction).toContain('auction');
      expect(result.keywordMatches.travel).toContain('cruise');
      expect(result.keywordMatches.nonprofit).toContain('501(c)(3)');
    });
  });

  describe('self-consistency check', () => {
    it('should perform consistency validation', async () => {
      const content: ScrapedContent = {
        id: 'consistency-test',
        url: 'https://example.org/auction',
        title: 'Charity Travel Auction',
        content: 'Travel auction for nonprofit fundraising',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '<html>...</html>',
        statusCode: 200
      };

      const result = await agent.classifyContent(content);

      expect(result.selfConsistencyScore).toBeGreaterThan(0);
      expect(result.selfConsistencyScore).toBeLessThanOrEqual(1);
    });
  });

  describe('human review flag', () => {
    it('should flag borderline confidence for human review', async () => {
      const content: ScrapedContent = {
        id: 'review-test',
        url: 'https://example.org/event',
        title: 'School Fundraiser Event',
        content: 'Join us for our fundraising event',
        images: [],
        scrapedAt: new Date(),
        processingStatus: 'pending',
        rawHtml: '<html>...</html>',
        statusCode: 200
      };

      const result = await agent.classifyContent(content);

      // Since this has limited keywords, it should have low confidence
      // and potentially be flagged for review
      expect(result.reviewFlag).toBeDefined();
    });
  });
});

describe('ClassifierAgent Integration', () => {
  it('should work with the singleton instance', () => {
    expect(classifierAgent).toBeInstanceOf(ClassifierAgent);
  });

  it('should have proper configuration', () => {
    expect((classifierAgent as any).confidenceThreshold).toBe(0.85);
  });
}); 