import { costMonitor } from './cost-monitor';
import { config } from '../config';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  cost: number;
  success: boolean;
  tokensUsed?: number;
  cacheHit?: boolean;
}

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  cost: number;
  hits: number;
}

/**
 * Batch operation interface
 */
interface BatchOperation<T, R> {
  id: string;
  input: T;
  priority: number;
  estimatedCost: number;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

/**
 * Performance Optimizer
 * Optimizes operations within budget constraints
 */
export class PerformanceOptimizer {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private metrics: PerformanceMetrics[] = [];
  private batchQueue: Map<string, BatchOperation<any, any>[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Configuration
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours
  private batchDelay: number = 100; // 100ms batch delay
  private maxBatchSize: number = 10;
  private maxCacheSize: number = 1000;

  /**
   * Cached operation wrapper
   */
  async cachedOperation<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      ttl?: number;
      cost?: number;
      skipCache?: boolean;
    } = {}
  ): Promise<T> {
    const { ttl = this.cacheExpiry, cost = 0, skipCache = false } = options;
    
    // Check cache first
    if (!skipCache && this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      if (Date.now() - entry.timestamp < ttl) {
        entry.hits++;
        console.log(`💾 Cache hit for ${key} (${entry.hits} hits, saved $${entry.cost.toFixed(6)})`);
        return entry.data;
      } else {
        this.cache.delete(key);
      }
    }

    // Execute operation with performance tracking
    const startTime = Date.now();
    let result: T;
    let success = true;
    let actualCost = 0;

    try {
      result = await operation();
      actualCost = cost;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      // Record metrics
      this.recordMetrics({
        operationName: key,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        cost: actualCost,
        success,
        cacheHit: false
      });
    }

    // Cache successful results
    if (success && !skipCache) {
      this.setCacheEntry(key, result, actualCost);
    }

    return result;
  }

