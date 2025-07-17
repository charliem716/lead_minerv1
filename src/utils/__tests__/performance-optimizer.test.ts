import { PerformanceOptimizer, performanceOptimizer } from '../performance-optimizer';

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;

  beforeEach(() => {
    optimizer = new PerformanceOptimizer();
  });

  describe('cachedOperation', () => {
    it('should cache successful operations', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'result';
      };

      const result1 = await optimizer.cachedOperation('test-key', operation);
      const result2 = await optimizer.cachedOperation('test-key', operation);

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // Should only call once due to caching
    });

    it('should not cache when skipCache is true', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'result';
      };

      const result1 = await optimizer.cachedOperation('test-key', operation, { skipCache: true });
      const result2 = await optimizer.cachedOperation('test-key', operation, { skipCache: true });

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(callCount).toBe(2); // Should call twice when skipCache is true
    });

    it('should expire cached entries based on TTL', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return 'result';
      };

      // Cache with very short TTL
      const result1 = await optimizer.cachedOperation('test-key', operation, { ttl: 10 });
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const result2 = await optimizer.cachedOperation('test-key', operation, { ttl: 10 });

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(callCount).toBe(2); // Should call twice due to expiration
    });

    it('should handle operation failures', async () => {
      const operation = async () => {
        throw new Error('Test error');
      };

      await expect(optimizer.cachedOperation('test-key', operation)).rejects.toThrow('Test error');
    });
  });

  describe('selectOptimalModel', () => {
    it('should select simple model for simple tasks', () => {
      const model = optimizer.selectOptimalModel('simple', 'moderate');
      expect(model).toBe('gpt-4.1-mini');
    });

    it('should select appropriate model for medium tasks', () => {
      const model = optimizer.selectOptimalModel('medium', 'flexible');
      expect(model).toBe('o4-mini');
    });

    it('should select simple model for strict budget', () => {
      const model = optimizer.selectOptimalModel('complex', 'strict');
      expect(model).toBe('gpt-4.1-mini');
    });

    it('should select complex model for flexible budget', () => {
      const model = optimizer.selectOptimalModel('complex', 'flexible');
      expect(model).toBe('o4-mini');
    });
  });

  describe('rateLimitedOperation', () => {
    it('should execute operation when budget allows', async () => {
      const operation = async () => 'success';
      const result = await optimizer.rateLimitedOperation(operation, 0.01);
      expect(result).toBe('success');
    });

    it('should reject operation when budget exceeded', async () => {
      const operation = async () => 'success';
      await expect(optimizer.rateLimitedOperation(operation, 1000)).rejects.toThrow('Operation would exceed budget limit');
    });
  });

  describe('getPerformanceReport', () => {
    it('should provide performance report', async () => {
      // Add some operations to generate metrics
      const operation = async () => 'result';
      await optimizer.cachedOperation('test-1', operation);
      await optimizer.cachedOperation('test-2', operation);
      
      const report = optimizer.getPerformanceReport();

      expect(report.cacheStats).toBeDefined();
      expect(report.operationStats).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should calculate cache statistics correctly', async () => {
      const operation = async () => 'result';
      
      // First call - cache miss
      await optimizer.cachedOperation('test-key', operation);
      
      // Second call - cache hit
      await optimizer.cachedOperation('test-key', operation);
      
      const report = optimizer.getPerformanceReport();
      
      expect(report.cacheStats.size).toBe(1);
      expect(report.cacheStats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached entries', async () => {
      const operation = async () => 'result';
      await optimizer.cachedOperation('test-key', operation);
      
      let stats = optimizer.getCacheStats();
      expect(stats.size).toBe(1);
      
      optimizer.clearCache();
      
      stats = optimizer.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const operation = async () => 'result';
      await optimizer.cachedOperation('test-key', operation);
      
      const stats = optimizer.getCacheStats();
      
      expect(stats.size).toBe(1);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0]?.key).toBe('test-key');
      expect(stats.entries[0]?.hits).toBe(0);
      expect(stats.entries[0]?.age).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('PerformanceOptimizer Integration', () => {
  it('should work with the singleton instance', () => {
    expect(performanceOptimizer).toBeInstanceOf(PerformanceOptimizer);
  });

  it('should provide consistent performance across operations', async () => {
    const operation = async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'result';
    };

    const results = await Promise.all([
      performanceOptimizer.cachedOperation('test-1', operation),
      performanceOptimizer.cachedOperation('test-2', operation),
      performanceOptimizer.cachedOperation('test-1', operation), // Should be cached
    ]);

    expect(results).toEqual(['result', 'result', 'result']);
    
    const report = performanceOptimizer.getPerformanceReport();
    expect(report.operationStats.totalOperations).toBeGreaterThan(0);
  });
}); 