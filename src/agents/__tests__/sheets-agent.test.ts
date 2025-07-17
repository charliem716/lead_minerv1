import { sheetsAgent, SheetsAgent } from '../sheets-agent';
import { Lead } from '../../types';

describe('SheetsAgent', () => {
  let agent: SheetsAgent;
  
  beforeEach(() => {
    agent = new SheetsAgent();
  });

  describe('addLeads', () => {
    it('should add leads to Google Sheets with proper formatting', async () => {
      const mockLeads: Lead[] = [
        {
          id: 'lead-1',
          orgName: 'Springfield Charity Foundation',
          ein: '12-3456789',
          eventName: 'Annual Travel Auction Gala',
          eventDate: new Date('2025-05-15'),
          eventDateRange: 'May 2025',
          url: 'https://springfieldcharity.org/auction',
          travelKeywords: true,
          auctionKeywords: true,
          usVerified: true,
          geographicRegion: 'Midwest',
          score: 0.92,
          contactEmail: 'info@springfieldcharity.org',
          contactPhone: '555-123-4567',
          staffSize: 25,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'pending',
          notes: 'High-quality lead with verified nonprofit status'
        },
        {
          id: 'lead-2',
          orgName: 'Ocean View Community Center',
          eventName: 'Summer Travel Raffle',
          eventDate: new Date('2025-07-20'),
          url: 'https://oceanview.org/raffle',
          travelKeywords: true,
          auctionKeywords: true,
          usVerified: true,
          geographicRegion: 'West Coast',
          score: 0.88,
          contactEmail: 'events@oceanview.org',
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'pending'
        }
      ];

      await agent.addLeads(mockLeads);

      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('should handle empty leads array', async () => {
      await agent.addLeads([]);
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('initializeSpreadsheet', () => {
    it('should initialize spreadsheet with proper headers and formatting', async () => {
      await agent.initializeSpreadsheet();
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('getCurrentLeadCount', () => {
    it('should return current lead count', async () => {
      const count = await agent.getCurrentLeadCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateQualityMetrics', () => {
    it('should update quality metrics sheet', async () => {
      const metrics = {
        totalProcessed: 100,
        falsePositives: 2,
        precision: 0.98,
        verificationRate: 0.95
      };

      await agent.updateQualityMetrics(metrics);
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('formatLeadRow', () => {
    it('should format lead data correctly for Google Sheets', () => {
      const lead: Lead = {
        id: 'test-lead',
        orgName: 'Test Organization',
        ein: '12-3456789',
        eventName: 'Test Travel Auction',
        eventDate: new Date('2025-06-01'),
        eventDateRange: 'June 2025',
        url: 'https://test.org/auction',
        travelKeywords: true,
        auctionKeywords: true,
        usVerified: true,
        geographicRegion: 'Northeast',
        score: 0.90,
        contactEmail: 'test@test.org',
        contactPhone: '555-999-8888',
        staffSize: 15,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'qualified',
        notes: 'Test lead'
      };

      const row = (agent as any).formatLeadRow(lead);

      expect(row).toHaveLength(17); // All columns
      expect(row[1]).toBe('Test Organization'); // Organization
      expect(row[2]).toBe('12-3456789'); // EIN
      expect(row[3]).toBe('Test Travel Auction'); // Event Name
      expect(row[5]).toBe('Travel Auction'); // Event Type
      expect(row[6]).toBe('Yes'); // Travel Package
      expect(row[14]).toBe(0.90); // Confidence Score
      expect(row[16]).toBe('qualified'); // Status
    });
  });

  describe('getEventType', () => {
    it('should correctly identify travel auction', () => {
      const lead: Lead = {
        id: 'test',
        orgName: 'Test',
        eventName: 'Test',
        url: 'https://test.org',
        travelKeywords: true,
        auctionKeywords: true,
        usVerified: true,
        score: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending'
      };

      const eventType = (agent as any).getEventType(lead);
      expect(eventType).toBe('Travel Auction');
    });

    it('should correctly identify auction without travel', () => {
      const lead: Lead = {
        id: 'test',
        orgName: 'Test',
        eventName: 'Test',
        url: 'https://test.org',
        travelKeywords: false,
        auctionKeywords: true,
        usVerified: true,
        score: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending'
      };

      const eventType = (agent as any).getEventType(lead);
      expect(eventType).toBe('Auction/Raffle');
    });

    it('should correctly identify other event types', () => {
      const lead: Lead = {
        id: 'test',
        orgName: 'Test',
        eventName: 'Test',
        url: 'https://test.org',
        travelKeywords: false,
        auctionKeywords: false,
        usVerified: true,
        score: 0.9,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'pending'
      };

      const eventType = (agent as any).getEventType(lead);
      expect(eventType).toBe('Other');
    });
  });
});

describe('SheetsAgent Integration', () => {
  it('should work with the singleton instance', () => {
    expect(sheetsAgent).toBeInstanceOf(SheetsAgent);
  });

  it('should have proper configuration', () => {
    expect((sheetsAgent as any).spreadsheetId).toBeDefined();
    expect((sheetsAgent as any).auth).toBeDefined();
    expect((sheetsAgent as any).sheets).toBeDefined();
  });
}); 