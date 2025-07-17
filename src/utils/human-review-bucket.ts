import { sheetsManager } from './sheets';
import { ClassificationResult } from '../agents/classifier-agent';
import { NonprofitVerificationResult } from '../agents/nonprofit-verifier';
import { ScrapedContent } from '../types';

/**
 * Review Lead Interface
 */
export interface ReviewLead {
  id: string;
  url: string;
  orgName: string;
  eventName: string;
  classification: ClassificationResult;
  verification?: NonprofitVerificationResult;
  reviewReason: string;
  priorityScore: number; // 0-10 scale for review priority
  addedAt: Date;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'needs_info';
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

/**
 * Human Review Bucket
 * Manages leads that require manual review in a separate Google Sheets tab
 */
export class HumanReviewBucket {
  private reviewSheetName = 'Manual Review';
  private reviewSheetHeaders = [
    'Date Added',
    'Priority',
    'Organization',
    'Event Name',
    'URL',
    'Classification Score',
    'Verification Status',
    'Review Reason',
    'Auction Keywords',
    'Travel Keywords',
    'Nonprofit Keywords',
    'Consistency Score',
    'Geographic Match',
    'Date Relevance',
    'Review Status',
    'Notes',
    'Reviewed By',
    'Review Date'
  ];

  constructor() {}

  /**
   * Add lead to human review bucket
   */
  async addToReview(
    content: ScrapedContent,
    classification: ClassificationResult,
    verification?: NonprofitVerificationResult,
    reviewReason?: string
  ): Promise<void> {
    console.log(`Adding lead to human review: ${content.url}`);

    const reviewLead: ReviewLead = {
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: content.url,
      orgName: content.organizationInfo?.name || this.extractOrgNameFromTitle(content.title),
      eventName: content.eventInfo?.title || content.title,
      classification,
      verification,
      reviewReason: reviewReason || this.determineReviewReason(classification),
      priorityScore: this.calculatePriorityScore(classification, verification),
      addedAt: new Date(),
      reviewStatus: 'pending'
    };

    await this.writeToReviewSheet(reviewLead);
  }

  /**
   * Add multiple leads to review bucket
   */
  async addBatchToReview(
    leads: Array<{
      content: ScrapedContent;
      classification: ClassificationResult;
      verification?: NonprofitVerificationResult;
      reviewReason?: string;
    }>
  ): Promise<void> {
    console.log(`Adding ${leads.length} leads to human review bucket`);

    const reviewLeads: ReviewLead[] = leads.map(lead => ({
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: lead.content.url,
      orgName: lead.content.organizationInfo?.name || this.extractOrgNameFromTitle(lead.content.title),
      eventName: lead.content.eventInfo?.title || lead.content.title,
      classification: lead.classification,
      verification: lead.verification,
      reviewReason: lead.reviewReason || this.determineReviewReason(lead.classification),
      priorityScore: this.calculatePriorityScore(lead.classification, lead.verification),
      addedAt: new Date(),
      reviewStatus: 'pending'
    }));

    await this.writeBatchToReviewSheet(reviewLeads);
  }

  /**
   * Filter leads that need human review
   */
  filterForReview(
    contentItems: ScrapedContent[],
    classifications: ClassificationResult[],
    verifications?: NonprofitVerificationResult[]
  ): Array<{
    content: ScrapedContent;
    classification: ClassificationResult;
    verification?: NonprofitVerificationResult;
    reviewReason: string;
  }> {
    const reviewItems = [];

    for (let i = 0; i < contentItems.length; i++) {
      const content = contentItems[i];
      const classification = classifications[i];
      const verification = verifications?.[i];

      if (content && classification && this.needsHumanReview(classification, verification)) {
        reviewItems.push({
          content,
          classification,
          verification,
          reviewReason: this.determineReviewReason(classification, verification)
        });
      }
    }

    return reviewItems;
  }

  /**
   * Check if lead needs human review
   */
  private needsHumanReview(
    classification: ClassificationResult,
    verification?: NonprofitVerificationResult
  ): boolean {
    // Already flagged by classifier
    if (classification.reviewFlag) {
      return true;
    }

    // Borderline confidence scores
    if (classification.confidenceScore >= 0.6 && classification.confidenceScore <= 0.8) {
      return true;
    }

    // Low self-consistency
    if (classification.selfConsistencyScore < 0.7) {
      return true;
    }

    // Conflicting signals
    if (classification.hasAuctionKeywords && !classification.hasTravelKeywords) {
      return true;
    }

    // Verification issues
    if (verification && !verification.isVerified && classification.isNonprofit) {
      return true;
    }

    // High confidence but missing key information
    if (classification.confidenceScore > 0.8 && !classification.dateRelevance) {
      return true;
    }

    return false;
  }

