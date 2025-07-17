import { config } from '../config';

/**
 * Cost tracking interface
 */
interface CostEntry {
  timestamp: Date;
  service: 'openai' | 'serpapi' | 'other';
  operation: string;
  cost: number;
  tokensUsed?: number;
  requestCount?: number;
  details?: any;
}

/**
 * Budget status interface
 */
interface BudgetStatus {
  totalSpent: number;
  budgetLimit: number;
  remainingBudget: number;
  percentageUsed: number;
  dailySpend: number;
  projectedMonthlySpend: number;
  isOverBudget: boolean;
  isNearBudget: boolean;
}

/**
 * Service cost configuration
 */
const SERVICE_COSTS = {
  openai: {
    'gpt-4.1-mini': {
      input: 0.0000015, // Estimated similar to gpt-4o-mini
      output: 0.000006  // Estimated similar to gpt-4o-mini
    },
    'o4-mini': {
      input: 0.00000116, // $1.16 per 1M tokens
      output: 0.00000462  // $4.62 per 1M tokens
    },
    'gpt-4o-mini': {
      input: 0.00000015, // $0.00015 per 1K tokens
      output: 0.0000006  // $0.0006 per 1K tokens
    },
    'text-embedding-3-small': {
      input: 0.00000002, // $0.00002 per 1K tokens
      output: 0
    }
  },
  serpapi: {
    search: 0.015 // $0.015 per search (estimated from basic plan)
  }
};

/**
 * Cost Monitor
 * Tracks API usage and enforces budget limits
 */
export class CostMonitor {
  private costs: CostEntry[] = [];
  private budgetLimit: number;
  private warningThreshold: number = 0.8; // 80% of budget
  private criticalThreshold: number = 0.95; // 95% of budget

  constructor() {
    this.budgetLimit = config.limits.budgetLimit;
    this.loadCostHistory();
  }

  /**
   * Track OpenAI API usage
   */
  trackOpenAIUsage(model: string, inputTokens: number, outputTokens: number, operation: string): number {
    const modelCosts = SERVICE_COSTS.openai[model as keyof typeof SERVICE_COSTS.openai];
    if (!modelCosts) {
      console.warn(`⚠️ Unknown OpenAI model: ${model}`);
      return 0;
    }

    const inputCost = (inputTokens / 1000) * modelCosts.input;
    const outputCost = (outputTokens / 1000) * modelCosts.output;
    const totalCost = inputCost + outputCost;

    this.addCostEntry({
      timestamp: new Date(),
      service: 'openai',
      operation: `${model}: ${operation}`,
      cost: totalCost,
      tokensUsed: inputTokens + outputTokens,
      details: {
        model,
        inputTokens,
        outputTokens,
        inputCost,
        outputCost
      }
    });

    console.log(`💰 OpenAI ${model} cost: $${totalCost.toFixed(6)} (${inputTokens + outputTokens} tokens)`);
    return totalCost;
  }

  /**
   * Track SerpAPI usage
   */
  trackSerpAPIUsage(query: string, resultCount: number): number {
    const cost = SERVICE_COSTS.serpapi.search;

    this.addCostEntry({
      timestamp: new Date(),
      service: 'serpapi',
      operation: 'search',
      cost,
      requestCount: 1,
      details: {
        query,
        resultCount
      }
    });

    console.log(`💰 SerpAPI search cost: $${cost.toFixed(3)} (${resultCount} results)`);
    return cost;
  }

  /**
   * Track other service usage
   */
  trackOtherUsage(service: string, operation: string, cost: number): number {
    this.addCostEntry({
      timestamp: new Date(),
      service: 'other',
      operation: `${service}: ${operation}`,
      cost,
      details: { service }
    });

    console.log(`💰 ${service} cost: $${cost.toFixed(6)}`);
    return cost;
  }

  /**
   * Add cost entry and check budget
   */
  private addCostEntry(entry: CostEntry): void {
    this.costs.push(entry);
    this.checkBudgetStatus();
    this.saveCostHistory();
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): BudgetStatus {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const monthlySpend = this.getTotalSpend(monthStart);
    const dailySpend = this.getTotalSpend(today);
    
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = now.getDate();
    const projectedMonthlySpend = (monthlySpend / daysPassed) * daysInMonth;

    return {
      totalSpent: monthlySpend,
      budgetLimit: this.budgetLimit,
      remainingBudget: this.budgetLimit - monthlySpend,
      percentageUsed: (monthlySpend / this.budgetLimit) * 100,
      dailySpend,
      projectedMonthlySpend,
      isOverBudget: monthlySpend > this.budgetLimit,
      isNearBudget: monthlySpend > (this.budgetLimit * this.warningThreshold)
    };
  }

  /**
   * Check if operation is allowed within budget
   */
  canAffordOperation(estimatedCost: number): boolean {
    const status = this.getBudgetStatus();
    return (status.totalSpent + estimatedCost) <= this.budgetLimit;
  }

  /**
   * Get total spend for a time period
   */
  private getTotalSpend(since: Date): number {
    return this.costs
      .filter(entry => entry.timestamp >= since)
      .reduce((total, entry) => total + entry.cost, 0);
  }

