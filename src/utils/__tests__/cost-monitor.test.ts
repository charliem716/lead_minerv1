import { CostMonitor, costMonitor } from '../cost-monitor';

describe('CostMonitor', () => {
  let monitor: CostMonitor;

  beforeEach(() => {
    monitor = new CostMonitor();
    monitor.resetMonthlyCosts();
  });

  describe('trackOpenAIUsage', () => {
    it('should track OpenAI usage correctly', () => {
      const cost = monitor.trackOpenAIUsage('o4-mini', 1000, 500, 'classification');
      
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBe(1000 / 1000 * 0.000003 + 500 / 1000 * 0.000012); // Expected calculation
    });

    it('should handle unknown models gracefully', () => {
      const cost = monitor.trackOpenAIUsage('unknown-model', 1000, 500, 'test');
      
      expect(cost).toBe(0);
    });

    it('should track gpt-4.1-mini usage', () => {
      const cost = monitor.trackOpenAIUsage('gpt-4.1-mini', 2000, 1000, 'simple-task');
      
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBe(2000 / 1000 * 0.00000015 + 1000 / 1000 * 0.0000006);
    });
  });

  describe('trackSerpAPIUsage', () => {
    it('should track SerpAPI usage correctly', () => {
      const cost = monitor.trackSerpAPIUsage('nonprofit travel auction', 10);
      
      expect(cost).toBe(0.015);
    });
  });

  describe('trackOtherUsage', () => {
    it('should track other service usage', () => {
      const cost = monitor.trackOtherUsage('custom-service', 'operation', 0.05);
      
      expect(cost).toBe(0.05);
    });
  });

  describe('getBudgetStatus', () => {
    it('should return correct budget status', () => {
      // Add some usage
      monitor.trackOpenAIUsage('o4-mini', 10000, 5000, 'test');
      monitor.trackSerpAPIUsage('test query', 10);
      
      const status = monitor.getBudgetStatus();
      
      expect(status.totalSpent).toBeGreaterThan(0);
      expect(status.budgetLimit).toBe(50);
      expect(status.remainingBudget).toBe(50 - status.totalSpent);
      expect(status.percentageUsed).toBe((status.totalSpent / 50) * 100);
      expect(status.isOverBudget).toBe(false);
    });

    it('should detect over budget condition', () => {
      // Simulate heavy usage to exceed budget ($50 budget)
      // 3400 * $0.015 = $51, which exceeds $50 budget
      for (let i = 0; i < 3400; i++) {
        monitor.trackSerpAPIUsage('test query', 10);
      }
      
      const status = monitor.getBudgetStatus();
      
      expect(status.isOverBudget).toBe(true);
      expect(status.totalSpent).toBeGreaterThan(50);
    });

    it('should detect near budget condition', () => {
      // Add usage to get close to budget (80% threshold)
      // 2700 * $0.015 = $40.50, which is 81% of $50 budget
      for (let i = 0; i < 2700; i++) {
        monitor.trackSerpAPIUsage('test query', 10);
      }
      
      const status = monitor.getBudgetStatus();
      
      expect(status.isNearBudget).toBe(true);
      expect(status.percentageUsed).toBeGreaterThan(80);
    });
  });

  describe('canAffordOperation', () => {
    it('should allow operations within budget', () => {
      const canAfford = monitor.canAffordOperation(1.0);
      
      expect(canAfford).toBe(true);
    });

    it('should reject operations that exceed budget', () => {
      const canAfford = monitor.canAffordOperation(100.0);
      
      expect(canAfford).toBe(false);
    });

    it('should consider existing spend', () => {
      // Use up most of the budget ($50 budget)
      // 2700 * $0.015 = $40.50, then $10 more would exceed $50 budget
      for (let i = 0; i < 2700; i++) {
        monitor.trackSerpAPIUsage('test query', 10);
      }
      
      const canAfford = monitor.canAffordOperation(10.0);
      
      expect(canAfford).toBe(false);
    });
  });

  describe('getCostBreakdown', () => {
    it('should provide accurate cost breakdown', () => {
      monitor.trackOpenAIUsage('o4-mini', 1000, 500, 'classification');
      monitor.trackSerpAPIUsage('test query', 10);
      monitor.trackOtherUsage('custom-service', 'operation', 0.05);
      
      const breakdown = monitor.getCostBreakdown();
      
      expect(breakdown['openai']).toBeGreaterThan(0);
      expect(breakdown['serpapi']).toBe(0.015);
      expect(breakdown['custom-service']).toBe(0.05);
    });
  });

  describe('getCostReport', () => {
    it('should provide comprehensive cost report', () => {
      monitor.trackOpenAIUsage('o4-mini', 1000, 500, 'classification');
      monitor.trackSerpAPIUsage('test query', 10);
      
      const report = monitor.getCostReport();
      
      expect(report.status).toBeDefined();
      expect(report.breakdown).toBeDefined();
      expect(report.recentEntries).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should provide recommendations when near budget', () => {
      // Use up most of the budget ($50 budget)
      // 2700 * $0.015 = $40.50, which is 81% of $50 budget (near budget)
      for (let i = 0; i < 2700; i++) {
        monitor.trackSerpAPIUsage('test query', 10);
      }
      
      const report = monitor.getCostReport();
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('Reduce search frequency'))).toBe(true);
    });

    it('should provide emergency recommendations when over budget', () => {
      // Exceed budget ($50 budget)
      // 3400 * $0.015 = $51, which exceeds $50 budget
      for (let i = 0; i < 3400; i++) {
        monitor.trackSerpAPIUsage('test query', 10);
      }
      
      const report = monitor.getCostReport();
      
      expect(report.recommendations.some(r => r.includes('Halt all non-essential operations'))).toBe(true);
    });
  });

  describe('estimateOpenAICost', () => {
    it('should estimate OpenAI costs correctly', () => {
      const estimated = monitor.estimateOpenAICost('o4-mini', 1000);
      
      expect(estimated).toBeGreaterThan(0);
      // Should be roughly 70% input (700 tokens) + 30% output (300 tokens)
      const expectedCost = (700 / 1000) * 0.000003 + (300 / 1000) * 0.000012;
      expect(estimated).toBeCloseTo(expectedCost, 6);
    });

    it('should return 0 for unknown models', () => {
      const estimated = monitor.estimateOpenAICost('unknown-model', 1000);
      
      expect(estimated).toBe(0);
    });
  });

  describe('resetMonthlyCosts', () => {
    it('should reset monthly costs', () => {
      monitor.trackSerpAPIUsage('test query', 10);
      
      let status = monitor.getBudgetStatus();
      expect(status.totalSpent).toBeGreaterThan(0);
      
      monitor.resetMonthlyCosts();
      
      status = monitor.getBudgetStatus();
      expect(status.totalSpent).toBe(0);
    });
  });
});

describe('CostMonitor Integration', () => {
  it('should work with the singleton instance', () => {
    expect(costMonitor).toBeInstanceOf(CostMonitor);
  });

  it('should track costs across different services', () => {
    const initialStatus = costMonitor.getBudgetStatus();
    
    costMonitor.trackOpenAIUsage('o4-mini', 500, 250, 'test');
    costMonitor.trackSerpAPIUsage('test query', 5);
    
    const finalStatus = costMonitor.getBudgetStatus();
    
    expect(finalStatus.totalSpent).toBeGreaterThan(initialStatus.totalSpent);
  });
}); 