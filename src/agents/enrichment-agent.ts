import { Lead, ScrapedContent, ClassificationResult, AgentExecutionContext } from '../types';
import { config } from '../config';

export interface EnrichmentResult {
  id: string;
  leadId: string;
  contactEmail?: string;
  contactPhone?: string;
  staffSize?: number;
  linkedinUrl?: string;
  additionalEmails?: string[];
  additionalPhones?: string[];
  organizationDetails?: {
    website?: string;
    description?: string;
    foundedYear?: number;
    headquarters?: string;
    industry?: string;
  };
  socialMediaLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  enrichedAt: Date;
  enrichmentSources: ('content' | 'linkedin' | 'website' | 'social')[];
  confidence: number; // 0-1 scale for enrichment data quality
}

export interface LinkedInSearchResult {
  companyName: string;
  companyUrl: string;
  employeeCount?: number;
  industry?: string;
  description?: string;
  website?: string;
  foundedYear?: number;
  headquarters?: string;
}

export interface ContactEnrichmentData {
  emails: string[];
  phones: string[];
  website?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

/**
 * Enrichment Agent - Phase 4 Implementation
 * 
 * Enriches classified leads with:
 * 1. Contact information (emails, phones)
 * 2. LinkedIn organization data (staff size, industry)
 * 3. Social media links
 * 4. Additional organizational details
 */
export class EnrichmentAgent {
  private requestCount = 0;
  private lastRequestTime = Date.now();
  private readonly rateLimitDelay = 2000; // 2 seconds between requests
  
  constructor(private context: AgentExecutionContext) {
    console.log('🔍 Enrichment Agent initialized with context:', this.context.sessionId);
  }

  /**
   * Enrich a single lead with additional contact and organizational data
   */
  async enrichLead(lead: Lead, content: ScrapedContent, _classification: ClassificationResult): Promise<EnrichmentResult> {
    console.log(`🔍 Enriching lead: ${lead.orgName}`);
    
    const enrichmentResult: EnrichmentResult = {
      id: this.generateId(),
      leadId: lead.id,
      enrichedAt: new Date(),
      enrichmentSources: [],
      confidence: 0
    };

    try {
      // 1. Extract contact information from scraped content
      const contactData = this.extractContactInfo(content);
      if (contactData.emails.length > 0 || contactData.phones.length > 0) {
        if (contactData.emails.length > 0) {
          enrichmentResult.contactEmail = contactData.emails[0];
        }
        if (contactData.phones.length > 0) {
          enrichmentResult.contactPhone = contactData.phones[0];
        }
        enrichmentResult.additionalEmails = contactData.emails.slice(1);
        enrichmentResult.additionalPhones = contactData.phones.slice(1);
        if (contactData.socialLinks) {
          enrichmentResult.socialMediaLinks = contactData.socialLinks;
        }
        enrichmentResult.enrichmentSources.push('content');
      }

      // 2. Search LinkedIn for organization data
      const linkedinData = await this.searchLinkedInData(lead.orgName);
      if (linkedinData) {
        enrichmentResult.staffSize = linkedinData.employeeCount;
        enrichmentResult.linkedinUrl = linkedinData.companyUrl;
        enrichmentResult.organizationDetails = {
          website: linkedinData.website,
          description: linkedinData.description,
          foundedYear: linkedinData.foundedYear,
          headquarters: linkedinData.headquarters,
          industry: linkedinData.industry
        };
        enrichmentResult.enrichmentSources.push('linkedin');
      }

      // 3. Enrich from organization website if available
      if (enrichmentResult.organizationDetails?.website) {
        const websiteData = await this.enrichFromWebsite(enrichmentResult.organizationDetails.website);
        if (websiteData) {
          enrichmentResult.contactEmail = enrichmentResult.contactEmail || websiteData.emails[0];
          enrichmentResult.contactPhone = enrichmentResult.contactPhone || websiteData.phones[0];
          enrichmentResult.enrichmentSources.push('website');
        }
      }

      // 4. Calculate confidence score
      enrichmentResult.confidence = this.calculateConfidence(enrichmentResult);

      console.log(`✅ Lead enriched: ${lead.orgName} (confidence: ${enrichmentResult.confidence.toFixed(2)})`);
      return enrichmentResult;

    } catch (error) {
      console.error(`❌ Error enriching lead ${lead.orgName}:`, error);
      enrichmentResult.confidence = 0;
      return enrichmentResult;
    }
  }

