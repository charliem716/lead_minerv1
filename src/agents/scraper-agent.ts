import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { config } from '../config';
import { ScrapedContent } from '../types';

// Type definitions
interface RobotsRules {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
}

/**
 * Scraper Agent for Lead Miner
 * Handles web scraping with Puppeteer while respecting robots.txt
 * Implements rate limiting and proper error handling
 */
export class ScraperAgent {
  private browser: any = null;
  private requestCount: number = 0;
  private requestTimestamps: number[] = [];
  private robotsCache: Map<string, RobotsRules> = new Map();

  constructor() {}

  /**
   * Initialize the browser instance
   */
  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      
      console.log('Puppeteer browser initialized');
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Puppeteer browser closed');
    }
  }

  /**
   * Check robots.txt for a given URL
   */
  async checkRobotsTxt(url: string): Promise<boolean> {
    try {
      const baseUrl = new URL(url).origin;
      const robotsKey = `${baseUrl}/robots.txt`;
      
      // Check cache first
      if (this.robotsCache.has(robotsKey)) {
        const robotsRules = this.robotsCache.get(robotsKey);
        return this.isAllowedByRobots(url, robotsRules);
      }

      // Fetch robots.txt
      const robotsUrl = `${baseUrl}/robots.txt`;
      const response = await fetch(robotsUrl);
      
      let robotsRules = { userAgent: '*', disallow: [], allow: [] };
      
      if (response.ok) {
        const robotsText = await response.text();
        robotsRules = this.parseRobotsTxt(robotsText);
      }
      
      // Cache the results
      this.robotsCache.set(robotsKey, robotsRules);
      
      return this.isAllowedByRobots(url, robotsRules);
    } catch (error) {
      console.warn(`Failed to check robots.txt for ${url}:`, error);
      // If we can't check robots.txt, assume it's allowed
      return true;
    }
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(content: string): any {
    const lines = content.split('\n');
    const rules = { userAgent: '*', disallow: [] as string[], allow: [] as string[], crawlDelay: 0 };
    let isOurUserAgent = true;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }

      if (trimmedLine.startsWith('User-agent:')) {
        const userAgent = trimmedLine.substring(11).trim();
        isOurUserAgent = userAgent === '*' || userAgent === 'LeadMinerBot';
      } else if (isOurUserAgent && trimmedLine.startsWith('Disallow:')) {
        const path = trimmedLine.substring(9).trim();
        if (path) {
          rules.disallow.push(path);
        }
      } else if (isOurUserAgent && trimmedLine.startsWith('Allow:')) {
        const path = trimmedLine.substring(6).trim();
        if (path) {
          rules.allow.push(path);
        }
      } else if (isOurUserAgent && trimmedLine.startsWith('Crawl-delay:')) {
        const delay = parseInt(trimmedLine.substring(12).trim(), 10);
        if (!isNaN(delay)) {
          rules.crawlDelay = delay;
        }
      }
    }

    return rules;
  }

  /**
   * Check if URL is allowed by robots.txt rules
   */
  private isAllowedByRobots(url: string, rules: any): boolean {
    const path = new URL(url).pathname;
    
    // Check explicit allows first
    for (const allowRule of rules.allow) {
      if (allowRule === '/' || path.startsWith(allowRule)) {
        return true;
      }
    }
    
    // Check disallows
    for (const disallowRule of rules.disallow) {
      if (disallowRule === '/' || path.startsWith(disallowRule)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Implement rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    
    // Check if we're exceeding rate limit
    if (this.requestTimestamps.length >= config.limits.maxRequestsPerMinute) {
      const oldestRequest = this.requestTimestamps[0];
      if (oldestRequest) {
        const waitTime = oneMinuteAgo - oldestRequest + 1000; // Add 1 second buffer
        
        if (waitTime > 0) {
          console.log(`Rate limiting: waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // Add current request timestamp
    this.requestTimestamps.push(now);
    
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  }

  /**
   * Scrape content from a URL
   */
  async scrapeUrl(url: string): Promise<ScrapedContent | null> {
    try {
      await this.initialize();
      
      // Check robots.txt
      const isAllowed = await this.checkRobotsTxt(url);
      if (!isAllowed) {
        console.log(`Robots.txt disallows scraping: ${url}`);
        return null;
      }
      
      // Apply rate limiting
      await this.rateLimit();
      
      const page = await this.browser!.newPage();
      
      // Set user agent
      await page.setUserAgent('Lead-Miner Bot 1.0 (respectful nonprofit crawler)');
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to URL with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Get page content
      const content = await page.content();
      const title = await page.title();
      
      // Extract text content using Cheerio
      const $ = cheerio.load(content);
      
      // Remove script and style elements
      $('script, style, nav, footer, header, aside, .advertisement, .ads, .social-media').remove();
      
      // Extract relevant text
      const textContent = $('body').text().trim();
      const cleanText = this.cleanText(textContent);
      
      // Extract specific information
      const eventInfo = this.extractEventInfo($);
      const contactInfo = this.extractContactInfo($);
      const organizationInfo = this.extractOrganizationInfo($);
      
      const scrapedContent: ScrapedContent = {
        id: `scraped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        title,
        content: cleanText,
        images: [],
        rawHtml: content,
        eventInfo,
        contactInfo,
        organizationInfo,
        scrapedAt: new Date(),
        processingStatus: 'pending',
        statusCode: 200
      };
      
      await page.close();
      this.requestCount++;
      
      console.log(`Successfully scraped: ${url}`);
      return scrapedContent;
      
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        id: `scraped_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url,
        title: '',
        content: '',
        images: [],
        rawHtml: '',
        eventInfo: undefined,
        contactInfo: undefined,
        organizationInfo: undefined,
        scrapedAt: new Date(),
        processingStatus: 'pending' as const,
        statusCode: errorMessage.includes('timeout') ? 408 : 500,
        error: errorMessage
      };
    }
  }

  /**
   * Clean and normalize text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .replace(/\t+/g, ' ')
      .trim();
  }

  /**
   * Extract event information from page
   */
  private extractEventInfo($: cheerio.CheerioAPI): any {
    const eventInfo: any = {};
    
    // Look for event titles
    const eventTitleSelectors = [
      'h1', 'h2', '.event-title', '.title', '[class*="event"]', '[class*="auction"]'
    ];
    
    for (const selector of eventTitleSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        eventInfo.title = element.text().trim();
        break;
      }
    }
    
    // Look for event dates
    const dateSelectors = [
      '.date', '.event-date', '[class*="date"]', 'time', '[datetime]'
    ];
    
    for (const selector of dateSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const dateText = element.text().trim();
        if (dateText) {
          eventInfo.date = dateText;
          break;
        }
      }
    }
    
    // Look for event descriptions
    const descriptionSelectors = [
      '.description', '.event-description', '[class*="description"]', 'p'
    ];
    
    for (const selector of descriptionSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 50) {
        eventInfo.description = element.text().trim();
        break;
      }
    }
    
    return Object.keys(eventInfo).length > 0 ? eventInfo : null;
  }

  /**
   * Extract contact information from page
   */
  private extractContactInfo($: cheerio.CheerioAPI): any {
    const contactInfo: any = {};
    
    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const pageText = $('body').text();
    const emails = pageText.match(emailRegex);
    if (emails && emails.length > 0) {
      contactInfo.emails = [...new Set(emails)]; // Remove duplicates
    }
    
    // Extract phone numbers
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phones = pageText.match(phoneRegex);
    if (phones && phones.length > 0) {
      contactInfo.phones = [...new Set(phones)]; // Remove duplicates
    }
    
    // Extract addresses
    const addressSelectors = [
      '.address', '.contact-address', '[class*="address"]', '.location'
    ];
    
    for (const selector of addressSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        contactInfo.address = element.text().trim();
        break;
      }
    }
    
    return Object.keys(contactInfo).length > 0 ? contactInfo : null;
  }

  /**
   * Extract organization information from page
   */
  private extractOrganizationInfo($: cheerio.CheerioAPI): any {
    const orgInfo: any = {};
    
    // Extract organization name
    const orgNameSelectors = [
      'h1', '.org-name', '.organization-name', '[class*="organization"]', 'title'
    ];
    
    for (const selector of orgNameSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        orgInfo.name = element.text().trim();
        break;
      }
    }
    
    // Extract EIN if present
    const einRegex = /\b\d{2}-\d{7}\b/g;
    const pageText = $('body').text();
    const eins = pageText.match(einRegex);
    if (eins && eins.length > 0) {
      orgInfo.ein = eins[0];
    }
    
    // Extract mission/description
    const missionSelectors = [
      '.mission', '.about', '.description', '[class*="mission"]', '[class*="about"]'
    ];
    
    for (const selector of missionSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 50) {
        orgInfo.mission = element.text().trim();
        break;
      }
    }
    
    return Object.keys(orgInfo).length > 0 ? orgInfo : null;
  }

  /**
   * Batch scrape multiple URLs
   */
  async scrapeUrls(urls: string[]): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];
    
    for (const url of urls) {
      try {
        const content = await this.scrapeUrl(url);
        if (content) {
          results.push(content);
        }
      } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Get scraping statistics
   */
  getStats(): { requestCount: number; cacheSize: number; avgResponseTime: number } {
    return {
      requestCount: this.requestCount,
      cacheSize: this.robotsCache.size,
      avgResponseTime: 0 // TODO: Implement response time tracking
    };
  }

  /**
   * Clear robots.txt cache
   */
  clearCache(): void {
    this.robotsCache.clear();
    console.log('Robots.txt cache cleared');
  }
}

// Export a default instance
export const scraperAgent = new ScraperAgent(); 