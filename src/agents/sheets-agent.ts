import { Lead } from '../types';
import { SheetsManager } from '../utils/sheets';

/**
 * Google Sheets Agent
 * Handles output to Google Sheets with best practices formatting
 */
export class SheetsAgent {
  private sheetsManager: SheetsManager;

  constructor() {
    this.sheetsManager = new SheetsManager();
    console.log('📊 SheetsAgent initialized with REAL Google Sheets API');
  }

  /**
   * Add leads to the main tracking sheet
   */
  async addLeads(leads: Lead[]): Promise<void> {
    if (leads.length === 0) return;

    console.log(`📊 Adding ${leads.length} REAL leads to Google Sheets`);

    try {
      await this.sheetsManager.addLeads(leads);
      console.log(`✅ Successfully added ${leads.length} leads to Google Sheets`);
    } catch (error) {
      console.error('❌ Error adding leads to Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Write leads to Google Sheets (enhanced method)
   */
  async writeLeads(leads: Lead[]): Promise<void> {
    return this.addLeads(leads);
  }

  /**
   * Write a test "Hello World" entry
   */
  async writeHelloWorld(): Promise<void> {
    try {
      await this.sheetsManager.writeHelloWorld();
      console.log('✅ Hello World test entry added to Google Sheets');
    } catch (error) {
      console.error('❌ Error writing Hello World entry:', error);
      throw error;
    }
  }

  /**
   * Get current lead count for budget monitoring
   */
  async getCurrentLeadCount(): Promise<number> {
    try {
      // This would need to be implemented in SheetsManager
      return 0; // Placeholder
    } catch (error) {
      console.error('❌ Error getting lead count:', error);
      return 0;
    }
  }

  /**
   * Update daily summary
   */
  async updateDailySummary(summary: {
    date: Date;
    totalLeads: number;
    qualifiedLeads: number;
    averageConfidence: number;
    topRegions: string[];
    budgetUsed: number;
    apiCallsMade: number;
  }): Promise<void> {
    try {
      await this.sheetsManager.updateDailySummary(summary);
      console.log('✅ Daily summary updated');
    } catch (error) {
      console.error('❌ Error updating daily summary:', error);
      throw error;
    }
  }

  /**
   * Update quality metrics
   */
  async updateQualityMetrics(metrics: {
    totalProcessed: number;
    falsePositives: number;
    precision: number;
    verificationRate: number;
  }): Promise<void> {
    try {
      await this.sheetsManager.updateQualityMetrics({
        date: new Date(),
        precisionRate: metrics.precision,
        falsePositives: metrics.falsePositives,
        reviewRequired: 0,
        modelPerformance: metrics.verificationRate,
        feedback: `Processed ${metrics.totalProcessed} items`
      });
      console.log('✅ Quality metrics updated');
    } catch (error) {
      console.error('❌ Error updating quality metrics:', error);
    }
  }
}

// Export singleton instance
export const sheetsAgent = new SheetsAgent(); 