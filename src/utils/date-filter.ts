import { config } from '../config';

/**
 * Advanced Date Filtering Utility for Lead Miner
 * Handles sophisticated date range parsing, validation, and filtering
 */
export class DateFilter {
  private quarterToMonthsMap: Record<string, string[]> = {
    'Q1': ['January', 'February', 'March'],
    'Q2': ['April', 'May', 'June'],
    'Q3': ['July', 'August', 'September'],
    'Q4': ['October', 'November', 'December']
  };

  private monthAbbreviations: Record<string, string> = {
    'Jan': 'January',
    'Feb': 'February',
    'Mar': 'March',
    'Apr': 'April',
    'May': 'May',
    'Jun': 'June',
    'Jul': 'July',
    'Aug': 'August',
    'Sep': 'September',
    'Oct': 'October',
    'Nov': 'November',
    'Dec': 'December'
  };

  /**
   * Get all months for configured quarters
   */
  getMonthsFromQuarters(): string[] {
    const months = new Set<string>();
    
    for (const quarter of config.dateRanges.searchQuarters) {
      const quarterMonths = this.quarterToMonthsMap[quarter];
      if (quarterMonths) {
        quarterMonths.forEach(month => months.add(month));
      }
    }
    
    return Array.from(months);
  }

  /**
   * Get all configured months (direct + from quarters)
   */
  getAllConfiguredMonths(): string[] {
    const allMonths = new Set<string>();
    
    // Add direct month configurations
    config.dateRanges.searchMonths.forEach(month => allMonths.add(month));
    
    // Add months from quarters
    this.getMonthsFromQuarters().forEach(month => allMonths.add(month));
    
    return Array.from(allMonths);
  }

  /**
   * Parse date from various formats found in web content
   */
  parseEventDate(dateString: string): Date | null {
    if (!dateString) return null;

    // Clean up the date string
    const cleanDate = dateString.trim().replace(/[^\w\s,./-]/g, '');
    

    
    // Try different date formats
    const patterns = [
      // Standard formats
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/i, // "March 15, 2025" or "March 15 2025"
      /(\d{1,2})\s+(\w+)\s+(\d{4})/i,   // "15 March 2025"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // "03/15/2025"
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // "03-15-2025"
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // "2025-03-15"
      /(\w+)\s+(\d{4})/i,              // "March 2025"
    ];

    for (const pattern of patterns) {
      const match = cleanDate.match(pattern);
      if (match) {

        try {
          const date = this.parseMatchedDate(match);
          if (date) {

            return date;
          }
        } catch (error) {
          // Continue to next pattern
        }
      }
    }

    return null;
  }

  /**
   * Parse matched date components
   */
  private parseMatchedDate(match: RegExpMatchArray): Date | null {
    const [, part1, part2, part3] = match;
    
    // Ensure parts exist
    if (!part1 || !part2) return null;
    
    // Try to determine the format
    if (this.isMonth(part1)) {
      if (part3) {
        // Month Day Year format (3 parts)
        const month = this.getMonthNumber(part1);
        const day = parseInt(part2, 10);
        const year = parseInt(part3, 10);
        
        // Validate month
        if (month === 0) return null;
        
        // Validate day
        if (day < 1 || day > 31) return null;
        
        const date = new Date(year, month - 1, day);
        // Check if date is valid (handles Feb 30, etc.)
        if (date.getMonth() !== month - 1) return null;
        
        return date;
      } else {
        // Month Year format (2 parts)
        const month = this.getMonthNumber(part1);
        const year = parseInt(part2, 10);
        
        
        
        if (month === 0 || year < 1900 || year > 2100) return null;
        
        return new Date(year, month - 1, 1);
      }
    } else if (this.isMonth(part2)) {
      // Day Month Year format
      const day = parseInt(part1, 10);
      const month = this.getMonthNumber(part2);
      const year = part3 ? parseInt(part3, 10) : new Date().getFullYear();
      
      // Validate day
      if (day < 1 || day > 31) return null;
      
      const date = new Date(year, month - 1, day);
      // Check if date is valid (handles Feb 30, etc.)
      if (date.getMonth() !== month - 1) return null;
      
      return date;
    } else if (part3) {
      // Numeric formats
      const num1 = parseInt(part1, 10);
      const num2 = parseInt(part2, 10);
      const num3 = parseInt(part3, 10);
      
      // Validate ranges
      if (num1 > 31 && num2 <= 12 && num3 <= 31) {
        // Year-Month-Day format
        const date = new Date(num1, num2 - 1, num3);
        if (date.getMonth() !== num2 - 1) return null;
        return date;
      } else if (num1 <= 12 && num2 <= 31 && num3 > 31) {
        // Month-Day-Year format
        const date = new Date(num3, num1 - 1, num2);
        if (date.getMonth() !== num1 - 1) return null;
        return date;
      }
    } else if (part2) {
      // Month Year format
      const month = this.getMonthNumber(part1);
      const year = parseInt(part2, 10);
      
      
      
      if (month === 0 || year < 1900 || year > 2100) return null;
      
      return new Date(year, month - 1, 1);
    }

    return null;
  }

