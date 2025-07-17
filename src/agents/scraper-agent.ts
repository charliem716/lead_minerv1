import puppeteer, { Browser, Page } from 'puppeteer';
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
  private browser: Browser | null = null;
  private requestCount: number = 0;
  private requestTimestamps: number[] = [];
  private robotsCache: Map<string, RobotsRules> = new Map();
  private isInitializing = false;

  constructor() {
    console.log('🕷️ ScraperAgent initialized with real Puppeteer browser');
  }

  /**
   * Initialize the browser instance with proper error handling
   */
  async initialize(): Promise<void> {
    if (this.browser || this.isInitializing) {
      return;
    }
    
    this.isInitializing = true;
    
    try {
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
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--disable-features=TranslateUI'
        ]
      });
      
      console.log('🌐 Puppeteer browser initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Puppeteer browser:', error);
      this.browser = null;
      throw new Error(`Browser initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 Puppeteer browser closed');
      } catch (error) {
        console.warn('⚠️ Error closing browser:', error);
      } finally {
        this.browser = null;
      }
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
        const robotsRules = this.robotsCache.get(robotsKey)!;
        return this.isAllowedByRobots(url, robotsRules);
      }

      // Fetch robots.txt
      const robotsUrl = `${baseUrl}/robots.txt`;
      const response = await fetch(robotsUrl, { 
        headers: {
          'User-Agent': 'Lead-Miner Bot 1.0 (respectful nonprofit crawler)'
        }
      });
      
      let robotsRules: RobotsRules = { userAgent: '*', disallow: [], allow: [] };
      
      if (response.ok) {
        const robotsText = await response.text();
        robotsRules = this.parseRobotsTxt(robotsText);
      }
      
      // Cache the results
      this.robotsCache.set(robotsKey, robotsRules);
      
      return this.isAllowedByRobots(url, robotsRules);
    } catch (error) {
      console.warn(`⚠️ Failed to check robots.txt for ${url}:`, error);
      // If we can't check robots.txt, assume it's allowed
      return true;
    }
  }

  /**
   * Parse robots.txt content
   */
  private parseRobotsTxt(robotsText: string): RobotsRules {
    const rules: RobotsRules = { userAgent: '*', disallow: [], allow: [] };
    const lines = robotsText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('disallow:')) {
        const path = trimmed.substring(9).trim();
        if (path) rules.disallow.push(path);
      } else if (trimmed.startsWith('allow:')) {
        const path = trimmed.substring(6).trim();
        if (path) rules.allow.push(path);
      } else if (trimmed.startsWith('crawl-delay:')) {
        const delay = parseInt(trimmed.substring(12).trim());
        if (!isNaN(delay)) rules.crawlDelay = delay;
      }
    }
    
    return rules;
  }

  /**
   * Check if URL is allowed by robots.txt rules
   */
  private isAllowedByRobots(url: string, rules: RobotsRules | undefined): boolean {
    if (!rules) return true;
    
    const urlPath = new URL(url).pathname;
    
    // Check explicit allows first
    for (const allowPath of rules.allow) {
      if (urlPath.startsWith(allowPath)) return true;
    }
    
    // Check disallows
    for (const disallowPath of rules.disallow) {
      if (disallowPath === '*' || urlPath.startsWith(disallowPath)) return false;
    }
    
    return true;
  }

  /**
   * Apply rate limiting
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const maxRequestsPerMinute = config.limits.maxRequestsPerMinute || 30;
    const windowMs = 60000; // 1 minute
    
    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => 
      now - timestamp < windowMs
    );
    
    // Check if we're over the limit
    if (this.requestTimestamps.length >= maxRequestsPerMinute && this.requestTimestamps.length > 0) {
      const oldestRequest = this.requestTimestamps[0];
      if (oldestRequest !== undefined) {
        const waitTime = windowMs - (now - oldestRequest);
        if (waitTime > 0) {
          console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    this.requestTimestamps.push(now);
  }

  /**
   * Scrape content from a URL with enhanced error handling
   */
  async scrapeUrl(url: string): Promise<ScrapedContent> {
    let page: Page | null = null;
    
    try {
      await this.initialize();
      
      if (!this.browser) {
        throw new Error('Browser failed to initialize');
      }

      // Check robots.txt
      const isAllowed = await this.checkRobotsTxt(url);
      if (!isAllowed) {
        console.log(`🚫 Robots.txt disallows scraping: ${url}`);
        return this.createErrorResult(url, 'Disallowed by robots.txt', 403);
      }
      
      // Apply rate limiting
      await this.rateLimit();
      
      page = await this.browser.newPage();
      
      // Configure page
      await page.setUserAgent('Lead-Miner Bot 1.0 (respectful nonprofit crawler)');
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Navigate to URL with proper error handling
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      const statusCode = 200; // Will be caught in catch block if there's an error
      
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
        statusCode
      };
      
      this.requestCount++;
      console.log(`✅ Successfully scraped: ${url} (${cleanText.length} chars)`);
      return scrapedContent;
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${url}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = this.getErrorStatusCode(errorMessage);
      
      return this.createErrorResult(url, errorMessage, statusCode);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.warn('⚠️ Error closing page:', error);
        }
      }
    }
  }

  /**
   * Create error result for failed scraping attempts
   */
  private createErrorResult(url: string, errorMessage: string, statusCode: number): ScrapedContent {
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
      statusCode,
      error: errorMessage
    };
  }

  /**
   * Determine status code from error message
   */
  private getErrorStatusCode(errorMessage: string): number {
    if (errorMessage.includes('timeout')) return 408;
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) return 403;
    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) return 404;
    if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) return 500;
    if (errorMessage.includes('robots.txt')) return 403;
    return 500;
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