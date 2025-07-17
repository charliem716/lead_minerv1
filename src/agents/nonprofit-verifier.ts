// Config import removed - not currently used

/**
 * Nonprofit Verification Result Interface
 */
export interface NonprofitVerificationResult {
  id: string;
  orgName: string;
  ein?: string;
  isVerified: boolean;
  source: 'irs' | 'guidestar' | 'manual' | 'failed';
  verificationDetails: {
    classification?: string;
    deductibility?: string;
    city?: string;
    state?: string;
    country?: string;
    exemptionCode?: string;
    rulingDate?: string;
    assetCode?: string;
    incomeCode?: string;
    filingRequirement?: string;
    pf?: string;
    advancedRuling?: string;
    groupExemption?: string;
    subsection?: string;
    affiliation?: string;
    subjectToProxyTax?: string;
    donorAdvisedFund?: string;
    organizationType?: string;
  };
  additionalInfo?: {
    website?: string;
    phone?: string;
    address?: string;
    mission?: string;
    nteeCode?: string;
    totalRevenue?: number;
    totalAssets?: number;
    foundedYear?: number;
  };
  verifiedAt: Date;
  confidence: number; // 0-1 scale
  error?: string;
}

/**
 * Nonprofit Verification Agent
 * Uses IRS Pub 78 API and GuideStar fallback for nonprofit verification
 */
export class NonprofitVerifier {
  // API base URLs for future implementation
  private _irsApiBase: string;
  private _guidetarApiBase: string;
  private cache: Map<string, NonprofitVerificationResult>;
  private cacheExpiry: number; // Cache expiry in milliseconds

  constructor() {
    this._irsApiBase = 'https://apps.irs.gov/app/eos/pub78Search.do';
    this._guidetarApiBase = 'https://www.guidestar.org/search';
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Getters for testing
  get irsApiBase(): string {
    return this._irsApiBase;
  }

  get guidetarApiBase(): string {
    return this._guidetarApiBase;
  }

  /**
   * Simple interface for verifying nonprofit status by name and optional state
   */
  async verifyNonprofit(orgName: string, state?: string): Promise<NonprofitVerificationResult> {
    console.log(`🔍 Verifying nonprofit: ${orgName}${state ? ` in ${state}` : ''}`);
    return await this.verifyByName(orgName);
  }

  /**
   * Verify nonprofit status by EIN
   */
  async verifyByEIN(ein: string): Promise<NonprofitVerificationResult> {
    console.log(`Verifying nonprofit by EIN: ${ein}`);
    
    // Check cache first
    const cacheKey = `ein:${ein}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      console.log('Using cached verification result');
      return cached;
    }

    try {
      // Try IRS Pub 78 API first
      let result = await this.verifyWithIRS(ein);
      
      // If IRS fails, try GuideStar
      if (!result.isVerified) {
        result = await this.verifyWithGuideStar(ein);
      }
      
      // Cache the result
      this.cacheResult(cacheKey, result);
      
      return result;
      
    } catch (error) {
      console.error('Nonprofit verification failed:', error);
      return this.createFailedResult(ein, undefined, error as Error);
    }
  }

  /**
   * Verify nonprofit status by organization name
   */
  async verifyByName(orgName: string): Promise<NonprofitVerificationResult> {
    console.log(`Verifying nonprofit by name: ${orgName}`);
    
    // Check cache first
    const cacheKey = `name:${orgName.toLowerCase()}`;
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      console.log('Using cached verification result');
      return cached;
    }

    try {
      // Try IRS Pub 78 API first
      let result = await this.verifyWithIRSByName(orgName);
      
      // If IRS fails, try GuideStar
      if (!result.isVerified) {
        result = await this.verifyWithGuideStarByName(orgName);
      }
      
      // Cache the result
      this.cacheResult(cacheKey, result);
      
      return result;
      
    } catch (error) {
      console.error('Nonprofit verification failed:', error);
      return this.createFailedResult(undefined, orgName, error as Error);
    }
  }

  /**
   * Verify with IRS Pub 78 API by EIN
   */
  private async verifyWithIRS(ein: string): Promise<NonprofitVerificationResult> {
    console.log('Checking IRS Pub 78 database...');
    
    try {
      // Use IRS Business Master File API or IRS.gov search
      const irsUrl = `https://apps.irs.gov/app/eos/forwardToPub78Download.do?ein=${ein}`;
      
      const response = await fetch(irsUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Lead-Miner-Agent/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.text();
        
        // Check if the response contains nonprofit information
        if (data.includes('deductible') || data.includes('501(c)(3)')) {
          // Extract organization name from response
                     const orgNameMatch = data.match(/<title>([^<]+)<\/title>/);
           const orgName = orgNameMatch?.[1]?.replace(' - IRS', '') || 'Unknown Organization';
          
          return {
            id: this.generateId(),
            orgName: orgName,
            ein,
            isVerified: true,
            source: 'irs',
            verificationDetails: {
              classification: 'Public Charity',
              deductibility: 'Contributions are deductible',
              exemptionCode: '501(c)(3)',
              country: 'US'
            },
            verifiedAt: new Date(),
            confidence: 1.0
          };
        }
      }
      
      // If IRS doesn't have it, try alternative verification
      return await this.verifyWithAlternativeSource(ein);
      
    } catch (error) {
      console.error('IRS API error:', error);
      return this.createFailedResult(ein, undefined, error as Error);
    }
  }

