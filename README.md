# Lead Miner Agent - Week 1 Implementation

An autonomous lead generation system for nonprofit travel auction events, built with OpenAI Agents SDK and Google Sheets integration.

## 🚀 Week 1 Status

✅ **Completed Tasks:**
- [x] Node.js project with TypeScript support
- [x] Basic OpenAI Agent structure with hello-world functionality
- [x] Google Sheets API integration with best practices formatting
- [x] Configuration management with environment variables
- [x] Basic database schema with pgvector
- [x] Development environment setup

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL with pgvector extension
- OpenAI API key
- Google Cloud Console project with Sheets API enabled
- Google Service Account with appropriate permissions

## 🔧 Setup Instructions

### 1. Quick Setup (Recommended)

```bash
# Run the automated setup script
./setup.sh
```

### 1. Manual Setup

```bash
# Clone the repository
git clone <repository-url>
cd lead-miner-agent

# Install dependencies
npm install

# Install TypeScript globally (if not already installed)
npm install -g typescript

# Build the project
npm run build
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# API Keys
OPENAI_API_KEY=your_openai_api_key_here
SERPAPI_KEY=your_serpapi_key_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/leadminer

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
PORT=3000

# Budget and Limits
BUDGET_LIMIT=50
MAX_LEADS_PER_DAY=10
MAX_SEARCH_QUERIES=50
CONFIDENCE_THRESHOLD=0.85

# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id_here
```

### 3. Google Cloud Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Required APIs**
   - Google Sheets API
   - Google Drive API (optional, for sharing)

3. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Create a new service account
   - Download the JSON key file
   - Extract `client_email` and `private_key` for environment variables

4. **Create Google Sheet**
   - Create a new Google Sheet
   - Copy the sheet ID from the URL
   - Share the sheet with your service account email

### 4. Database Setup

```bash
# Create database
createdb leadminer

# Install pgvector extension
psql -d leadminer -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run schema setup
psql -d leadminer -f src/database/schema.sql
```

### 5. Build and Run

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## 🔧 TypeScript Configuration

The project includes temporary type definitions in `src/types/external.d.ts` for external packages. These will be replaced with proper package installations during setup.

### Running Without Dependencies

If you encounter TypeScript errors before running `npm install`, the project includes:
- Temporary type definitions for external packages
- Node.js global type definitions  
- Proper module resolution configuration

After running `./setup.sh` or `npm install`, all TypeScript errors should be resolved.

## 🧪 Testing the Implementation

The Week 1 implementation includes a comprehensive hello-world test:

```bash
npm run dev
```

This will:
1. ✅ Test configuration loading
2. 🤖 Initialize OpenAI Agent
3. 📊 Connect to Google Sheets
4. ✍️ Write test data to sheets
5. 📝 Generate sample lead data
6. 🔗 Validate integration readiness

## 📊 Google Sheets Structure

The system creates 4 sheets automatically:

### Leads Sheet
| Column | Description |
|--------|-------------|
| Date Added | Lead creation date |
| Organization | Nonprofit organization name |
| EIN | Tax ID number |
| Event Name | Name of the event |
| Event Date | Date of the event |
| Event Type | Auction/Raffle classification |
| Travel Package | Whether event includes travel |
| Location | Geographic location |
| Geographic Region | Configured region match |
| Date Range Match | Configured date range |
| Website | Organization website |
| Contact Email | Primary contact email |
| Phone | Contact phone number |
| Staff Size | Organization size |
| Confidence Score | AI confidence (0-1) |
| Notes | Additional notes |
| Status | Lead status |

### Daily Summary Sheet
- Total leads generated
- Qualified leads count
- Average confidence score
- Top geographic regions
- Budget utilization
- API usage metrics

### Configuration Sheet
- System configuration settings
- Editable parameters
- Last updated timestamps

### Quality Metrics Sheet
- Precision tracking
- False positive monitoring
- Model performance metrics

## 🔍 Project Structure

```
lead-miner-agent/
├── src/
│   ├── agents/                 # AI agents
│   │   └── hello-world.ts     # Week 1 test agent
│   ├── config/                # Configuration management
│   │   └── index.ts           # Environment variables & validation
│   ├── database/              # Database schema and utilities
│   │   └── schema.sql         # PostgreSQL schema
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts           # Interface definitions
│   ├── utils/                 # Utility functions
│   │   └── sheets.ts          # Google Sheets integration
│   └── app.ts                 # Main application entry point
├── package.json               # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── lead-miner-guide.md       # Complete implementation guide
└── README.md                 # This file
```

## 🎯 Configuration Options

### Geographic Targeting
```bash
TARGET_STATES=CA,NY,TX,FL          # Specific states
TARGET_REGIONS=West Coast,Northeast # Regional grouping
EXCLUDE_STATES=AK,HI               # States to exclude
```

### Date Range Filtering
```bash
SEARCH_MONTHS=March,April,May      # Target months
SEARCH_QUARTERS=Q2,Q4              # Target quarters
EVENT_DATE_RANGE=2025-03-01 to 2025-12-31  # Event date range
```

### Precision Controls
```bash
CONFIDENCE_THRESHOLD=0.85          # Minimum confidence (0-1)
REQUIRE_MULTIPLE_KEYWORDS=true     # Require multiple matching keywords
STRICT_NONPROFIT_VERIFICATION=true # Strict EIN verification
```

## 📈 Next Steps - Week 2

- [ ] Implement SerpAPI search integration
- [ ] Build configurable query generation
- [ ] Add Puppeteer web scraping
- [ ] Implement content extraction with Cheerio
- [ ] Add basic rate limiting and error handling

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build project
npm run build

# Run tests
npm test

# Run precision validation
npm run test:precision

# Set up database
npm run setup:db

# Set up Google Sheets
npm run setup:sheets
```

## 📚 Architecture Overview

The system follows a modular, agent-based architecture:

- **Configuration Layer**: Environment-based configuration with validation
- **Agent Layer**: OpenAI Agents SDK for AI orchestration
- **Data Layer**: PostgreSQL with pgvector for similarity search
- **Output Layer**: Google Sheets for lead tracking and monitoring
- **Utility Layer**: Shared utilities for common operations

## 🔒 Security Considerations

- Environment variables for sensitive data
- Service account authentication for Google APIs
- Database connection encryption
- API key validation and rotation
- Rate limiting to prevent abuse

## 📞 Support

For questions or issues:
1. Check the configuration documentation in `lead-miner-guide.md`
2. Verify environment variables are set correctly
3. Ensure all prerequisites are installed
4. Check the Google Sheets sharing permissions

## 📄 License

MIT License - See LICENSE file for details 