  /**
   * Enrich multiple leads in batch
   */
  async enrichBatch(leads: Lead[], contents: ScrapedContent[], classifications: ClassificationResult[]): Promise<EnrichmentResult[]> {
    console.log(`🔍 Enriching ${leads.length} leads in batch`);
    
    const results: EnrichmentResult[] = [];
    
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const content = contents[i];
      const classification = classifications[i];
      
      // Rate limiting
      await this.respectRateLimit();
      
      if (!lead || !content || !classification) {
        console.warn('⚠️ Lead, content, or classification is undefined, skipping enrichment');
        continue;
      }
      const enrichmentResult = await this.enrichLead(lead, content, classification);
      results.push(enrichmentResult);
      
      // Progress tracking
      if ((i + 1) % 5 === 0) {
        console.log(`📊 Enriched ${i + 1}/${leads.length} leads`);
      }
    }
    
    console.log(`✅ Batch enrichment complete: ${results.length} leads processed`);
    return results;
  }

  /**
   * Extract contact information from scraped content
   */
  private extractContactInfo(content: ScrapedContent): ContactEnrichmentData {
    const emails: string[] = [];
    const phones: string[] = [];
    const socialLinks: { [key: string]: string } = {};

    // Extract from existing contact info if available
    if (content.contactInfo?.emails) {
      emails.push(...content.contactInfo.emails);
    }
    if (content.contactInfo?.phones) {
      phones.push(...content.contactInfo.phones);
    }

    // Extract additional emails from content using regex
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = content.content.match(emailRegex);
    if (emailMatches) {
      emails.push(...emailMatches.filter(email => this.isValidEmail(email)));
    }

    // Extract phone numbers
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phoneMatches = content.content.match(phoneRegex);
    if (phoneMatches) {
      phones.push(...phoneMatches.filter(phone => this.isValidPhone(phone)));
    }

    // Extract social media links
    const socialRegex = {
      facebook: /facebook\.com\/[A-Za-z0-9._%+-]+/g,
      twitter: /twitter\.com\/[A-Za-z0-9._%+-]+/g,
      instagram: /instagram\.com\/[A-Za-z0-9._%+-]+/g,
      linkedin: /linkedin\.com\/company\/[A-Za-z0-9._%+-]+/g
    };

    Object.entries(socialRegex).forEach(([platform, regex]) => {
      const matches = content.content.match(regex);
      if (matches && matches.length > 0) {
        socialLinks[platform] = `https://${matches[0]}`;
      }
    });

    return {
      emails: [...new Set(emails)], // Remove duplicates
      phones: [...new Set(phones)], // Remove duplicates
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined
    };
  }

  /**
   * Search LinkedIn for organization data (mock implementation)
   */
  private async searchLinkedInData(orgName: string): Promise<LinkedInSearchResult | null> {
    try {
      // Mock LinkedIn search - in production, this would use LinkedIn API or web scraping
      console.log(`🔍 Searching LinkedIn for: ${orgName}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data generation based on organization name
      const mockData: LinkedInSearchResult = {
        companyName: orgName,
        companyUrl: `https://linkedin.com/company/${orgName.toLowerCase().replace(/\s+/g, '-')}`,
        employeeCount: this.generateMockStaffSize(orgName),
        industry: this.determineMockIndustry(orgName),
        description: `${orgName} is a nonprofit organization dedicated to community service and charitable activities.`,
        website: `https://${orgName.toLowerCase().replace(/\s+/g, '')}.org`,
        foundedYear: 2000 + Math.floor(Math.random() * 24),
        headquarters: this.generateMockHeadquarters()
      };

      return mockData;
    } catch (error) {
      console.error(`❌ Error searching LinkedIn for ${orgName}:`, error);
      return null;
    }
  }