  /**
   * Check if string is a month name
   */
  private isMonth(str: string): boolean {
    const lowerStr = str.toLowerCase();
    
    // Check abbreviations
    const isAbbreviation = Object.keys(this.monthAbbreviations).some(abbr => 
      abbr.toLowerCase() === lowerStr
    );
    
    // Check full names
    const isFullName = Object.values(this.monthAbbreviations).some(month => 
      month.toLowerCase() === lowerStr
    );
    
    return isAbbreviation || isFullName;
  }

  /**
   * Get month number from month name
   */
  private getMonthNumber(monthStr: string): number {
    const lowerStr = monthStr.toLowerCase();
    
    // Check abbreviations first
    for (const [abbr, fullName] of Object.entries(this.monthAbbreviations)) {
      if (abbr.toLowerCase() === lowerStr) {
        return Object.values(this.monthAbbreviations).indexOf(fullName) + 1;
      }
    }
    
    // Check full names
    for (const [i, fullName] of Object.values(this.monthAbbreviations).entries()) {
      if (fullName.toLowerCase() === lowerStr) {
        return i + 1;
      }
    }
    
    return 0;
  }

  /**
   * Check if date is within configured event date range AND is in the future
   */
  isValidEventDate(date: Date): boolean {
    // First check: Must be in the future (at least 2 weeks from now to allow for planning)
    const today = new Date();
    const minimumFutureDate = new Date(today);
    minimumFutureDate.setDate(today.getDate() + 14); // At least 2 weeks in the future
    
    if (date < minimumFutureDate) {
      console.log(`🗓️ Event date ${date.toDateString()} is in the past or too soon (minimum: ${minimumFutureDate.toDateString()})`);
      return false;
    }

    // Second check: Must be within configured date range
    if (!config.dateRanges.eventDateRange) return true;

    try {
      const parts = config.dateRanges.eventDateRange.split(' to ');
      if (parts.length !== 2) return true;
      
      const [startDateStr, endDateStr] = parts;
      if (!startDateStr || !endDateStr) return true;
      
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      const isInRange = date >= startDate && date <= endDate;
      
      if (!isInRange) {
        console.log(`🗓️ Event date ${date.toDateString()} is outside configured range (${startDate.toDateString()} to ${endDate.toDateString()})`);
      }
      
      return isInRange;
    } catch (error) {
      console.warn('Invalid event date range configuration:', error);
      return true;
    }
  }

  /**
   * Check if date falls within configured months
   */
  isInConfiguredMonths(date: Date): boolean {
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const configuredMonths = this.getAllConfiguredMonths();
    
    return configuredMonths.includes(monthName);
  }

