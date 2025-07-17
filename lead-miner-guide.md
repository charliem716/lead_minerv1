# Lead-Miner Agent Implementation Guide
*Autonomous Nonprofit Travel Auction Lead Generation System*
**Version:** 1.0 — January 2025

---

## 📋 Executive Summary

This guide outlines the complete implementation plan for the Lead-Miner Agent, an autonomous lead generation system that finds U.S. nonprofit organizations running travel package auctions. The system prioritizes **high precision over quantity**, delivering fewer but highly qualified leads to Google Sheets daily.

---

## 🛠️ Tech Stack Selection

### **Core Technology**
- **Language**: JavaScript/Node.js (excellent AI documentation, Context7 MCP support)
- **Agent Framework**: OpenAI Agents SDK for JavaScript
- **Database**: DigitalOcean Managed PostgreSQL + pgvector
- **Web Scraping**: Puppeteer + Cheerio
- **Output**: Google Sheets API
- **Search**: SerpAPI (cost-effective for $50 budget)
- **Queue**: Simple in-memory queue initially (BullMQ + Redis for scaling)
- **Deployment**: DigitalOcean Droplet with Docker

### **Key Dependencies**
```json
{
  "@openai/openai-agents-js": "^1.0.0",
  "puppeteer": "^21.0.0",
  "cheerio": "^1.0.0",
  "googleapis": "^126.0.0",
  "serpapi": "^2.0.0",
  "pg": "^8.11.0",
  "pgvector": "^0.1.0",
  "dotenv": "^16.0.0",
  "bullmq": "^4.0.0"
}
```

---

## 🤖 AI Model Usage Guidelines

### **Model Selection Strategy**
- **o4-mini**: Use for reasoning tasks that require analysis, classification, and decision-making
  - Classification of auction/travel content
  - Self-consistency checks
  - Complex text analysis
  - Confidence scoring
  
- **gpt-4.1-mini**: Use for simple, no-reasoning tasks
  - Basic text extraction
  - Simple formatting
  - Template-based responses
  - Straightforward data transformation

### **Cost Optimization**
- Always use the simpler model (gpt-4.1-mini) when reasoning is not required
- Reserve o4-mini for tasks that genuinely need logical analysis
- Cache results to minimize repeated API calls

