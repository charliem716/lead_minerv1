import { DateFilter } from '../date-filter';
import { config } from '../../config';

describe('DateFilter', () => {
  let dateFilter: DateFilter;

  beforeEach(() => {
    dateFilter = new DateFilter();
  });

  describe('getMonthsFromQuarters', () => {
    it('should return correct months for Q2 and Q4', () => {
      const months = dateFilter.getMonthsFromQuarters();
      
      expect(months).toContain('April');
      expect(months).toContain('May');
      expect(months).toContain('June');
      expect(months).toContain('October');
      expect(months).toContain('November');
      expect(months).toContain('December');
    });

    it('should not contain duplicates', () => {
      const months = dateFilter.getMonthsFromQuarters();
      const uniqueMonths = [...new Set(months)];
      
      expect(months.length).toBe(uniqueMonths.length);
    });
  });

  describe('getAllConfiguredMonths', () => {
    it('should include both direct months and quarter months', () => {
      const allMonths = dateFilter.getAllConfiguredMonths();
      
      // Should include direct months from config
      expect(allMonths).toContain('March');
      expect(allMonths).toContain('April');
      expect(allMonths).toContain('May');
      
      // Should include quarter months (Q2: April, May, June and Q4: October, November, December)
      expect(allMonths).toContain('October');
      expect(allMonths).toContain('November');
    });
  });

  describe('parseEventDate', () => {
    it('should parse standard date formats', () => {
      const testCases = [
        { input: 'March 15, 2025', expected: new Date(2025, 2, 15) },
        { input: 'March 15 2025', expected: new Date(2025, 2, 15) },
        { input: '15 March 2025', expected: new Date(2025, 2, 15) },
        { input: '03/15/2025', expected: new Date(2025, 2, 15) },
        { input: '03-15-2025', expected: new Date(2025, 2, 15) },
        { input: '2025-03-15', expected: new Date(2025, 2, 15) },
        { input: 'March 2025', expected: new Date(2025, 2, 1) },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = dateFilter.parseEventDate(input);
        expect(result).toEqual(expected);
      });
    });

         it('should handle invalid date strings', () => {
       const invalidDates = [
         '',
         'invalid date',
         'not a date',
         '99/99/9999',
         'February 30, 2025',
         '13/15/2025', // Invalid month
         '12/32/2025'  // Invalid day
       ];

       invalidDates.forEach(invalid => {
         const result = dateFilter.parseEventDate(invalid);
         expect(result).toBeNull();
       });
     });

    it('should handle abbreviations', () => {
      const result = dateFilter.parseEventDate('Mar 15, 2025');
      expect(result).toEqual(new Date(2025, 2, 15));
    });
  });

  describe('isValidEventDate', () => {
    it('should return true when no event date range is configured', () => {
      const originalRange = config.dateRanges.eventDateRange;
      config.dateRanges.eventDateRange = '';
      
      const testDate = new Date(2025, 0, 1);
      const result = dateFilter.isValidEventDate(testDate);
      
      expect(result).toBe(true);
      
      // Restore original config
      config.dateRanges.eventDateRange = originalRange;
    });

    it('should validate dates within configured range', () => {
      const originalRange = config.dateRanges.eventDateRange;
      config.dateRanges.eventDateRange = '2025-03-01 to 2025-12-31';
      
      // Valid dates
      expect(dateFilter.isValidEventDate(new Date(2025, 2, 15))).toBe(true);
      expect(dateFilter.isValidEventDate(new Date(2025, 11, 30))).toBe(true);
      
      // Invalid dates
      expect(dateFilter.isValidEventDate(new Date(2025, 1, 15))).toBe(false);
      expect(dateFilter.isValidEventDate(new Date(2026, 0, 1))).toBe(false);
      
      // Restore original config
      config.dateRanges.eventDateRange = originalRange;
    });
  });

  describe('isInConfiguredMonths', () => {
    it('should return true for configured months', () => {
      const marchDate = new Date(2025, 2, 15); // March 15, 2025
      const result = dateFilter.isInConfiguredMonths(marchDate);
      expect(result).toBe(true);
    });

    it('should return false for non-configured months', () => {
      const januaryDate = new Date(2025, 0, 15); // January 15, 2025
      const result = dateFilter.isInConfiguredMonths(januaryDate);
      expect(result).toBe(false);
    });

    it('should handle quarter months', () => {
      const aprilDate = new Date(2025, 3, 15); // April 15, 2025 (Q2)
      const result = dateFilter.isInConfiguredMonths(aprilDate);
      expect(result).toBe(true);
    });
  });

  describe('filterResultsByEventDate', () => {
    const mockResults = [
      {
        title: 'Annual Travel Auction - March 15, 2025',
        snippet: 'Join us for our charity travel auction',
        link: 'https://example.org/auction'
      },
      {
        title: 'Summer Fundraiser',
        snippet: 'July 2025 travel package raffle',
        link: 'https://example.org/summer'
      },
      {
        title: 'November Gala',
        snippet: 'Travel auction on November 20, 2025',
        link: 'https://example.org/gala'
      },
      {
        title: 'Regular Meeting',
        snippet: 'Monthly meeting with no specific date',
        link: 'https://example.org/meeting'
      }
    ];

    it('should filter results by event dates', () => {
      const filtered = dateFilter.filterResultsByEventDate(mockResults);
      
      // Should include March and November results (configured months)
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some(r => r.title.includes('March'))).toBe(true);
      expect(filtered.some(r => r.title.includes('November'))).toBe(true);
    });

    it('should exclude results outside configured date range', () => {
      const filtered = dateFilter.filterResultsByEventDate(mockResults);
      
      // Should not include July (not in configured months)
      expect(filtered.some(r => r.snippet.includes('July'))).toBe(false);
    });
  });

  describe('generateDateAwareSearchTerms', () => {
    it('should generate terms for monthly date ranges', () => {
      const terms = dateFilter.generateDateAwareSearchTerms('nonprofit auction', 'March');
      
      expect(terms).toContain('nonprofit auction "March 2025"');
      expect(terms).toContain('nonprofit auction "March"');
      expect(terms).toContain('nonprofit auction "Mar 2025"');
      expect(terms).toContain('nonprofit auction "Mar"');
    });

    it('should generate terms for quarterly date ranges', () => {
      const terms = dateFilter.generateDateAwareSearchTerms('charity raffle', 'Q2');
      
      expect(terms).toContain('charity raffle "April 2025"');
      expect(terms).toContain('charity raffle "May 2025"');
      expect(terms).toContain('charity raffle "June 2025"');
      expect(terms).toContain('charity raffle "April"');
      expect(terms).toContain('charity raffle "May"');
      expect(terms).toContain('charity raffle "June"');
    });
  });

  describe('getSeasonalKeywords', () => {
    it('should return seasonal keywords for spring months', () => {
      const marchKeywords = dateFilter.getSeasonalKeywords('March');
      expect(marchKeywords).toContain('spring');
      expect(marchKeywords).toContain('easter');
    });

    it('should return seasonal keywords for fall months', () => {
      const octoberKeywords = dateFilter.getSeasonalKeywords('October');
      expect(octoberKeywords).toContain('fall');
      expect(octoberKeywords).toContain('halloween');
      expect(octoberKeywords).toContain('autumn');
    });

    it('should return seasonal keywords for winter months', () => {
      const decemberKeywords = dateFilter.getSeasonalKeywords('December');
      expect(decemberKeywords).toContain('holiday');
      expect(decemberKeywords).toContain('winter');
      expect(decemberKeywords).toContain('christmas');
    });

    it('should return empty array for unknown months', () => {
      const unknownKeywords = dateFilter.getSeasonalKeywords('Unknown');
      expect(unknownKeywords).toEqual([]);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = dateFilter.validateConfiguration();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid quarters', () => {
      const originalQuarters = config.dateRanges.searchQuarters;
      config.dateRanges.searchQuarters = ['Q5', 'Q6']; // Invalid quarters
      
      const result = dateFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid quarter: Q5');
      expect(result.errors).toContain('Invalid quarter: Q6');
      
      // Restore original config
      config.dateRanges.searchQuarters = originalQuarters;
    });

    it('should detect invalid months', () => {
      const originalMonths = config.dateRanges.searchMonths;
      config.dateRanges.searchMonths = ['InvalidMonth', 'AnotherInvalid'];
      
      const result = dateFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid month: InvalidMonth');
      expect(result.errors).toContain('Invalid month: AnotherInvalid');
      
      // Restore original config
      config.dateRanges.searchMonths = originalMonths;
    });

    it('should detect invalid event date range', () => {
      const originalRange = config.dateRanges.eventDateRange;
      config.dateRanges.eventDateRange = 'invalid-range';
      
      const result = dateFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Restore original config
      config.dateRanges.eventDateRange = originalRange;
    });

    it('should detect backwards date range', () => {
      const originalRange = config.dateRanges.eventDateRange;
      config.dateRanges.eventDateRange = '2025-12-31 to 2025-03-01'; // End before start
      
      const result = dateFilter.validateConfiguration();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Event date range start must be before end');
      
      // Restore original config
      config.dateRanges.eventDateRange = originalRange;
    });
  });
}); 