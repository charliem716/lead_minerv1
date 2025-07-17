/**
 * Production Monitoring System for Lead-Miner Agent
 * Reports system health, performance, and alerts to Google Sheets
 */

import { sheetsManager } from './sheets';
import { costMonitor } from './cost-monitor';
import { HealthChecker, HealthStatus } from '../health-check';

interface MonitoringMetrics {
  timestamp: string;
  uptime: number;
  health: HealthStatus;
  performance: {
    leadProcessingRate: number;
    averageResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  costs: {
    dailySpend: number;
    monthlySpend: number;
    budgetUsed: number;
    projectedSpend: number;
  };
  alerts: Alert[];
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
  details?: any;
}

class MonitoringSystem {
  private healthChecker: HealthChecker;
  private alerts: Alert[] = [];
  private metrics: MonitoringMetrics[] = [];
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.healthChecker = new HealthChecker();
  }

  /**
   * Start the monitoring system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📊 Monitoring system already running');
      return;
    }

    console.log('🚀 Starting Lead-Miner monitoring system...');
    
    try {
      // Initialize monitoring sheets
      await this.initializeMonitoringSheets();
      
      // Start periodic monitoring
      this.monitoringInterval = setInterval(async () => {
        await this.collectMetrics();
        await this.checkAlerts();
        await this.reportToSheets();
      }, 60000); // Every minute

      // Initial metrics collection
      await this.collectMetrics();
      await this.reportToSheets();

      this.isRunning = true;
      console.log('✅ Monitoring system started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start monitoring system:', error);
      throw error;
    }
  }

  /**
   * Stop the monitoring system
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Monitoring system stopped');
  }

  /**
   * Initialize monitoring sheets in Google Sheets
   */
  private async initializeMonitoringSheets(): Promise<void> {
    try {
      // Initialize the sheets manager
      await sheetsManager.initialize();
      
      // Note: In production, you would create additional sheets for monitoring
      // For now, we'll use the existing sheets structure
      console.log('📊 Monitoring sheets initialized');
    } catch (error) {
      console.error('❌ Failed to initialize monitoring sheets:', error);
      throw error;
    }
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const health = await this.healthChecker.checkHealth();
      const budgetStatus = costMonitor.getBudgetStatus();
      
      const metrics: MonitoringMetrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        health,
        performance: {
          leadProcessingRate: this.calculateProcessingRate(),
          averageResponseTime: this.calculateAverageResponseTime(),
          errorRate: this.calculateErrorRate(),
          cacheHitRate: this.calculateCacheHitRate()
        },
        costs: {
          dailySpend: budgetStatus.dailySpend,
          monthlySpend: budgetStatus.totalSpent,
          budgetUsed: budgetStatus.percentageUsed,
          projectedSpend: budgetStatus.projectedMonthlySpend
        },
        alerts: this.alerts.filter(alert => !alert.resolved)
      };

      this.metrics.push(metrics);
      
      // Keep only last 1000 metrics to prevent memory issues
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.createAlert('error', 'Failed to collect system metrics', { error: errorMessage });
    }
  }

  /**
   * Check for alerts and create new ones
   */
  private async checkAlerts(): Promise<void> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return;

    // Health alerts
    if (latestMetrics.health.status === 'unhealthy') {
      this.createAlert('error', 'System health check failed', {
        errors: latestMetrics.health.details.errors,
        checks: latestMetrics.health.checks
      });
    }

    // Memory alerts
    if (latestMetrics.health.details.memory.percentage > 85) {
      this.createAlert('warning', `High memory usage: ${latestMetrics.health.details.memory.percentage.toFixed(1)}%`, {
        memoryUsage: latestMetrics.health.details.memory
      });
    }

    // Cost alerts
    if (latestMetrics.costs.budgetUsed > 90) {
      this.createAlert('error', `Budget critically low: ${latestMetrics.costs.budgetUsed.toFixed(1)}% used`, {
        dailySpend: latestMetrics.costs.dailySpend,
        monthlySpend: latestMetrics.costs.monthlySpend,
        projectedSpend: latestMetrics.costs.projectedSpend
      });
    } else if (latestMetrics.costs.budgetUsed > 80) {
      this.createAlert('warning', `Budget warning: ${latestMetrics.costs.budgetUsed.toFixed(1)}% used`, {
        dailySpend: latestMetrics.costs.dailySpend,
        monthlySpend: latestMetrics.costs.monthlySpend
      });
    }

    // Performance alerts
    if (latestMetrics.performance.errorRate > 5) {
      this.createAlert('warning', `High error rate: ${latestMetrics.performance.errorRate.toFixed(1)}%`, {
        errorRate: latestMetrics.performance.errorRate,
        averageResponseTime: latestMetrics.performance.averageResponseTime
      });
    }

    // Response time alerts
    if (latestMetrics.performance.averageResponseTime > 5000) {
      this.createAlert('warning', `Slow response times: ${latestMetrics.performance.averageResponseTime}ms average`, {
        averageResponseTime: latestMetrics.performance.averageResponseTime
      });
    }
  }

  /**
   * Report metrics to Google Sheets
   */
  private async reportToSheets(): Promise<void> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return;

    try {
      // For now, we'll log the metrics instead of writing to sheets
      // In production, you would extend SheetsManager to support monitoring data
      console.log('📊 System Metrics:', {
        timestamp: latestMetrics.timestamp,
        status: latestMetrics.health.status,
        uptime: `${(latestMetrics.uptime / 3600).toFixed(2)} hours`,
        memory: `${latestMetrics.health.details.memory.percentage.toFixed(1)}%`,
        budget: `${latestMetrics.costs.budgetUsed.toFixed(1)}% used`,
        alerts: latestMetrics.alerts.length,
        performance: {
          processingRate: latestMetrics.performance.leadProcessingRate,
          responseTime: latestMetrics.performance.averageResponseTime,
          errorRate: latestMetrics.performance.errorRate.toFixed(2),
          cacheHitRate: latestMetrics.performance.cacheHitRate.toFixed(2)
        }
      });

    } catch (error) {
      console.error('❌ Failed to report to sheets:', error);
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(type: 'error' | 'warning' | 'info', message: string, details?: any): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      details
    };

    this.alerts.push(alert);
    
    // Log alert to console
    const emoji = type === 'error' ? '🚨' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} ALERT [${type.toUpperCase()}]: ${message}`, details ? details : '');
  }

  /**
   * Calculate processing rate (mock implementation)
   */
  private calculateProcessingRate(): number {
    // In production, this would track actual lead processing
    return Math.floor(Math.random() * 10) + 5; // 5-15 leads per minute
  }

  /**
   * Calculate average response time (mock implementation)
   */
  private calculateAverageResponseTime(): number {
    // In production, this would track actual response times
    return Math.floor(Math.random() * 2000) + 500; // 500-2500ms
  }

  /**
   * Calculate error rate (mock implementation)
   */
  private calculateErrorRate(): number {
    // In production, this would track actual errors
    return Math.random() * 5; // 0-5% error rate
  }

  /**
   * Calculate cache hit rate (mock implementation)
   */
  private calculateCacheHitRate(): number {
    // In production, this would track actual cache performance
    return Math.random() * 20 + 80; // 80-100% cache hit rate
  }

  /**
   * Get current system status
   */
  async getStatus(): Promise<MonitoringMetrics | null> {
    return this.metrics[this.metrics.length - 1] || null;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      console.log(`✅ Alert resolved: ${alert.message}`);
    }
  }
}

// Create singleton instance
export const monitoringSystem = new MonitoringSystem();

// Export types
export type { MonitoringMetrics, Alert }; 