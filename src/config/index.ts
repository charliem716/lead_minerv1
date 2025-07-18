import * as dotenv from 'dotenv';
import { Config } from '../types';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration loader for Lead Miner Agent
 * Loads configuration from environment variables with sensible defaults
 */
export const config: Config = {
  dateRanges: {
    searchMonths: process.env['SEARCH_MONTHS']?.split(',') || ['March', 'April', 'May', 'October', 'November'],
    searchQuarters: process.env['SEARCH_QUARTERS']?.split(',') || ['Q2', 'Q4'],
    eventDateRange: process.env['EVENT_DATE_RANGE'] || '2025-03-01 to 2025-12-31'
  },
  geographic: {
    states: process.env['TARGET_STATES']?.split(',') || [], // Empty array = all states
    regions: process.env['TARGET_REGIONS']?.split(',') || [],
    excludeStates: process.env['EXCLUDE_STATES']?.split(',') || ['AK', 'HI']
  },
  precision: {
    confidenceThreshold: parseFloat(process.env['CONFIDENCE_THRESHOLD'] || '0.60'), // Lowered from 0.75 to 0.60 for more leads
    requireMultipleKeywords: process.env['REQUIRE_MULTIPLE_KEYWORDS'] === 'true',
    strictNonprofitVerification: process.env['STRICT_NONPROFIT_VERIFICATION'] !== 'false'
  },
  limits: {
    maxLeadsPerDay: parseInt(process.env['MAX_LEADS_PER_DAY'] || '10'),
    maxSearchQueries: parseInt(process.env['MAX_SEARCH_QUERIES'] || '50'),
    budgetLimit: parseInt(process.env['BUDGET_LIMIT'] || '50'),
    maxRequestsPerMinute: parseInt(process.env['MAX_REQUESTS_PER_MINUTE'] || '30')
  },
  apis: {
    openai: {
      apiKey: process.env['OPENAI_API_KEY'] || '',
      model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini', // Default reasoning model
      simpleModel: process.env['OPENAI_SIMPLE_MODEL'] || 'gpt-4o-mini', // No-reasoning model
      visionModel: process.env['OPENAI_VISION_MODEL'] || 'gpt-4o-mini' // Image analysis model
    },
    serpapi: {
      apiKey: process.env['SERPAPI_KEY'] || ''
    },
    google: {
      serviceAccountEmail: process.env['GOOGLE_SERVICE_ACCOUNT_EMAIL'] || '',
      privateKey: (process.env['GOOGLE_PRIVATE_KEY'] || '').replace(/\\n/g, '\n'),
      sheetId: process.env['GOOGLE_SHEET_ID'] || ''
    }
  },
  database: {
    url: process.env['DATABASE_URL'] || 'postgresql://localhost:5432/leadminer'
  }
};

/**
 * Validate required configuration values
 * Throws error if critical configuration is missing
 */
export function validateConfig(): void {
  const requiredVars = [
    'OPENAI_API_KEY',
    'SERPAPI_KEY',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_SHEET_ID'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate numeric values
  if (config.precision.confidenceThreshold < 0 || config.precision.confidenceThreshold > 1) {
    throw new Error('CONFIDENCE_THRESHOLD must be between 0 and 1');
  }

  if (config.limits.budgetLimit <= 0) {
    throw new Error('BUDGET_LIMIT must be greater than 0');
  }

  if (config.limits.maxLeadsPerDay <= 0) {
    throw new Error('MAX_LEADS_PER_DAY must be greater than 0');
  }
}

/**
 * Get environment-specific configuration
 */
export const isDevelopment = process.env['NODE_ENV'] === 'development';
export const isProduction = process.env['NODE_ENV'] === 'production';
export const isTest = process.env['NODE_ENV'] === 'test';

/**
 * Logging configuration
 */
export const logLevel = process.env['LOG_LEVEL'] || (isDevelopment ? 'debug' : 'info');
export const logFormat = isDevelopment ? 'dev' : 'combined';

/**
 * Server configuration
 */
export const port = parseInt(process.env['PORT'] || '3000');

/**
 * Configuration documentation for setup
 */
export const configDocumentation = {
  requiredEnvVars: [
    'OPENAI_API_KEY - Your OpenAI API key',
    'SERPAPI_KEY - Your SerpAPI key for web search',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL - Google service account email',
    'GOOGLE_PRIVATE_KEY - Google service account private key',
    'GOOGLE_SHEET_ID - ID of the Google Sheet to write leads to'
  ],
  optionalEnvVars: [
    'DATABASE_URL - PostgreSQL connection string',
    'CONFIDENCE_THRESHOLD - Minimum confidence score (0-1, default: 0.85)',
    'MAX_LEADS_PER_DAY - Maximum leads per day (default: 10)',
    'BUDGET_LIMIT - Monthly budget limit in USD (default: 50)',
    'SEARCH_MONTHS - Comma-separated list of months to search',
    'TARGET_STATES - Comma-separated list of states to target',
    'EXCLUDE_STATES - Comma-separated list of states to exclude'
  ]
};

// Validate configuration on load (except in test environment)
if (!isTest) {
  validateConfig();
} 