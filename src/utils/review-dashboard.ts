import type { ClassificationResult } from '../agents/classifier-agent';
import type { NonprofitVerificationResult } from '../agents/nonprofit-verifier';
import { monitoringSystem } from './monitoring';

/**
 * Review Dashboard for monitoring classification accuracy
 * Generates HTML interface for human review of results
 */
export class ReviewDashboard {
  /**
   * Generate HTML dashboard for classification review
   */
  generateDashboard(
    classifications: ClassificationResult[],
    verifications?: NonprofitVerificationResult[]
  ): string {
    const monitoringResult = monitoringSystem.analyzeClassificationResults(classifications, verifications);
    const dashboardData = monitoringSystem.getDashboardData();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead Miner - Classification Review Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        .alert {
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid;
        }
        .alert-high {
            background-color: #fee;
            border-color: #e74c3c;
            color: #c0392b;
        }
        .alert-medium {
            background-color: #fff3cd;
            border-color: #f39c12;
            color: #d68910;
        }
        .alert-low {
            background-color: #d4edda;
            border-color: #27ae60;
            color: #1e8449;
        }
        .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .section h2 {
            margin-top: 0;
            color: #333;
        }
        .business-model-chart {
            display: flex;
            height: 30px;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .model-segment {
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
        }
        .model-nonprofit { background-color: #27ae60; }
        .model-b2b { background-color: #e74c3c; }
        .model-vendor { background-color: #f39c12; }
        .model-unknown { background-color: #95a5a6; }
        .false-positive {
            background-color: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 5px;
            padding: 10px;
            margin: 5px 0;
        }
        .false-positive-id {
            font-weight: bold;
            color: #e53e3e;
        }
        .classification-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        .classification-table th,
        .classification-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .classification-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .relevant-yes { color: #27ae60; font-weight: bold; }
        .relevant-no { color: #e74c3c; }
        .confidence-high { color: #27ae60; }
        .confidence-medium { color: #f39c12; }
        .confidence-low { color: #e74c3c; }
        .business-model-tag {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .tag-nonprofit { background-color: #d4edda; color: #155724; }
        .tag-b2b { background-color: #f8d7da; color: #721c24; }
        .tag-vendor { background-color: #fff3cd; color: #856404; }
        .tag-unknown { background-color: #e2e3e5; color: #383d41; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Lead Miner Classification Review</h1>
            <p>Business Model Detection & False Positive Monitoring</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${monitoringResult.totalClassified}</div>
                <div class="stat-label">Total Classified</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${monitoringResult.relevantCount}</div>
                <div class="stat-label">Relevant Leads</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${monitoringResult.excludedB2BCount}</div>
                <div class="stat-label">B2B Excluded</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${(monitoringResult.averageConfidence * 100).toFixed(1)}%</div>
                <div class="stat-label">Avg Confidence</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${monitoringResult.reviewFlaggedCount}</div>
                <div class="stat-label">Need Review</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${monitoringResult.potentialFalsePositives.length}</div>
                <div class="stat-label">Potential False Positives</div>
            </div>
        </div>

        ${this.generateAlertsSection(dashboardData.recentAlerts)}
        
        ${this.generateBusinessModelSection(monitoringResult)}
        
        ${this.generateFalsePositivesSection(monitoringResult.potentialFalsePositives)}
        
        ${this.generateClassificationTableSection(classifications)}
        
        ${verifications ? this.generateVerificationSection(verifications) : ''}
    </div>

    <script>
        // Auto-refresh every 5 minutes
        setTimeout(() => {
            window.location.reload();
        }, 300000);
    </script>
</body>
</html>
    `;
  }

  /**
   * Generate alerts section
   */
  private generateAlertsSection(alerts: any[]): string {
    if (alerts.length === 0) {
      return `
        <div class="section">
            <h2>🟢 System Alerts</h2>
            <p>No alerts in the last 24 hours. System operating normally.</p>
        </div>
      `;
    }

    const alertsHtml = alerts.map(alert => `
      <div class="alert alert-${alert.severity}">
        <strong>${alert.type.replace(/_/g, ' ').toUpperCase()}:</strong> ${alert.message}
        <br><small>${new Date(alert.timestamp).toLocaleString()}</small>
      </div>
    `).join('');

    return `
      <div class="section">
          <h2>🚨 System Alerts (${alerts.length})</h2>
          ${alertsHtml}
      </div>
    `;
  }

  /**
   * Generate business model breakdown section
   */
  private generateBusinessModelSection(result: any): string {
    const total = result.totalClassified;
    const breakdown = result.businessModelBreakdown;
    
    const nonprofitPct = (breakdown.nonprofit / total * 100).toFixed(1);
    const b2bPct = (breakdown.b2b_service / total * 100).toFixed(1);
    const vendorPct = (breakdown.vendor / total * 100).toFixed(1);
    const unknownPct = (breakdown.unknown / total * 100).toFixed(1);

    return `
      <div class="section">
          <h2>📊 Business Model Classification</h2>
          <div class="business-model-chart">
              <div class="model-segment model-nonprofit" style="flex: ${breakdown.nonprofit}">
                  ${breakdown.nonprofit > 0 ? `${breakdown.nonprofit} (${nonprofitPct}%)` : ''}
              </div>
              <div class="model-segment model-b2b" style="flex: ${breakdown.b2b_service}">
                  ${breakdown.b2b_service > 0 ? `${breakdown.b2b_service} (${b2bPct}%)` : ''}
              </div>
              <div class="model-segment model-vendor" style="flex: ${breakdown.vendor}">
                  ${breakdown.vendor > 0 ? `${breakdown.vendor} (${vendorPct}%)` : ''}
              </div>
              <div class="model-segment model-unknown" style="flex: ${breakdown.unknown}">
                  ${breakdown.unknown > 0 ? `${breakdown.unknown} (${unknownPct}%)` : ''}
              </div>
          </div>
          <div style="margin-top: 15px;">
              <span class="business-model-tag tag-nonprofit">Nonprofit: ${breakdown.nonprofit} (${nonprofitPct}%)</span>
              <span class="business-model-tag tag-b2b">B2B Service: ${breakdown.b2b_service} (${b2bPct}%)</span>
              <span class="business-model-tag tag-vendor">Vendor: ${breakdown.vendor} (${vendorPct}%)</span>
              <span class="business-model-tag tag-unknown">Unknown: ${breakdown.unknown} (${unknownPct}%)</span>
          </div>
      </div>
    `;
  }

  /**
   * Generate false positives section
   */
  private generateFalsePositivesSection(falsePositives: string[]): string {
    if (falsePositives.length === 0) {
      return `
        <div class="section">
            <h2>✅ False Positive Analysis</h2>
            <p>No potential false positives detected in this batch.</p>
        </div>
      `;
    }

    const fpHtml = falsePositives.map(fp => {
      const [id, ...reason] = fp.split(': ');
      return `
        <div class="false-positive">
            <span class="false-positive-id">${id}</span>: ${reason.join(': ')}
        </div>
      `;
    }).join('');

    return `
      <div class="section">
          <h2>⚠️ Potential False Positives (${falsePositives.length})</h2>
          <p>These results may need human review:</p>
          ${fpHtml}
      </div>
    `;
  }

  /**
   * Generate classification results table
   */
  private generateClassificationTableSection(classifications: ClassificationResult[]): string {
    // Show only first 20 results to keep page manageable
    const displayResults = classifications.slice(0, 20);
    
    const tableRows = displayResults.map(result => {
      const confidenceClass = result.confidenceScore >= 0.8 ? 'confidence-high' : 
                             result.confidenceScore >= 0.6 ? 'confidence-medium' : 'confidence-low';
      
      const businessModelClass = `tag-${result.businessModel.replace('_', '')}`;
      
      return `
        <tr>
            <td>${result.id.substring(0, 8)}...</td>
            <td class="${result.isRelevant ? 'relevant-yes' : 'relevant-no'}">
                ${result.isRelevant ? 'YES' : 'NO'}
            </td>
            <td class="${confidenceClass}">${(result.confidenceScore * 100).toFixed(1)}%</td>
            <td><span class="business-model-tag ${businessModelClass}">${result.businessModel}</span></td>
            <td>${result.hasAuctionKeywords ? '✓' : '✗'}</td>
            <td>${result.hasTravelKeywords ? '✓' : '✗'}</td>
            <td>${result.isNonprofit ? '✓' : '✗'}</td>
            <td>${result.reviewFlag ? '⚠️' : '✅'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="section">
          <h2>📋 Classification Results (Showing ${displayResults.length} of ${classifications.length})</h2>
          <table class="classification-table">
              <thead>
                  <tr>
                      <th>ID</th>
                      <th>Relevant</th>
                      <th>Confidence</th>
                      <th>Business Model</th>
                      <th>Auction</th>
                      <th>Travel</th>
                      <th>Nonprofit</th>
                      <th>Review</th>
                  </tr>
              </thead>
              <tbody>
                  ${tableRows}
              </tbody>
          </table>
          ${classifications.length > 20 ? `<p><em>... and ${classifications.length - 20} more results</em></p>` : ''}
      </div>
    `;
  }

  /**
   * Generate verification results section
   */
  private generateVerificationSection(verifications: NonprofitVerificationResult[]): string {
    const verified = verifications.filter(v => v.isVerified);
    const failed = verifications.filter(v => !v.isVerified);
    
    const verificationRate = (verified.length / verifications.length * 100).toFixed(1);
    
    return `
      <div class="section">
          <h2>🔍 Nonprofit Verification Results</h2>
          <div class="stats-grid">
              <div class="stat-card">
                  <div class="stat-value">${verified.length}</div>
                  <div class="stat-label">Verified</div>
              </div>
              <div class="stat-card">
                  <div class="stat-value">${failed.length}</div>
                  <div class="stat-label">Failed</div>
              </div>
              <div class="stat-card">
                  <div class="stat-value">${verificationRate}%</div>
                  <div class="stat-label">Success Rate</div>
              </div>
          </div>
      </div>
    `;
  }

  /**
   * Save dashboard to file
   */
  async saveDashboard(
    classifications: ClassificationResult[],
    verifications?: NonprofitVerificationResult[],
    filename?: string
  ): Promise<string> {
    const html = this.generateDashboard(classifications, verifications);
    const fs = await import('fs/promises');
    
    const fileName = filename || `classification-review-${new Date().toISOString().split('T')[0]}.html`;
    await fs.writeFile(fileName, html, 'utf-8');
    
    console.log(`📊 Review dashboard saved to: ${fileName}`);
    return fileName;
  }
}

// Export singleton instance
export const reviewDashboard = new ReviewDashboard(); 