  /**
   * Check budget status and issue warnings
   */
  private checkBudgetStatus(): void {
    const status = this.getBudgetStatus();

    if (status.isOverBudget) {
      console.error(`🚨 BUDGET EXCEEDED: $${status.totalSpent.toFixed(2)} / $${status.budgetLimit.toFixed(2)}`);
      console.error('🛑 All operations should be halted until next billing cycle');
    } else if (status.percentageUsed > this.criticalThreshold * 100) {
      console.warn(`⚠️ CRITICAL: ${status.percentageUsed.toFixed(1)}% of budget used`);
      console.warn('🔔 Consider reducing operations to stay within budget');
    } else if (status.isNearBudget) {
      console.warn(`⚠️ WARNING: ${status.percentageUsed.toFixed(1)}% of budget used`);
      console.warn('💡 Monitor spending closely');
    }

    // Log daily summary
    if (status.dailySpend > 0) {
      console.log(`📊 Daily spend: $${status.dailySpend.toFixed(3)} | Monthly: $${status.totalSpent.toFixed(2)} | Projected: $${status.projectedMonthlySpend.toFixed(2)}`);
    }
  }

  /**
   * Get cost breakdown by service
   */
  getCostBreakdown(since?: Date): { [service: string]: number } {
    const sinceDate = since || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const relevantCosts = this.costs.filter(entry => entry.timestamp >= sinceDate);

    return relevantCosts.reduce((breakdown, entry) => {
      const key = entry.service === 'other' ? entry.operation.split(':')[0] : entry.service;
      if (key) {
        breakdown[key] = (breakdown[key] || 0) + entry.cost;
      }
      return breakdown;
    }, {} as { [service: string]: number });
  }

  /**
   * Get detailed cost report
   */
  getCostReport(): {
    status: BudgetStatus;
    breakdown: { [service: string]: number };
    recentEntries: CostEntry[];
    recommendations: string[];
  } {
    const status = this.getBudgetStatus();
    const breakdown = this.getCostBreakdown();
    const recentEntries = this.costs.slice(-10); // Last 10 entries

    const recommendations = this.generateRecommendations(status, breakdown);

    return {
      status,
      breakdown,
      recentEntries,
      recommendations
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateRecommendations(status: BudgetStatus, breakdown: { [service: string]: number }): string[] {
    const recommendations: string[] = [];

    if (status.isOverBudget) {
      recommendations.push('🛑 Halt all non-essential operations immediately');
      recommendations.push('📊 Review and optimize high-cost operations');
    } else if (status.isNearBudget) {
      recommendations.push('⚠️ Reduce search frequency to conserve budget');
      recommendations.push('🎯 Focus on high-confidence leads only');
    }

    // Service-specific recommendations
    if ((breakdown['openai'] || 0) > (breakdown['serpapi'] || 0)) {
      recommendations.push('🤖 Consider using simpler models for basic tasks');
      recommendations.push('💾 Implement more aggressive caching');
    }

    if ((breakdown['serpapi'] || 0) > 15) {
      recommendations.push('🔍 Optimize search queries to reduce API calls');
      recommendations.push('📝 Implement better result filtering');
    }

    if (status.projectedMonthlySpend > status.budgetLimit * 1.1) {
      recommendations.push('📈 Current usage projects 10%+ over budget');
      recommendations.push('🎛️ Consider adjusting daily limits');
    }

    return recommendations;
  }

  /**
   * Load cost history from storage (file-based implementation)
   */
  private loadCostHistory(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const historyFile = path.join(process.cwd(), 'cost-history.json');
      
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf8');
        const history = JSON.parse(data);
                 // Load the data into current cost tracking
         this.costs = history.entries || [];
         const totalCost = this.costs.reduce((sum, entry) => sum + entry.cost, 0);
         console.log(`💾 Loaded cost history: $${totalCost.toFixed(2)}`);
      } else {
        console.log('💾 No cost history file found, starting fresh');
      }
    } catch (error) {
      console.error('Error loading cost history:', error);
    }
  }

  /**
   * Save cost history to storage (file-based implementation)
   */
  private saveCostHistory(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const historyFile = path.join(process.cwd(), 'cost-history.json');
      
             const totalCost = this.costs.reduce((sum, entry) => sum + entry.cost, 0);
       const historyData = {
         totalCost: totalCost,
         lastUpdated: new Date().toISOString(),
         entries: this.costs
       };
       
       fs.writeFileSync(historyFile, JSON.stringify(historyData, null, 2));
       console.log(`💾 Saved cost history: $${totalCost.toFixed(2)}`);
    } catch (error) {
      console.error('Error saving cost history:', error);
    }
    const status = this.getBudgetStatus();
    if (status.dailySpend > 0) {
      console.log(`💾 Cost history saved - Total: $${status.totalSpent.toFixed(3)}`);
    }
  }

  /**
   * Reset monthly costs (for testing)
   */
  resetMonthlyCosts(): void {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.costs = this.costs.filter(entry => entry.timestamp < monthStart);
    console.log('🔄 Monthly costs reset');
  }

  /**
   * Estimate cost for operation
   */
  estimateOpenAICost(model: string, estimatedTokens: number): number {
    const modelCosts = SERVICE_COSTS.openai[model as keyof typeof SERVICE_COSTS.openai];
    if (!modelCosts) return 0;

    // Assume 70% input, 30% output tokens
    const inputTokens = Math.floor(estimatedTokens * 0.7);
    const outputTokens = Math.floor(estimatedTokens * 0.3);

    return (inputTokens / 1000) * modelCosts.input + (outputTokens / 1000) * modelCosts.output;
  }
}

// Export singleton instance
export const costMonitor = new CostMonitor(); 