---

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Query Agent   │───▶│   Search Agent  │───▶│  Scraper Agent  │
│  (Configurable) │    │   (SerpAPI)     │    │  (Puppeteer)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Output Agent   │◀───│ Enricher Agent  │◀───│ Classifier Agent│
│ (Google Sheets) │    │ (Contact Info)  │    │ (High Precision)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────┐
│  Google Sheets  │
│  (Best Practices│
│   Format)       │
└─────────────────┘
```

### **Agent Responsibilities**
1. **Query Agent**: Generates configurable search queries based on date ranges and geographic filters
2. **Search Agent**: Executes searches via SerpAPI with rate limiting
3. **Scraper Agent**: Extracts content from web pages with respect for robots.txt
4. **Classifier Agent**: AI-powered relevance detection (prioritizing precision) using o4-mini for reasoning tasks (classification, analysis) and gpt-4.1-mini for simple text generation
5. **Enricher Agent**: Adds contact information and nonprofit verification
6. **Output Agent**: Formats and writes to Google Sheets using best practices

---

## 📊 Data Model

### **Lead Interface (TypeScript)**
```typescript
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
```

### **Configuration Interface**
```typescript
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
  };
}
```

---

## 📅 6-Week Implementation Timeline

### **Week 1: Foundation Setup**
**Goal**: Basic project structure and hello-world agent

**Tasks**:
- [ ] Set up Node.js project with TypeScript support
- [ ] Install OpenAI Agents SDK and core dependencies
- [ ] Create basic agent structure with hello-world functionality
- [ ] Set up DigitalOcean Droplet and managed PostgreSQL
- [ ] Implement basic database schema with pgvector
- [ ] Set up Google Sheets API integration with best practices formatting
- [ ] Create development environment and CI/CD pipeline

**Deliverables**:
- Working Node.js project with TypeScript
- Basic agent that can write "Hello World" to Google Sheets
- Database and deployment infrastructure ready
- Google Sheets integration with proper formatting

### **Week 2: Search & Scraping Integration**
**Goal**: Implement search and web scraping capabilities

**Tasks**:
- [ ] Integrate SerpAPI for search functionality
- [ ] Build search agent with configurable query expansion logic
- [ ] Implement date range filtering (configurable months/quarters)
- [ ] Add geographic filtering (configurable states/regions)
- [ ] Implement Puppeteer-based web scraper with robots.txt respect
- [ ] Add content extraction with Cheerio
- [ ] Build rate limiting and error handling
- [ ] Add basic deduplication logic

**Deliverables**:
- Search agent with configurable date and geographic filters
- Scraper agent that can extract content from web pages
- Basic pipeline: Query → Search → Scrape → Raw content
- Configuration system for search parameters

### **Week 3: Classification & Verification**
**Goal**: Implement high-precision AI classification and nonprofit verification

**Tasks**:
- [ ] Build classifier agent with OpenAI o4-mini for reasoning tasks
- [ ] Create high-precision prompts for auction/raffle detection
- [ ] Implement travel package keyword detection with confidence scoring
- [ ] Add nonprofit status verification using free IRS Pub 78 API or GuideStar public search for EIN verification
- [ ] Build date range filtering for events (configurable)
- [ ] Implement strict scoring system prioritizing precision
- [ ] Add self-consistency checks to reduce false positives
- [ ] Implement human review bucket for edge cases (log to separate Google Sheets tab)

**Deliverables**:
- High-precision classifier agent (targeting <5% false positives)
- Nonprofit verification system
- Lead scoring system with precision focus
- Configurable date range filtering functionality

### **Week 4: Data Pipeline & Output**
**Goal**: Complete data pipeline and Google Sheets integration

**Tasks**:
- [ ] Implement vector-based deduplication with pgvector
- [ ] Build enrichment agent for contact information, pulling from LinkedIn (via public search or API) for org details and staff size
- [ ] Create Google Sheets output with best practices formatting
- [ ] Add comprehensive data validation and error handling
- [ ] Implement batch processing for efficiency
- [ ] Add basic monitoring and logging
- [ ] Create configuration management system

**Deliverables**:
- Complete data pipeline: Search → Scrape → Classify → Enrich → Output
- Google Sheets integration with professional formatting
- Deduplication and enrichment working
- Configuration system for all parameters

### **Week 5: Testing & Optimization**
**Goal**: Quality assurance and performance tuning for high precision

**Tasks**:
- [ ] Implement comprehensive testing suite including unit tests for classifiers and integration tests for full pipeline
- [ ] Add cost monitoring and budget controls ($50 limit)
- [ ] Performance optimization within budget constraints
- [ ] Precision tuning based on test results (target >95% accuracy)
- [ ] Add configuration management UI/file
- [ ] Implement error recovery and retry logic
- [ ] Create validation dataset for testing

**Deliverables**:
- Test suite with >95% lead accuracy
- Cost monitoring within $50 budget
- Performance optimizations
- Configuration system with validation
- Precision-focused quality controls

### **Week 6: Production Launch**
**Goal**: Deploy and monitor production system

**Tasks**:
- [ ] Production deployment on DigitalOcean
- [ ] Set up monitoring and alerting (Google Sheets based)
- [ ] Create user documentation and configuration guide
- [ ] Implement backup and recovery
- [ ] Final testing and validation
- [ ] Production launch with daily Google Sheets updates

**Deliverables**:
- Production-ready system
- Google Sheets-based monitoring
- User documentation
- High-precision lead generation (fewer, better leads)

---

## 💰 Cost Breakdown ($50 Budget)

| Service | Monthly Cost | Usage |
|---------|-------------|--------|
| OpenAI API | ~$25 | o4-mini (reasoning) + gpt-4.1-mini (simple tasks & image analysis) + embeddings |
| SerpAPI | ~$15 | Basic plan (1,000 searches/month) |
| DigitalOcean | ~$10-15 | Managed PostgreSQL + Droplet (use self-managed Postgres on Droplet to optimize below $15 if needed) |
| Buffer | ~$2 | Contingency |
| **Total** | **$50** | **Within budget** |

---

## 📊 Google Sheets Best Practices Format

### **Lead Tracking Spreadsheet Structure**
```
| Date Added | Organization | EIN | Event Name | Event Date | Event Type | Travel Package | Location | Geographic Region | Date Range Match | Website | Contact Email | Phone | Staff Size | Confidence Score | Notes | Status |
```

### **Sheet Features**
- **Data Validation**: Dropdown menus for status, event type
- **Conditional Formatting**: Color coding by confidence score
- **Formulas**: Auto-calculated metrics (leads/day, conversion rates)
- **Filters**: Easy sorting and filtering capabilities
- **Protection**: Read-only data cells, editable status/notes only

### **Additional Sheets**
- **Daily Summary**: Aggregated metrics and trends
- **Configuration**: Editable search parameters
- **Quality Metrics**: Precision tracking and validation results

---

## ⚙️ Configuration System

### **Configurable Parameters**
*Load from `config.json` for easy editing without code changes*

```javascript
const config = {
  dateRanges: {
    searchMonths: ["March", "April", "May", "October", "November"],
    searchQuarters: ["Q2", "Q4"],
    eventDateRange: "2025-03-01 to 2025-12-31"
  },
  geographic: {
    states: ["CA", "NY", "TX", "FL"], // Empty array = all states
    regions: ["West Coast", "Northeast"], // Optional regional grouping
    excludeStates: ["AK", "HI"] // States to exclude
  },
  precision: {
    confidenceThreshold: 0.85, // High precision threshold
    requireMultipleKeywords: true,
    strictNonprofitVerification: true
  },
  limits: {
    maxLeadsPerDay: 10, // Quality over quantity
    maxSearchQueries: 50,
    budgetLimit: 50
  }
}
```

---

## 🎯 Success Metrics

### **Primary Goals**
- **High Precision**: >95% lead accuracy (few false positives)
- **Quality Leads**: 5-10 highly qualified leads per day
- **Cost Control**: ≤$50/month total spend
- **Reliability**: Daily Google Sheets updates by 9 AM

### **Quality Metrics**
- **False Positive Rate**: <5%
- **Nonprofit Verification**: 100% verified EIN numbers
- **Event Relevance**: 100% travel package auctions
- **Contact Accuracy**: >90% valid contact information

---

## ⚠️ Risks & Mitigations

### **Technical Risks**
| Risk | Impact | Mitigation |
|------|--------|------------|
| **LLM Hallucination** | False positives reduce precision | Self-consistency checks + human review bucket in Google Sheets |
| **Site Blocking** | Reduced data collection | IP rotation, respect robots.txt, crawl delays |
| **Cost Overrun** | Budget exceeded | Real-time budget monitoring, API usage alerts, cheaper first-pass models |
| **Rate Limiting** | Slow data collection | Implement exponential backoff, queue management |
| **Data Quality** | Poor lead accuracy | Multi-stage validation, confidence scoring, manual review tab |

### **Business Risks**
| Risk | Impact | Mitigation |
|------|--------|------------|
| **Seasonal Variations** | Inconsistent lead flow | Configurable date ranges, quarterly planning |
| **Nonprofit Database Changes** | Verification failures | Multiple verification sources, fallback methods |
| **Google Sheets Limits** | Output failures | Batch processing, multiple sheets rotation |
| **Precision Drift** | Increasing false positives | Regular model evaluation, feedback loops |

---

## 🔧 Development Setup

### **Prerequisites**
- Node.js 18+ with npm/yarn
- DigitalOcean account
- Google Cloud Console access
- OpenAI API key
- SerpAPI key

### **Environment Variables**
```bash
# API Keys
OPENAI_API_KEY=your_openai_key
SERPAPI_KEY=your_serpapi_key
GOOGLE_SHEETS_CREDENTIALS=path_to_credentials.json

