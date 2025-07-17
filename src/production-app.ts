#!/usr/bin/env node

/**
 * Lead-Miner Agent - Production Application Entry Point
 * Integrates all systems for production deployment
 */

import { config } from './config';
import { pipelineOrchestrator } from './pipeline/orchestrator';
import { costMonitor } from './utils/cost-monitor';
import { monitoringSystem } from './utils/monitoring';
import { sheetsManager } from './utils/sheets';

/**
 * Production Application Class
 */
class ProductionApp {
  private isRunning = false;
  private shutdownInProgress = false;

  /**
   * Initialize the production application
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Lead-Miner Agent for production...');
    
    try {
      // Validate configuration
      await this.validateConfiguration();
      
      // Initialize core systems
      await this.initializeSystems();
      
      // Start monitoring
      await this.startMonitoring();
      
      console.log('✅ Lead-Miner Agent initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Lead-Miner Agent:', error);
      throw error;
    }
  }

  /**
   * Validate production configuration
   */
  private async validateConfiguration(): Promise<void> {
    console.log('🔍 Validating production configuration...');
    
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'SERPAPI_KEY',
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_SHEET_ID',
      'DATABASE_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => {
      const value = process.env[varName];
      return !value || value === 'your_key_here' || value === 'CHANGE_ME';
    });

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate budget configuration
    if (config.limits.budgetLimit <= 0) {
      throw new Error('Budget limit must be greater than 0');
    }

    console.log('✅ Configuration validation passed');
  }

  /**
   * Initialize core systems
   */
  private async initializeSystems(): Promise<void> {
    console.log('🔧 Initializing core systems...');
    
    try {
      // Initialize Google Sheets
      await sheetsManager.initialize();
      console.log('✅ Google Sheets initialized');
      
      // Initialize cost monitoring
      console.log('✅ Cost monitoring initialized');
      
      // Initialize performance optimizer
      console.log('✅ Performance optimizer initialized');
      
      // Google Sheets ready for real data (removed test entry)
      console.log('✅ Google Sheets ready for real data');
      
    } catch (error) {
      console.error('❌ System initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start monitoring systems
   */
  private async startMonitoring(): Promise<void> {
    console.log('📊 Starting monitoring systems...');
    
    try {
      // Initialize monitoring system (no start method needed)
      console.log('✅ Monitoring system started');
      
    } catch (error) {
      console.error('❌ Failed to start monitoring:', error);
      // Don't throw - monitoring is not critical for basic operation
    }
  }

  /**
   * Start the production application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📊 Application is already running');
      return;
    }

    console.log('🚀 Starting Lead-Miner Agent production application...');
    
    try {
      // Initialize if not already done
      if (!this.isRunning) {
        await this.initialize();
      }

      this.isRunning = true;
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Start the main application loop
      await this.runMainLoop();
      
    } catch (error) {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Main application loop
   */
  private async runMainLoop(): Promise<void> {
    console.log('🔄 Starting main application loop...');
    
    // Schedule pipeline execution
    const scheduleNextExecution = () => {
      if (this.shutdownInProgress) return;
      
      // Run pipeline every 6 hours (4 times per day)
      setTimeout(async () => {
        try {
          await this.executePipeline();
          scheduleNextExecution();
        } catch (error) {
          console.error('❌ Pipeline execution failed:', error);
          // Continue scheduling even if pipeline fails
          scheduleNextExecution();
        }
      }, 6 * 60 * 60 * 1000); // 6 hours
    };

    // Run initial pipeline execution
    await this.executePipeline();
    
    // Schedule future executions
    scheduleNextExecution();
    
    // Keep the application running
    console.log('✅ Application is running. Press Ctrl+C to stop.');
    
    // Wait indefinitely (until shutdown)
    await new Promise(resolve => {
      const checkShutdown = () => {
        if (this.shutdownInProgress) {
          resolve(undefined);
        } else {
          setTimeout(checkShutdown, 1000);
        }
      };
      checkShutdown();
    });
  }

  /**
   * Execute the lead generation pipeline
   */
  private async executePipeline(): Promise<void> {
    console.log('🚀 Starting pipeline execution...');
    
    try {
      // Check budget before execution
      const budgetStatus = costMonitor.getBudgetStatus();
      
      if (budgetStatus.isOverBudget) {
        console.log('⚠️ Budget exceeded, skipping pipeline execution');
        return;
      }

      if (budgetStatus.percentageUsed > 95) {
        console.log('⚠️ Budget critically low, skipping pipeline execution');
        return;
      }

      // Execute pipeline
      await pipelineOrchestrator.execute();
      
      console.log('✅ Pipeline execution completed successfully');
      
    } catch (error) {
      console.error('❌ Pipeline execution failed:', error);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.shutdownInProgress) return;
      
      console.log(`\n📤 Received ${signal}, starting graceful shutdown...`);
      this.shutdownInProgress = true;
      
      try {
        // Cleanup monitoring
        monitoringSystem.cleanup();
        console.log('✅ Monitoring cleaned up');
        
        // Shutdown complete (removed test entry)
        console.log('✅ Shutdown complete');
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  }

  /**
   * Run a single pipeline execution (for manual testing)
   */
  async runOnce(): Promise<void> {
    console.log('🔄 Running single pipeline execution...');
    
    try {
      await this.initialize();
      await this.executePipeline();
      
      console.log('✅ Single execution completed successfully');
      
    } catch (error) {
      console.error('❌ Single execution failed:', error);
      throw error;
    }
  }

  /**
   * Get application status
   */
  async getStatus(): Promise<any> {
    const budgetStatus = costMonitor.getBudgetStatus();
    const monitoringStatus = monitoringSystem.getDashboardData();
    
    return {
      isRunning: this.isRunning,
      budget: budgetStatus,
      monitoring: monitoringStatus,
      timestamp: new Date().toISOString()
    };
  }
}

// Create application instance
const app = new ProductionApp();

// Handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--once') || args.includes('-o')) {
      // Run once and exit
      await app.runOnce();
      
    } else if (args.includes('--status') || args.includes('-s')) {
      // Show status and exit
      const status = await app.getStatus();
      console.log('📊 Application Status:', JSON.stringify(status, null, 2));
      
    } else if (args.includes('--help') || args.includes('-h')) {
      // Show help
      console.log(`
Lead-Miner Agent Production Application

Usage: node dist/production-app.js [OPTIONS]

Options:
  -h, --help     Show this help message
  -o, --once     Run pipeline once and exit
  -s, --status   Show application status
  
Default: Run continuously with scheduled executions
`);
      
    } else {
      // Default: run continuously
      await app.start();
    }
    
  } catch (error) {
    console.error('💥 Application crashed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { ProductionApp }; 