  /**
   * Enrich from organization website
   */
  private async enrichFromWebsite(website: string): Promise<ContactEnrichmentData | null> {
    try {
      console.log(`🔍 Enriching from website: ${website}`);
      
      // Mock website enrichment - in production, this would scrape the website
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock contact data
      const mockData: ContactEnrichmentData = {
        emails: [`info@${website.replace('https://', '').replace('www.', '')}`],
        phones: [`555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`],
        socialLinks: {
          facebook: `https://facebook.com/${website.replace('https://', '').replace('www.', '').replace('.org', '').replace('.com', '')}`,
          twitter: `https://twitter.com/${website.replace('https://', '').replace('www.', '').replace('.org', '').replace('.com', '')}`
        }
      };

      return mockData;
    } catch (error) {
      console.error(`❌ Error enriching from website ${website}:`, error);
      return null;
    }
  }

  /**
   * Calculate confidence score for enrichment data
   */
  private calculateConfidence(enrichment: EnrichmentResult): number {
    let score = 0;
    let maxScore = 0;

    // Contact information (30 points)
    maxScore += 30;
    if (enrichment.contactEmail) score += 20;
    if (enrichment.contactPhone) score += 10;

    // LinkedIn data (40 points)
    maxScore += 40;
    if (enrichment.staffSize) score += 15;
    if (enrichment.linkedinUrl) score += 10;
    if (enrichment.organizationDetails?.description) score += 10;
    if (enrichment.organizationDetails?.industry) score += 5;

    // Social media (20 points)
    maxScore += 20;
    if (enrichment.socialMediaLinks?.facebook) score += 5;
    if (enrichment.socialMediaLinks?.twitter) score += 5;
    if (enrichment.socialMediaLinks?.instagram) score += 5;
    if (enrichment.socialMediaLinks?.linkedin) score += 5;

    // Additional details (10 points)
    maxScore += 10;
    if (enrichment.organizationDetails?.website) score += 5;
    if (enrichment.organizationDetails?.foundedYear) score += 3;
    if (enrichment.organizationDetails?.headquarters) score += 2;

    return Math.min(score / maxScore, 1);
  }

  /**
   * Rate limiting to respect API limits
   */
  private async respectRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Generate mock staff size based on organization name
   */
  private generateMockStaffSize(orgName: string): number {
    const hash = this.hashString(orgName);
    const sizes = [5, 10, 15, 25, 50, 100, 200, 500];
    return sizes[hash % sizes.length] || 50;
  }

  /**
   * Determine mock industry based on organization name
   */
  private determineMockIndustry(orgName: string): string {
    const name = orgName.toLowerCase();
    
    if (name.includes('health') || name.includes('medical')) return 'Healthcare';
    if (name.includes('education') || name.includes('school')) return 'Education';
    if (name.includes('art') || name.includes('museum')) return 'Arts & Culture';
    if (name.includes('environment') || name.includes('green')) return 'Environmental Services';
    if (name.includes('food') || name.includes('hunger')) return 'Food & Nutrition';
    if (name.includes('animal') || name.includes('pet')) return 'Animal Welfare';
    if (name.includes('community') || name.includes('civic')) return 'Community Services';
    
    return 'Nonprofit Organization Management';
  }

  /**
   * Generate mock headquarters location
   */
  private generateMockHeadquarters(): string {
    const cities = [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA',
      'Dallas, TX', 'San Jose, CA', 'Austin, TX', 'Jacksonville, FL'
    ];
    return cities[Math.floor(Math.random() * cities.length)] || 'New York, NY';
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && !email.includes('example.com') && !email.includes('test.com');
  }

  /**
   * Validate phone format
   */
  private isValidPhone(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('555');
  }

  /**
   * Hash string to number for consistent mock data
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get agent status and statistics
   */
  getStatus(): {
    requestCount: number;
    lastRequestTime: Date;
    rateLimitDelay: number;
    isReady: boolean;
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: new Date(this.lastRequestTime),
      rateLimitDelay: this.rateLimitDelay,
      isReady: true
    };
  }
}

// Export default instance
export const enrichmentAgent = new EnrichmentAgent({
  requestId: 'enrichment-' + Date.now(),
  sessionId: 'phase4-session',
  timestamp: new Date(),
  budgetUsed: 0,
  budgetRemaining: config.limits.budgetLimit,
  rateLimitStatus: {
    openai: 0,
    serpapi: 0,
    google: 0
  }
}); 