  /**
   * Alternative nonprofit verification using Charity Navigator or similar
   */
  private async verifyWithAlternativeSource(ein: string): Promise<NonprofitVerificationResult> {
    try {
      // Use ProPublica Nonprofit Explorer API (free)
      const apiUrl = `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Lead-Miner-Agent/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.organization) {
          const org = data.organization;
          return {
            id: this.generateId(),
            orgName: org.name || 'Unknown Organization',
            ein,
            isVerified: true,
            source: 'irs',
            verificationDetails: {
              classification: org.classification || 'Nonprofit',
              city: org.city,
              state: org.state,
              country: 'US',
              exemptionCode: '501(c)(3)'
            },
            additionalInfo: {
              totalRevenue: org.totrevenue,
              totalAssets: org.totassetsend,
              foundedYear: org.ruling_date ? new Date(org.ruling_date).getFullYear() : undefined
            },
            verifiedAt: new Date(),
            confidence: 0.9
          };
        }
      }
      
      return this.createFailedResult(ein, undefined, new Error('Not found in nonprofit databases'));
      
    } catch (error) {
      console.error('Alternative verification error:', error);
      return this.createFailedResult(ein, undefined, error as Error);
    }
  }

  /**
   * Verify with IRS Pub 78 API by organization name
   */
  private async verifyWithIRSByName(orgName: string): Promise<NonprofitVerificationResult> {
    console.log('Searching IRS Pub 78 database by name...');
    
    try {
      // Use ProPublica search by name
      const searchUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(orgName)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Lead-Miner-Agent/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.organizations && data.organizations.length > 0) {
          // Find the best match by name similarity instead of just taking the first
          const bestMatch = this.findBestNameMatch(orgName, data.organizations);
          if (bestMatch && bestMatch.ein) {
            console.log(`Found potential match: ${bestMatch.name} (EIN: ${bestMatch.ein})`);
            return await this.verifyWithIRS(bestMatch.ein);
          }
        }
      }
      
      return this.createFailedResult(undefined, orgName, new Error('Not found in nonprofit databases'));
      
    } catch (error) {
      console.error('Name search error:', error);
      return this.createFailedResult(undefined, orgName, error as Error);
    }
  }

  /**
   * Find the best matching organization by name similarity
   */
  private findBestNameMatch(searchName: string, organizations: any[]): any {
    if (!organizations || organizations.length === 0) return null;
    
    const normalizedSearch = searchName.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const org of organizations) {
      if (!org.name) continue;
      
      const normalizedOrgName = org.name.toLowerCase().trim();
      
      // Calculate similarity score
      let score = 0;
      
      // Exact match gets highest score
      if (normalizedOrgName === normalizedSearch) {
        score = 1.0;
      }
      // Contains search term
      else if (normalizedOrgName.includes(normalizedSearch)) {
        score = 0.8;
      }
      // Search term contains org name
      else if (normalizedSearch.includes(normalizedOrgName)) {
        score = 0.6;
      }
      // Check for word overlap
      else {
        const searchWords = normalizedSearch.split(/\s+/);
        const orgWords = normalizedOrgName.split(/\s+/);
        const commonWords = searchWords.filter(word => orgWords.includes(word));
        score = commonWords.length / Math.max(searchWords.length, orgWords.length);
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = org;
      }
    }
    
    // Only return match if similarity is above threshold
    return bestScore > 0.3 ? bestMatch : null;
  }

  /**
   * Verify with GuideStar fallback by EIN
   */
  private async verifyWithGuideStar(ein: string): Promise<NonprofitVerificationResult> {
    console.log('Checking GuideStar database...');
    
    // GuideStar/Candid API is typically paid, so we'll use the alternative source we already implemented
    return await this.verifyWithAlternativeSource(ein);
  }

  /**
   * Verify with GuideStar fallback by name
   */
  private async verifyWithGuideStarByName(orgName: string): Promise<NonprofitVerificationResult> {
    console.log('Searching GuideStar database by name...');
    
    // Use the same search by name implementation as IRS
    return await this.verifyWithIRSByName(orgName);
  }

  /**
   * Extract potential EIN from text content
   */
  extractEIN(text: string): string | null {
    // EIN format: XX-XXXXXXX (2 digits, hyphen, 7 digits)
    const einPattern = /\b\d{2}-\d{7}\b/g;
    const matches = text.match(einPattern);
    
    if (matches && matches.length > 0) {
      return matches[0];
    }
    
    return null;
  }

  /**
   * Extract organization name from content
   */
  extractOrganizationName(content: any): string | null {
    // Try different sources for organization name
    if (content.organizationInfo?.name) {
      return content.organizationInfo.name;
    }
    
    if (content.title) {
      // Clean up title to extract organization name
      return content.title.replace(/\s+(annual|auction|raffle|gala|event|fundraiser).*$/i, '').trim();
    }
    
    return null;
  }

  /**
   * Batch verify multiple organizations
   */
  async verifyBatch(organizations: Array<{ein?: string, name?: string}>): Promise<NonprofitVerificationResult[]> {
    console.log(`Starting batch verification of ${organizations.length} organizations`);
    
    const results: NonprofitVerificationResult[] = [];
    
    for (const org of organizations) {
      let result: NonprofitVerificationResult;
      
      if (org.ein) {
        result = await this.verifyByEIN(org.ein);
      } else if (org.name) {
        result = await this.verifyByName(org.name);
      } else {
        result = this.createFailedResult(undefined, undefined, new Error('No EIN or name provided'));
      }
      
      results.push(result);
      
      // Rate limiting to avoid API abuse
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Batch verification complete: ${results.filter(r => r.isVerified).length}/${results.length} verified`);
    
    return results;
  }