  /**
   * Determine review reason
   */
  private determineReviewReason(
    classification: ClassificationResult,
    verification?: NonprofitVerificationResult
  ): string {
    const reasons = [];

    if (classification.reviewFlag) {
      reasons.push('Flagged by classifier');
    }

    if (classification.confidenceScore >= 0.6 && classification.confidenceScore <= 0.8) {
      reasons.push('Borderline confidence');
    }

    if (classification.selfConsistencyScore < 0.7) {
      reasons.push('Low consistency');
    }

    if (classification.hasAuctionKeywords && !classification.hasTravelKeywords) {
      reasons.push('Auction without travel');
    }

    if (verification && !verification.isVerified && classification.isNonprofit) {
      reasons.push('Nonprofit verification failed');
    }

    if (!classification.dateRelevance) {
      reasons.push('Date relevance unclear');
    }

    if (!classification.geographicRelevance) {
      reasons.push('Geographic relevance unclear');
    }

    return reasons.join(', ') || 'Manual review requested';
  }

  /**
   * Calculate priority score for review
   */
  private calculatePriorityScore(
    classification: ClassificationResult,
    verification?: NonprofitVerificationResult
  ): number {
    let score = 5; // Base priority

    // Higher confidence = higher priority
    score += classification.confidenceScore * 2;

    // Verified nonprofits get higher priority
    if (verification?.isVerified) {
      score += 1;
    }

    // Recent events get higher priority
    if (classification.dateRelevance) {
      score += 1;
    }

    // Good consistency gets higher priority
    if (classification.selfConsistencyScore > 0.8) {
      score += 1;
    }

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Write single lead to review sheet
   */
  private async writeToReviewSheet(reviewLead: ReviewLead): Promise<void> {
    try {
      await sheetsManager.ensureSheetExists(this.reviewSheetName, this.reviewSheetHeaders);
      
      const rowData = {
        'Date Added': reviewLead.addedAt.toISOString().split('T')[0],
        'Priority': reviewLead.priorityScore.toString(),
        'Organization': reviewLead.orgName,
        'Event Name': reviewLead.eventName,
        'URL': reviewLead.url,
        'Classification Score': reviewLead.classification.confidenceScore.toFixed(2),
        'Verification Status': reviewLead.verification?.isVerified ? 'Verified' : 'Unverified',
        'Review Reason': reviewLead.reviewReason,
        'Auction Keywords': reviewLead.classification.keywordMatches.auction.join(', '),
        'Travel Keywords': reviewLead.classification.keywordMatches.travel.join(', '),
        'Nonprofit Keywords': reviewLead.classification.keywordMatches.nonprofit.join(', '),
        'Consistency Score': reviewLead.classification.selfConsistencyScore.toFixed(2),
        'Geographic Match': reviewLead.classification.geographicRelevance ? 'Yes' : 'No',
        'Date Relevance': reviewLead.classification.dateRelevance ? 'Yes' : 'No',
        'Review Status': reviewLead.reviewStatus,
        'Notes': reviewLead.reviewNotes || '',
        'Reviewed By': reviewLead.reviewedBy || '',
        'Review Date': reviewLead.reviewedAt ? reviewLead.reviewedAt.toISOString().split('T')[0] : ''
      };

      await sheetsManager.addRow(this.reviewSheetName, rowData);
      console.log(`✅ Review lead added to Google Sheets: ${reviewLead.orgName}`);
    } catch (error) {
      console.error('Failed to write review lead to Google Sheets:', error);
    }
  }

  /**
   * Write batch of leads to review sheet
   */
  private async writeBatchToReviewSheet(reviewLeads: ReviewLead[]): Promise<void> {
    try {
      await sheetsManager.ensureSheetExists(this.reviewSheetName, this.reviewSheetHeaders);
      
      const rowsData = reviewLeads.map(reviewLead => ({
        'Date Added': reviewLead.addedAt.toISOString().split('T')[0],
        'Priority': reviewLead.priorityScore.toString(),
        'Organization': reviewLead.orgName,
        'Event Name': reviewLead.eventName,
        'URL': reviewLead.url,
        'Classification Score': reviewLead.classification.confidenceScore.toFixed(2),
        'Verification Status': reviewLead.verification?.isVerified ? 'Verified' : 'Unverified',
        'Review Reason': reviewLead.reviewReason,
        'Auction Keywords': reviewLead.classification.keywordMatches.auction.join(', '),
        'Travel Keywords': reviewLead.classification.keywordMatches.travel.join(', '),
        'Nonprofit Keywords': reviewLead.classification.keywordMatches.nonprofit.join(', '),
        'Consistency Score': reviewLead.classification.selfConsistencyScore.toFixed(2),
        'Geographic Match': reviewLead.classification.geographicRelevance ? 'Yes' : 'No',
        'Date Relevance': reviewLead.classification.dateRelevance ? 'Yes' : 'No',
        'Review Status': reviewLead.reviewStatus,
        'Notes': reviewLead.reviewNotes || '',
        'Reviewed By': reviewLead.reviewedBy || '',
        'Review Date': reviewLead.reviewedAt ? reviewLead.reviewedAt.toISOString().split('T')[0] : ''
      }));

      await sheetsManager.addRows(this.reviewSheetName, rowsData);
      console.log(`${reviewLeads.length} review leads added to sheet`);
      
    } catch (error) {
      console.error('Failed to write batch to review sheet:', error);
      throw error;
    }
  }

  /**
   * Extract organization name from title
   */
  private extractOrgNameFromTitle(title: string): string {
    // Remove common event words to extract organization name
    const cleaned = title
      .replace(/\s+(auction|raffle|gala|event|fundraiser|benefit|dinner|luncheon).*$/i, '')
      .replace(/\s+(annual|spring|fall|summer|winter|2024|2025)\s+/i, ' ')
      .trim();
    
    return cleaned || 'Unknown Organization';
  }

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<{
    totalPending: number;
    totalApproved: number;
    totalRejected: number;
    averagePriority: number;
    topReasons: Array<{ reason: string; count: number }>;
  }> {
    try {
      const sheet = await sheetsManager.getSheet(this.reviewSheetName);
      const rows = await sheet.getRows();
      
      const stats = {
        totalPending: rows.filter((r: any) => r['Review Status'] === 'pending').length,
        totalApproved: rows.filter((r: any) => r['Review Status'] === 'approved').length,
        totalRejected: rows.filter((r: any) => r['Review Status'] === 'rejected').length,
        averagePriority: 0,
        topReasons: [] as Array<{ reason: string; count: number }>
      };

      // Calculate average priority
      const priorities = rows.map((r: any) => parseInt(r['Priority']) || 0);
      stats.averagePriority = priorities.reduce((sum: number, p: number) => sum + p, 0) / priorities.length || 0;

      // Count review reasons
      const reasonCounts = new Map<string, number>();
      rows.forEach((row: any) => {
        const reasons = row['Review Reason']?.split(', ') || [];
        reasons.forEach((reason: string) => {
          reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        });
      });

      // Top 5 reasons
      stats.topReasons = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      return stats;
      
    } catch (error) {
      console.error('Failed to get review stats:', error);
      return {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        averagePriority: 0,
        topReasons: []
      };
    }
  }

  /**
   * Update review status
   */
  async updateReviewStatus(
    url: string,
    status: 'approved' | 'rejected' | 'needs_info',
    notes?: string,
    reviewedBy?: string
  ): Promise<void> {
    try {
      const sheet = await sheetsManager.getSheet(this.reviewSheetName);
      const rows = await sheet.getRows();
      
      const targetRow = rows.find((row: any) => row['URL'] === url);
      if (targetRow) {
        targetRow['Review Status'] = status;
        targetRow['Notes'] = notes || '';
        targetRow['Reviewed By'] = reviewedBy || '';
        targetRow['Review Date'] = new Date().toISOString().split('T')[0];
        
        await targetRow.save();
        console.log(`Review status updated for ${url}: ${status}`);
      } else {
        console.warn(`Review item not found for URL: ${url}`);
      }
      
    } catch (error) {
      console.error('Failed to update review status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const humanReviewBucket = new HumanReviewBucket(); 