  /**
   * Filter search results based on event dates
   */
  filterResultsByEventDate(results: any[]): any[] {
    return results.filter(result => {
      // Extract potential dates from title, snippet, and link
      const textContent = `${result.title} ${result.snippet} ${result.link}`.toLowerCase();
      
      // Look for date patterns
      const datePatterns = [
        /\b(\w+)\s+(\d{1,2}),?\s+(\d{4})\b/g,  // "March 15, 2025"
        /\b(\d{1,2})\s+(\w+)\s+(\d{4})\b/g,    // "15 March 2025"
        /\b(\w+)\s+(\d{4})\b/g,                // "March 2025"
      ];

      for (const pattern of datePatterns) {
        let match;
        while ((match = pattern.exec(textContent)) !== null) {
          const parsedDate = this.parseEventDate(match[0]);
          if (parsedDate && this.isValidEventDate(parsedDate) && this.isInConfiguredMonths(parsedDate)) {
            return true;
          }
        }
      }

      // If no specific date found, check if it mentions configured months
      const configuredMonths = this.getAllConfiguredMonths();
      return configuredMonths.some(month => 
        textContent.includes(month.toLowerCase())
      );
    });
  }

  /**
   * Generate date-aware search terms
   */
  generateDateAwareSearchTerms(baseKeyword: string, dateRange: string): string[] {
    const terms: string[] = [];
    
    if (dateRange.startsWith('Q')) {
      // Quarter-based search
      const quarterMonths = this.quarterToMonthsMap[dateRange];
      if (quarterMonths) {
        quarterMonths.forEach(month => {
          terms.push(`${baseKeyword} "${month} 2025"`);
          terms.push(`${baseKeyword} "${month}"`);
        });
      }
    } else {
      // Month-based search
      terms.push(`${baseKeyword} "${dateRange} 2025"`);
      terms.push(`${baseKeyword} "${dateRange}"`);
      
      // Add abbreviation if applicable
      const abbr = Object.entries(this.monthAbbreviations).find(([_, full]) => 
        full === dateRange
      )?.[0];
      if (abbr) {
        terms.push(`${baseKeyword} "${abbr} 2025"`);
        terms.push(`${baseKeyword} "${abbr}"`);
      }
    }
    
    return terms;
  }

  /**
   * Get seasonal optimization keywords
   */
  getSeasonalKeywords(month: string): string[] {
    const seasonalMap: Record<string, string[]> = {
      'December': ['holiday', 'winter', 'christmas', 'year-end'],
      'January': ['new year', 'winter', 'resolution'],
      'February': ['valentine', 'winter', 'love'],
      'March': ['spring', 'easter', 'march madness'],
      'April': ['spring', 'easter', 'april'],
      'May': ['spring', 'mother\'s day', 'graduation'],
      'June': ['summer', 'father\'s day', 'graduation'],
      'July': ['summer', 'independence', 'july 4th'],
      'August': ['summer', 'back to school'],
      'September': ['fall', 'back to school', 'autumn'],
      'October': ['fall', 'halloween', 'autumn'],
      'November': ['fall', 'thanksgiving', 'thanksgiving']
    };

    return seasonalMap[month] || [];
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate quarters
    for (const quarter of config.dateRanges.searchQuarters) {
      if (!this.quarterToMonthsMap[quarter]) {
        errors.push(`Invalid quarter: ${quarter}`);
      }
    }

    // Validate months
    for (const month of config.dateRanges.searchMonths) {
      if (!Object.values(this.monthAbbreviations).includes(month)) {
        errors.push(`Invalid month: ${month}`);
      }
    }

    // Validate event date range
    if (config.dateRanges.eventDateRange) {
      try {
        const parts = config.dateRanges.eventDateRange.split(' to ');
        if (parts.length !== 2) {
          errors.push('Invalid event date range format - must be "start to end"');
        } else {
          const [startDateStr, endDateStr] = parts;
          if (startDateStr && endDateStr) {
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              errors.push('Invalid event date range format');
            } else if (startDate >= endDate) {
              errors.push('Event date range start must be before end');
            }
          } else {
            errors.push('Invalid event date range format');
          }
        }
      } catch (error) {
        errors.push('Invalid event date range configuration');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export a default instance
export const dateFilter = new DateFilter(); 