  /**
   * Batch operation processor
   */
  async batchOperation<T, R>(
    batchType: string,
    input: T,
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      priority?: number;
      estimatedCost?: number;
      maxWait?: number;
    } = {}
  ): Promise<R> {
    const { priority = 1, estimatedCost = 0, maxWait = 1000 } = options;

    return new Promise<R>((resolve, reject) => {
      // Check budget before queueing
      if (!costMonitor.canAffordOperation(estimatedCost)) {
        reject(new Error('Operation would exceed budget limit'));
        return;
      }

      // Add to batch queue
      const operation: BatchOperation<T, R> = {
        id: `${batchType}-${Date.now()}-${Math.random()}`,
        input,
        priority,
        estimatedCost,
        resolve,
        reject
      };

      if (!this.batchQueue.has(batchType)) {
        this.batchQueue.set(batchType, []);
      }

             const queue = this.batchQueue.get(batchType);
       if (queue) {
         queue.push(operation);
       }

      // Set up batch processing timer
      if (!this.batchTimers.has(batchType)) {
        const timer = setTimeout(() => {
          this.processBatch(batchType, processor);
        }, this.batchDelay);
        
        this.batchTimers.set(batchType, timer);
      }

      // Set up max wait timeout
      setTimeout(() => {
                 if (this.batchQueue.has(batchType)) {
           const queue = this.batchQueue.get(batchType);
           if (queue) {
             const index = queue.findIndex(op => op.id === operation.id);
             if (index !== -1) {
               queue.splice(index, 1);
               reject(new Error('Batch operation timeout'));
             }
           }
         }
      }, maxWait);
    });
  }

  /**
   * Process batch queue
   */
  private async processBatch<T, R>(
    batchType: string,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<void> {
    const queue = this.batchQueue.get(batchType);
    if (!queue || queue.length === 0) return;

    // Clear timer
    const timer = this.batchTimers.get(batchType);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchType);
    }

    // Sort by priority and take up to maxBatchSize
    const batch = queue
      .sort((a, b) => b.priority - a.priority)
      .splice(0, this.maxBatchSize);

    if (batch.length === 0) return;

    console.log(`🔄 Processing batch of ${batch.length} ${batchType} operations`);

    const startTime = Date.now();
    let success = true;
    let totalCost = batch.reduce((sum, op) => sum + op.estimatedCost, 0);

    try {
      const inputs = batch.map(op => op.input);
      const results = await processor(inputs);

      // Resolve each operation
      batch.forEach((operation, index) => {
        if (results[index]) {
          operation.resolve(results[index]);
        } else {
          operation.reject(new Error('Batch processing failed'));
        }
      });

    } catch (error) {
      success = false;
      // Reject all operations in batch
      batch.forEach(operation => {
        operation.reject(error as Error);
      });
    } finally {
      // Record batch metrics
      this.recordMetrics({
        operationName: `batch-${batchType}`,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        cost: totalCost,
        success
      });
    }

    // Process remaining queue if any
    if (queue.length > 0) {
      const timer = setTimeout(() => {
        this.processBatch(batchType, processor);
      }, this.batchDelay);
      
      this.batchTimers.set(batchType, timer);
    }
  }

  /**
   * Smart model selection based on complexity and budget
   */
  selectOptimalModel(
    taskComplexity: 'simple' | 'medium' | 'complex',
    budgetConstraint: 'strict' | 'moderate' | 'flexible'
  ): string {
    const budgetStatus = costMonitor.getBudgetStatus();
    
    // If over budget, use cheapest model
    if (budgetStatus.isOverBudget) {
      return config.apis.openai.simpleModel || 'gpt-4.1-mini';
    }

    // If near budget, be conservative
    if (budgetStatus.isNearBudget) {
      if (taskComplexity === 'simple') {
        return config.apis.openai.simpleModel || 'gpt-4.1-mini';
      } else {
        return config.apis.openai.simpleModel || 'gpt-4.1-mini'; // Use simple model even for complex tasks
      }
    }

    // Normal selection based on complexity
    switch (taskComplexity) {
      case 'simple':
        return config.apis.openai.simpleModel || 'gpt-4.1-mini';
      case 'medium':
        return budgetConstraint === 'strict' 
          ? (config.apis.openai.simpleModel || 'gpt-4.1-mini') 
          : (config.apis.openai.model || 'o4-mini');
      case 'complex':
        return budgetConstraint === 'flexible' 
          ? (config.apis.openai.model || 'o4-mini') 
          : (config.apis.openai.simpleModel || 'gpt-4.1-mini');
      default:
        return config.apis.openai.simpleModel || 'gpt-4.1-mini';
    }
  }

  /**
   * Rate limiting with budget awareness
   */
  async rateLimitedOperation<T>(
    operation: () => Promise<T>,
    estimatedCost: number,
    _priority: number = 1
  ): Promise<T> {
    // Check budget first
    if (!costMonitor.canAffordOperation(estimatedCost)) {
      throw new Error('Operation would exceed budget limit');
    }

    // Implement simple rate limiting based on budget usage
    const budgetStatus = costMonitor.getBudgetStatus();
    
    if (budgetStatus.percentageUsed > 80) {
      // Slow down operations when near budget
      const delay = Math.max(100, (budgetStatus.percentageUsed - 80) * 50);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return await operation();
  }

  /**
   * Set cache entry with size management
   */
  private setCacheEntry<T>(key: string, data: T, cost: number): void {
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.floor(this.maxCacheSize * 0.1); // Remove 10%
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        const entry = entries[i];
        if (entry && entry[0]) {
          this.cache.delete(entry[0]);
        }
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      cost,
      hits: 0
    });
  }

  /**
   * Record performance metrics
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics (last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Log slow operations
    if (metrics.duration > 8000) { // Increased threshold from 5000ms to 8000ms
      console.warn(`⚠️ Slow operation: ${metrics.operationName} took ${metrics.duration}ms`);
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    cacheStats: {
      size: number;
      hitRate: number;
      totalSavings: number;
    };
    operationStats: {
      totalOperations: number;
      averageDuration: number;
      successRate: number;
      totalCost: number;
    };
    recommendations: string[];
  } {
    const cacheEntries = Array.from(this.cache.values());
    const totalHits = cacheEntries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalCacheOperations = cacheEntries.length + totalHits;
    const hitRate = totalCacheOperations > 0 ? (totalHits / totalCacheOperations) * 100 : 0;
    const totalSavings = cacheEntries.reduce((sum, entry) => sum + (entry.cost * entry.hits), 0);

    const successfulOps = this.metrics.filter(m => m.success);
    const averageDuration = successfulOps.length > 0 
      ? successfulOps.reduce((sum, m) => sum + m.duration, 0) / successfulOps.length 
      : 0;
    const successRate = this.metrics.length > 0 
      ? (successfulOps.length / this.metrics.length) * 100 
      : 0;
    const totalCost = this.metrics.reduce((sum, m) => sum + m.cost, 0);

    const recommendations = this.generateOptimizationRecommendations(hitRate, averageDuration, successRate);

    return {
      cacheStats: {
        size: this.cache.size,
        hitRate,
        totalSavings
      },
      operationStats: {
        totalOperations: this.metrics.length,
        averageDuration,
        successRate,
        totalCost
      },
      recommendations
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(
    hitRate: number,
    averageDuration: number,
    successRate: number
  ): string[] {
    const recommendations: string[] = [];

    if (hitRate < 30) {
      recommendations.push('📈 Low cache hit rate - consider increasing cache TTL');
      recommendations.push('🔄 Review caching strategy for frequently accessed data');
    }

    if (averageDuration > 2000) {
      recommendations.push('⚡ High average operation duration - consider optimization');
      recommendations.push('🔀 Implement more aggressive batching');
    }

    if (successRate < 95) {
      recommendations.push('🛠️ Low success rate - investigate error patterns');
      recommendations.push('🔁 Implement better retry logic');
    }

    const budgetStatus = costMonitor.getBudgetStatus();
    if (budgetStatus.isNearBudget) {
      recommendations.push('💰 Near budget limit - prioritize high-value operations');
      recommendations.push('🤖 Consider using simpler models for basic tasks');
    }

    return recommendations;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; hits: number; age: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer(); 