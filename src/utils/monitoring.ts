import type { ClassificationResult } from '../agents/classifier-agent';
import type { NonprofitVerificationResult } from '../agents/nonprofit-verifier';

/**
 * Enhanced monitoring interface for business model classification
 */
export interface ClassificationMonitoringResult {
  timestamp: Date;
  totalClassified: number;
  relevantCount: number;
  businessModelBreakdown: {
    nonprofit: number;
    b2b_service: number;
    vendor: number;
    unknown: number;
  };
  averageConfidence: number;
  reviewFlaggedCount: number;
  potentialFalsePositives: string[];
  excludedB2BCount: number;
  verificationStats?: {
    verified: number;
    failed: number;
    verificationRate: number;
  };
}

/**
 * Alert types for monitoring system
 */
export interface MonitoringAlert {
  type: 'high_b2b_detection' | 'low_nonprofit_rate' | 'verification_failure' | 'false_positive_pattern';
  severity: 'low' | 'medium' | 'high';
  message: string;
  data: any;
  timestamp: Date;
}

/**
 * Enhanced Monitoring System for Lead Miner
 * Tracks classification accuracy and business model detection
 */
export class MonitoringSystem {
  private alerts: MonitoringAlert[] = [];
  private classificationHistory: ClassificationMonitoringResult[] = [];
  private alertThresholds = {
    maxB2BRate: 0.3, // Alert if >30% classified as B2B
    minNonprofitRate: 0.1, // Alert if <10% classified as nonprofit
    minVerificationRate: 0.7, // Alert if <70% verification rate
    maxReviewFlagRate: 0.4 // Alert if >40% need review
  };

  /**
   * Analyze classification results and generate monitoring report
   */
  analyzeClassificationResults(
    results: ClassificationResult[], 
    verificationResults?: NonprofitVerificationResult[]
  ): ClassificationMonitoringResult {
    const relevant = results.filter(r => r.isRelevant);
    const reviewFlagged = results.filter(r => r.reviewFlag);
    
    // Business model breakdown
    const businessModelBreakdown = {
      nonprofit: results.filter(r => r.businessModel === 'nonprofit').length,
      b2b_service: results.filter(r => r.businessModel === 'b2b_service').length,
      vendor: results.filter(r => r.businessModel === 'vendor').length,
      unknown: results.filter(r => r.businessModel === 'unknown').length
    };

    // Count excluded B2B services
    const excludedB2BCount = results.filter(r => 
      (r.businessModel === 'b2b_service' || r.businessModel === 'vendor') && !r.isRelevant
    ).length;

    // Identify potential false positives
    const potentialFalsePositives = this.identifyPotentialFalsePositives(results);

    // Calculate verification stats if provided
    let verificationStats;
    if (verificationResults) {
      const verified = verificationResults.filter(v => v.isVerified).length;
      verificationStats = {
        verified,
        failed: verificationResults.length - verified,
        verificationRate: verified / verificationResults.length
      };
    }

    const monitoringResult: ClassificationMonitoringResult = {
      timestamp: new Date(),
      totalClassified: results.length,
      relevantCount: relevant.length,
      businessModelBreakdown,
      averageConfidence: relevant.reduce((sum, r) => sum + r.confidenceScore, 0) / relevant.length || 0,
      reviewFlaggedCount: reviewFlagged.length,
      potentialFalsePositives,
      excludedB2BCount,
      verificationStats
    };
      
    // Store in history
    this.classificationHistory.push(monitoringResult);

    // Generate alerts
    this.generateAlerts(monitoringResult);

    console.log('📊 Classification Monitoring Report Generated:');
    console.log(`  Total Classified: ${monitoringResult.totalClassified}`);
    console.log(`  Relevant: ${monitoringResult.relevantCount}`);
    console.log(`  Business Model Breakdown:`, monitoringResult.businessModelBreakdown);
    console.log(`  Excluded B2B: ${monitoringResult.excludedB2BCount}`);
    console.log(`  Review Flagged: ${monitoringResult.reviewFlaggedCount}`);
    console.log(`  Potential False Positives: ${monitoringResult.potentialFalsePositives.length}`);

    return monitoringResult;
  }

  /**
   * Identify potential false positives based on patterns
   */
  private identifyPotentialFalsePositives(results: ClassificationResult[]): string[] {
    const falsePositives: string[] = [];
    
    for (const result of results) {
      if (result.isRelevant) {
        // Check for B2B indicators in relevant results
        if (result.keywordMatches.b2bExclusions.length > 2) {
          falsePositives.push(`${result.id}: High B2B indicators but classified as relevant`);
        }
        
        // Check for low nonprofit indicators
        if (result.keywordMatches.nonprofitIndicators.length === 0 && result.businessModel === 'nonprofit') {
          falsePositives.push(`${result.id}: Classified as nonprofit but no nonprofit indicators found`);
        }
        
        // Check for conflicting business model and relevance
        if ((result.businessModel === 'b2b_service' || result.businessModel === 'vendor') && result.isRelevant) {
          falsePositives.push(`${result.id}: B2B/Vendor business model but marked relevant`);
      }

        // Check for low confidence but high relevance
        if (result.confidenceScore < 0.6 && result.isRelevant) {
          falsePositives.push(`${result.id}: Low confidence (${result.confidenceScore.toFixed(2)}) but marked relevant`);
    }
      }
    }
    
    return falsePositives;
  }

