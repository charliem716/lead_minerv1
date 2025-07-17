import { ScrapedContent } from '../types';

/**
 * Deduplication Utility for Lead Miner
 * Handles identification and removal of duplicate leads based on multiple criteria
 */
export class DeduplicationEngine {
  private seenUrls: Set<string> = new Set();
  private seenEINs: Set<string> = new Set();
  private seenOrgNames: Set<string> = new Set();
  private contentHashes: Map<string, string> = new Map();
  private similarityThreshold: number = 0.8;

  constructor(similarityThreshold: number = 0.8) {
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Check if content is a duplicate based on multiple criteria
   */
  isDuplicate(content: ScrapedContent): boolean {
    // Check URL duplicates
    if (this.isUrlDuplicate(content.url)) {
      return true;
    }

    // Check EIN duplicates
    if (content.organizationInfo?.ein && this.isEINDuplicate(content.organizationInfo.ein)) {
      return true;
    }

    // Check organization name duplicates
    if (content.organizationInfo?.name && this.isOrgNameDuplicate(content.organizationInfo.name)) {
      return true;
    }

    // Check content similarity
    if (this.isContentSimilar(content)) {
      return true;
    }

    return false;
  }

  /**
   * Add content to the deduplication cache
   */
  addToCache(content: ScrapedContent): void {
    // Add URL to cache
    this.seenUrls.add(this.normalizeUrl(content.url));

    // Add EIN to cache if present
    if (content.organizationInfo?.ein) {
      this.seenEINs.add(content.organizationInfo.ein);
    }

    // Add organization name to cache if present
    if (content.organizationInfo?.name) {
      this.seenOrgNames.add(this.normalizeOrgName(content.organizationInfo.name));
    }

    // Add content hash to cache
    const contentHash = this.generateContentHash(content);
    this.contentHashes.set(contentHash, content.url);
  }

  /**
   * Check if URL is a duplicate
   */
  private isUrlDuplicate(url: string): boolean {
    const normalizedUrl = this.normalizeUrl(url);
    return this.seenUrls.has(normalizedUrl);
  }

  /**
   * Check if EIN is a duplicate
   */
  private isEINDuplicate(ein: string): boolean {
    return this.seenEINs.has(ein);
  }

  /**
   * Check if organization name is a duplicate
   */
  private isOrgNameDuplicate(orgName: string): boolean {
    const normalizedName = this.normalizeOrgName(orgName);
    return this.seenOrgNames.has(normalizedName);
  }

  /**
   * Check if content is similar to existing content
   */
  private isContentSimilar(content: ScrapedContent): boolean {
    const contentHash = this.generateContentHash(content);
    
    // Check exact hash match
    if (this.contentHashes.has(contentHash)) {
      return true;
    }

    // Check similarity with existing content
    for (const [existingHash, existingUrl] of this.contentHashes.entries()) {
      if (this.calculateSimilarity(contentHash, existingHash) >= this.similarityThreshold) {
        console.log(`Similar content found: ${content.url} matches ${existingUrl}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove common parameters that don't affect content
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'ref', 'source'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      
      // Remove trailing slash
      let pathname = urlObj.pathname;
      if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
      }
      
      // Convert to lowercase
      return `${urlObj.protocol}//${urlObj.hostname}${pathname}${urlObj.search}`.toLowerCase();
    } catch (error) {
      // If URL parsing fails, return as-is but lowercase
      return url.toLowerCase();
    }
  }

  /**
   * Normalize organization name for comparison
   */
  private normalizeOrgName(orgName: string): string {
    return orgName
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|limited|foundation|fund|trust|society|association|org|organization|nonprofit|non-profit)\b/g, '')
      .trim();
  }

  /**
   * Generate content hash for similarity comparison
   */
  private generateContentHash(content: ScrapedContent): string {
    // Create a hash based on key content elements
    const keyElements = [
      content.title,
      content.organizationInfo?.name || '',
      content.eventInfo?.title || '',
      content.eventInfo?.date || '',
      content.contactInfo?.emails?.[0] || '',
      this.extractKeywords(content.content)
    ];

    return this.simpleHash(keyElements.join('|'));
  }

  /**
   * Extract key keywords from content for hashing
   */
  private extractKeywords(content: string): string {
    const words = content.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => 
      word.length > 3 && 
      !this.isStopWord(word) &&
      (word.includes('auction') || word.includes('raffle') || word.includes('travel') || 
       word.includes('vacation') || word.includes('trip') || word.includes('fundrais'))
    );
    
    return keywords.sort().slice(0, 10).join(' ');
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
      'might', 'must', 'can', 'our', 'we', 'us', 'you', 'your', 'they', 'them', 'their'
    ]);
    return stopWords.has(word);
  }

  /**
   * Simple hash function for string
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Calculate similarity between two content hashes
   */
  private calculateSimilarity(hash1: string, hash2: string): number {
    // Simple similarity calculation based on hash difference
    const diff = Math.abs(parseInt(hash1, 16) - parseInt(hash2, 16));
    const maxDiff = Math.pow(2, 31);
    return 1 - (diff / maxDiff);
  }

  /**
   * Deduplicate a batch of scraped content
   */
  deduplicateBatch(contents: ScrapedContent[]): ScrapedContent[] {
    const deduplicatedContents: ScrapedContent[] = [];
    const duplicateStats = {
      urlDuplicates: 0,
      einDuplicates: 0,
      orgNameDuplicates: 0,
      contentSimilarDuplicates: 0
    };

    for (const content of contents) {
      if (this.isDuplicate(content)) {
        // Track the type of duplicate
        if (this.isUrlDuplicate(content.url)) {
          duplicateStats.urlDuplicates++;
        } else if (content.organizationInfo?.ein && this.isEINDuplicate(content.organizationInfo.ein)) {
          duplicateStats.einDuplicates++;
        } else if (content.organizationInfo?.name && this.isOrgNameDuplicate(content.organizationInfo.name)) {
          duplicateStats.orgNameDuplicates++;
        } else {
          duplicateStats.contentSimilarDuplicates++;
        }
        
        console.log(`Duplicate content detected: ${content.url}`);
      } else {
        deduplicatedContents.push(content);
        this.addToCache(content);
      }
    }

    console.log('Deduplication stats:', duplicateStats);
    console.log(`Original: ${contents.length}, Deduplicated: ${deduplicatedContents.length}`);
    
    return deduplicatedContents;
  }

  /**
   * Find potential duplicates in a batch without removing them
   */
  findDuplicates(contents: ScrapedContent[]): { 
    duplicates: ScrapedContent[], 
    unique: ScrapedContent[], 
    duplicateGroups: Map<string, ScrapedContent[]> 
  } {
    const duplicates: ScrapedContent[] = [];
    const unique: ScrapedContent[] = [];
    const duplicateGroups: Map<string, ScrapedContent[]> = new Map();
    const tempCache = new DeduplicationEngine(this.similarityThreshold);

    for (const content of contents) {
      if (tempCache.isDuplicate(content)) {
        duplicates.push(content);
        
        // Group duplicates by organization name or URL
        const groupKey = content.organizationInfo?.name || content.url;
        if (!duplicateGroups.has(groupKey)) {
          duplicateGroups.set(groupKey, []);
        }
        duplicateGroups.get(groupKey)!.push(content);
      } else {
        unique.push(content);
        tempCache.addToCache(content);
      }
    }

    return { duplicates, unique, duplicateGroups };
  }

  /**
   * Merge duplicate content entries
   */
  mergeDuplicates(contents: ScrapedContent[]): ScrapedContent[] {
    const mergedContents: ScrapedContent[] = [];
    const processed: Set<string> = new Set();

    for (const content of contents) {
      if (processed.has(content.url)) {
        continue;
      }

      // Find all duplicates for this content
      const duplicates = contents.filter(c => 
        c !== content && 
        !processed.has(c.url) && 
        this.areDuplicates(content, c)
      );

      if (duplicates.length > 0) {
        // Merge all duplicates into one entry
        const mergedContent = this.mergeContentEntries([content, ...duplicates]);
        mergedContents.push(mergedContent);
        
        // Mark all as processed
        processed.add(content.url);
        duplicates.forEach(d => processed.add(d.url));
      } else {
        mergedContents.push(content);
        processed.add(content.url);
      }
    }

    return mergedContents;
  }

  /**
   * Check if two content entries are duplicates
   */
  private areDuplicates(content1: ScrapedContent, content2: ScrapedContent): boolean {
    // Check URL similarity
    if (this.normalizeUrl(content1.url) === this.normalizeUrl(content2.url)) {
      return true;
    }

    // Check EIN match
    if (content1.organizationInfo?.ein && content2.organizationInfo?.ein &&
        content1.organizationInfo.ein === content2.organizationInfo.ein) {
      return true;
    }

    // Check organization name similarity
    if (content1.organizationInfo?.name && content2.organizationInfo?.name &&
        this.normalizeOrgName(content1.organizationInfo.name) === 
        this.normalizeOrgName(content2.organizationInfo.name)) {
      return true;
    }

    // Check content similarity
    const hash1 = this.generateContentHash(content1);
    const hash2 = this.generateContentHash(content2);
    return this.calculateSimilarity(hash1, hash2) >= this.similarityThreshold;
  }

  /**
   * Merge multiple content entries into one
   */
  private mergeContentEntries(contents: ScrapedContent[]): ScrapedContent {
    if (contents.length === 0) {
      throw new Error('Cannot merge empty content array');
    }

    if (contents.length === 1) {
      const singleContent = contents[0];
      if (!singleContent) {
        throw new Error('Unexpected undefined content in array');
      }
      return singleContent;
    }

    // Use the first content as base
    const base = contents[0];
    if (!base) {
      throw new Error('Base content is undefined');
    }
    
    // Merge contact information
    const allEmails = new Set<string>();
    const allPhones = new Set<string>();
    
    contents.forEach(content => {
      if (content.contactInfo?.emails) {
        content.contactInfo.emails.forEach(email => allEmails.add(email));
      }
      if (content.contactInfo?.phones) {
        content.contactInfo.phones.forEach(phone => allPhones.add(phone));
      }
    });

    // Create merged content
    const mergedContent: ScrapedContent = {
      ...base,
      contactInfo: allEmails.size > 0 || allPhones.size > 0 ? {
        ...base.contactInfo,
        emails: allEmails.size > 0 ? Array.from(allEmails) : base.contactInfo?.emails,
        phones: allPhones.size > 0 ? Array.from(allPhones) : base.contactInfo?.phones
      } : base.contactInfo
    };

    // Add source URLs for reference
    const sourceUrls = contents.map(c => c.url);
    if (mergedContent.organizationInfo) {
      mergedContent.organizationInfo.sourceUrls = sourceUrls;
    }

    return mergedContent;
  }

  /**
   * Get deduplication statistics
   */
  getStats(): {
    urlsCount: number;
    einsCount: number;
    orgNamesCount: number;
    contentHashesCount: number;
  } {
    return {
      urlsCount: this.seenUrls.size,
      einsCount: this.seenEINs.size,
      orgNamesCount: this.seenOrgNames.size,
      contentHashesCount: this.contentHashes.size
    };
  }

  /**
   * Clear deduplication cache
   */
  clearCache(): void {
    this.seenUrls.clear();
    this.seenEINs.clear();
    this.seenOrgNames.clear();
    this.contentHashes.clear();
    console.log('Deduplication cache cleared');
  }
}

// Export a default instance
export const deduplicationEngine = new DeduplicationEngine(); 