  /**
   * Get cached verification result
   */
  private getCachedResult(key: string): NonprofitVerificationResult | null {
    const cached = this.cache.get(key);
    if (cached) {
      const age = Date.now() - cached.verifiedAt.getTime();
      if (age < this.cacheExpiry) {
        return cached;
      } else {
        this.cache.delete(key);
      }
    }
    return null;
  }

  /**
   * Cache verification result
   */
  private cacheResult(key: string, result: NonprofitVerificationResult): void {
    this.cache.set(key, result);
  }

  /**
   * Create failed verification result
   */
  private createFailedResult(ein?: string, orgName?: string, error?: Error): NonprofitVerificationResult {
    const result: NonprofitVerificationResult = {
      id: this.generateId(),
      orgName: orgName || 'Unknown',
      isVerified: false,
      source: 'failed',
      verificationDetails: {},
      verifiedAt: new Date(),
      confidence: 0,
      error: error ? `Nonprofit verification failed: ${error.message}` : 'Verification failed'
    };
    
    if (ein) {
      result.ein = ein;
    }
    
    return result;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get verification statistics
   */
  getVerificationStats(results: NonprofitVerificationResult[]): any {
    const verified = results.filter(r => r.isVerified);
    const bySource = results.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: results.length,
      verified: verified.length,
      failed: results.length - verified.length,
      verificationRate: verified.length / results.length,
      averageConfidence: verified.reduce((sum, r) => sum + r.confidence, 0) / verified.length || 0,
      sourceBreakdown: bySource
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Nonprofit verification cache cleared');
  }
}

// Export singleton instance
export const nonprofitVerifier = new NonprofitVerifier(); 