# Database
DATABASE_URL=postgresql://user:pass@host:5432/leadminer

# Configuration
NODE_ENV=development
LOG_LEVEL=info
BUDGET_LIMIT=50
```

### **Development Commands**
```bash
# Setup
npm install
npm run setup:db
npm run setup:sheets

# Development
npm run dev          # Start development server
npm run test         # Run test suite
npm run test:precision # Run precision validation

# Production
npm run build
npm run start
npm run deploy
```

---

## 🚀 Deployment Strategy

### **DigitalOcean Setup**
1. **Droplet**: Basic plan ($6/month)
2. **Managed PostgreSQL**: Basic plan ($15/month - we'll optimize to $8)
3. **Docker**: Containerized deployment
4. **Automated Backup**: Daily database backups

### **CI/CD Pipeline**
- **GitHub Actions**: Automated testing and deployment
- **Quality Gates**: Precision validation before deployment
- **Rollback Strategy**: Quick revert to previous version
- **Monitoring**: Health checks and error alerting

---

## 📈 Future Enhancements

### **Phase 2 Features** (Post-Launch)
- **Advanced Analytics**: Trend analysis and success prediction
- **Multi-Channel Output**: Slack, email notifications
- **Enhanced Enrichment**: Social media integration
- **Automated Follow-up**: Email sequence automation
- **Machine Learning**: Improved classification accuracy

### **Scaling Considerations**
- **Handle 5x Seasonal Traffic**: Queue scaling and load balancing for peak periods
- **Redis Queue**: For higher throughput
- **Microservices**: Split agents into separate services
- **Load Balancing**: Multiple scraper instances
- **Advanced Monitoring**: Grafana dashboards

---

## ✅ Pre-Launch Checklist

### **Technical Validation**
- [ ] All agents functioning correctly
- [ ] Database connections stable
- [ ] Google Sheets integration working
- [ ] Cost monitoring active
- [ ] Error handling comprehensive

### **Quality Assurance**
- [ ] Precision testing >95% accuracy
- [ ] Configuration system validated
- [ ] All geographic filters working
- [ ] Date range filtering accurate
- [ ] Nonprofit verification 100%

### **Production Readiness**
- [ ] Deployment pipeline tested
- [ ] Monitoring and alerting active
- [ ] Backup and recovery procedures
- [ ] Documentation complete
- [ ] User training materials ready

---

## 🎯 Next Steps

1. **Approve Plan**: Confirm this implementation approach
2. **Set Up Environment**: Create accounts and API keys
3. **Begin Week 1**: Start with foundation setup
4. **Weekly Reviews**: Progress check and adjustments
5. **Launch**: Deploy production system

**Ready to begin implementation? Let's start with Week 1 tasks!** 