#!/bin/bash

# Lead Miner Agent Setup Script
# This script sets up the development environment

echo "🚀 Setting up Lead Miner Agent..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if TypeScript is installed globally
if ! command -v tsc &> /dev/null; then
    echo "🔧 Installing TypeScript globally..."
    npm install -g typescript
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
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
EOF
    echo "✅ Created .env file. Please edit it with your actual API keys."
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🏗️  Building TypeScript project..."
npm run build

# Check if PostgreSQL is running
if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
        echo "✅ PostgreSQL is running"
    else
        echo "⚠️  PostgreSQL is not running. Please start PostgreSQL and run the database setup."
    fi
else
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL with pgvector extension."
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Set up PostgreSQL database: npm run setup:db"
echo "3. Create Google Sheet and update GOOGLE_SHEET_ID"
echo "4. Run the hello world test: npm run dev"
echo ""
echo "For detailed setup instructions, see README.md" 