  /**
   * Generate alerts based on monitoring thresholds
   */
  private generateAlerts(result: ClassificationMonitoringResult): void {
    const total = result.totalClassified;
    if (total === 0) return;

    // High B2B detection rate
    const b2bRate = (result.businessModelBreakdown.b2b_service + result.businessModelBreakdown.vendor) / total;
    if (b2bRate > this.alertThresholds.maxB2BRate) {
      this.addAlert({
        type: 'high_b2b_detection',
        severity: 'medium',
        message: `High B2B detection rate: ${(b2bRate * 100).toFixed(1)}% of results classified as B2B services`,
        data: { rate: b2bRate, breakdown: result.businessModelBreakdown },
        timestamp: new Date()
      });
    }

    // Low nonprofit rate
    const nonprofitRate = result.businessModelBreakdown.nonprofit / total;
    if (nonprofitRate < this.alertThresholds.minNonprofitRate) {
      this.addAlert({
        type: 'low_nonprofit_rate',
        severity: 'high',
        message: `Low nonprofit detection rate: ${(nonprofitRate * 100).toFixed(1)}% of results classified as nonprofits`,
        data: { rate: nonprofitRate, breakdown: result.businessModelBreakdown },
        timestamp: new Date()
      });
    }

    // Verification failure rate
    if (result.verificationStats && result.verificationStats.verificationRate < this.alertThresholds.minVerificationRate) {
      this.addAlert({
        type: 'verification_failure',
        severity: 'high',
        message: `Low verification rate: ${(result.verificationStats.verificationRate * 100).toFixed(1)}% of nonprofits verified`,
        data: result.verificationStats,
        timestamp: new Date()
      });
    }

    // High review flag rate
    const reviewRate = result.reviewFlaggedCount / total;
    if (reviewRate > this.alertThresholds.maxReviewFlagRate) {
      this.addAlert({
        type: 'false_positive_pattern',
        severity: 'medium',
        message: `High review flag rate: ${(reviewRate * 100).toFixed(1)}% of results need human review`,
        data: { rate: reviewRate, count: result.reviewFlaggedCount },
        timestamp: new Date()
      });
    }

    // Potential false positives
    if (result.potentialFalsePositives.length > 0) {
      this.addAlert({
        type: 'false_positive_pattern',
        severity: 'medium',
        message: `${result.potentialFalsePositives.length} potential false positives detected`,
        data: { falsePositives: result.potentialFalsePositives },
        timestamp: new Date()
      });
    }
  }

  /**
   * Add alert to the system
   */
  private addAlert(alert: MonitoringAlert): void {
    this.alerts.push(alert);
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours: number = 24): MonitoringAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Get classification trends over time
   */
  getClassificationTrends(days: number = 7): any {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentHistory = this.classificationHistory.filter(h => h.timestamp > cutoff);
    
    if (recentHistory.length === 0) return null;

    return {
      averageNonprofitRate: recentHistory.reduce((sum, h) => 
        sum + (h.businessModelBreakdown.nonprofit / h.totalClassified), 0) / recentHistory.length,
      averageB2BRate: recentHistory.reduce((sum, h) => 
        sum + ((h.businessModelBreakdown.b2b_service + h.businessModelBreakdown.vendor) / h.totalClassified), 0) / recentHistory.length,
      averageConfidence: recentHistory.reduce((sum, h) => sum + h.averageConfidence, 0) / recentHistory.length,
      totalExcludedB2B: recentHistory.reduce((sum, h) => sum + h.excludedB2BCount, 0),
      dataPoints: recentHistory.length
    };
  }

  /**
   * Generate monitoring dashboard data
   */
  getDashboardData(): any {
    const recent = this.classificationHistory.slice(-10);
    const recentAlerts = this.getRecentAlerts(24);
    const trends = this.getClassificationTrends(7);

    return {
      recentClassifications: recent,
      recentAlerts: recentAlerts,
      trends: trends,
      summary: {
        totalAlerts: this.alerts.length,
        highSeverityAlerts: this.alerts.filter(a => a.severity === 'high').length,
        lastClassificationTime: recent.length > 0 ? recent[recent.length - 1]?.timestamp : null
      }
    };
  }

  /**
   * Clear old alerts and history
   */
  cleanup(daysToKeep: number = 30): void {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
    this.classificationHistory = this.classificationHistory.filter(history => history.timestamp > cutoff);
    
    console.log(`🧹 Monitoring data cleanup completed. Keeping last ${daysToKeep} days.`);
  }

  /**
   * Export monitoring report
   */
  exportReport(format: 'json' | 'csv' = 'json'): string {
    const dashboardData = this.getDashboardData();
    
    if (format === 'json') {
      return JSON.stringify(dashboardData, null, 2);
    } else {
      // Simple CSV export for alerts
      const csvLines = ['Type,Severity,Message,Timestamp'];
      for (const alert of dashboardData.recentAlerts) {
        csvLines.push(`${alert.type},${alert.severity},"${alert.message}",${alert.timestamp.toISOString()}`);
      }
      return csvLines.join('\n');
    }
  }
}

// Export singleton instance
export const monitoringSystem = new MonitoringSystem();