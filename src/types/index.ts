export interface Lead {
  id: string;                    // UUID
  orgName: string;               // Organization name
  ein?: string;                  // Nonprofit EIN number
  eventName: string;             // Event title
  eventDate?: Date;              // Event date
  eventDateRange?: string;       // Configured date range match
  url: string;                   // Source URL
  travelKeywords: boolean;       // Travel package detected
  auctionKeywords: boolean;      // Auction/raffle detected
  usVerified: boolean;           // US nonprofit verified
  geographicRegion?: string;     // Geographic region match
  score: number;                 // Confidence score (0-1)
  contactEmail?: string;         // Primary contact email
  contactPhone?: string;         // Primary contact phone
  staffSize?: number;            // Organization size (LinkedIn)
  createdAt: Date;               // Lead creation timestamp
  updatedAt: Date;               // Last update timestamp
  status: 'pending' | 'qualified' | 'contacted' | 'converted' | 'rejected';
  notes?: string;                // User notes
}

export interface Config {
  dateRanges: {
    searchMonths: string[];
    searchQuarters: string[];
    eventDateRange: string;
  };
  geographic: {
    states: string[];
    regions: string[];
    excludeStates: string[];
  };
  precision: {
    confidenceThreshold: number;
    requireMultipleKeywords: boolean;
    strictNonprofitVerification: boolean;
  };
  limits: {
    maxLeadsPerDay: number;
    maxSearchQueries: number;
    budgetLimit: number;
    maxRequestsPerMinute: number;
  };
  apis: {
    openai: {
      apiKey: string;
      model: string;
      simpleModel?: string;
      visionModel?: string;
    };
    serpapi: {
      apiKey: string;
    };
    google: {
      serviceAccountEmail: string;
      privateKey: string;
      sheetId: string;
    };
  };
  database: {
    url: string;
  };
}

export interface SearchQuery {
  id: string;
  query: string;
  dateRange: string;
  geographic: string;
  createdAt: Date;
  processedAt?: Date;
  resultsCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ScrapedContent {
  id: string;
  url: string;
  title: string;
  content: string;
  rawHtml?: string;
  images: string[];
  scrapedAt: Date;
  processingStatus: 'pending' | 'classified' | 'failed';
  statusCode?: number;
  error?: string;
  eventInfo?: {
    title?: string;
    date?: string;
    description?: string;
  };
  contactInfo?: {
    emails?: string[];
    phones?: string[];
    address?: string;
  };
  organizationInfo?: {
    name?: string;
    ein?: string;
    mission?: string;
    sourceUrls?: string[];
  };
}

export interface ClassificationResult {
  id: string;
  leadId: string;
  isRelevant: boolean;
  confidenceScore: number;
  hasAuctionKeywords: boolean;
  hasTravelKeywords: boolean;
  reasoning: string;
  classifiedAt: Date;
  modelUsed: string;
}

export interface NonprofitVerification {
  id: string;
  leadId: string;
  ein?: string;
  isVerified: boolean;
  source: 'irs' | 'guidestar' | 'manual';
  verifiedAt: Date;
  additionalInfo?: Record<string, any>;
}

export interface AgentExecutionContext {
  requestId: string;
  sessionId: string;
  timestamp: Date;
  budgetUsed: number;
  budgetRemaining: number;
  rateLimitStatus: {
    openai: number;
    serpapi: number;
    google: number;
  };
} 