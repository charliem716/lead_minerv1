# 🚀 Lead-Miner Agent Complete Setup Guide
*Production-Ready Deployment Guide*
**Version:** 1.0 — January 2025

---

## 📋 Overview

This comprehensive guide will walk you through setting up the Lead-Miner Agent from scratch, including:
- All required API keys and services
- DigitalOcean droplet and database setup
- Local development environment
- Production deployment
- Testing and validation

**Estimated Setup Time:** 2-3 hours

---

## 🛠️ Prerequisites Checklist

Before starting, ensure you have:
- [ ] Computer with terminal access (Mac/Linux/Windows with WSL)
- [ ] Credit card for API services (total cost ~$50/month)
- [ ] Basic command line knowledge
- [ ] Text editor (VS Code recommended)

---

## 🔑 Step 1: API Keys & Service Setup

### 1.1 OpenAI API Setup
1. **Create OpenAI Account**
   - Go to [https://platform.openai.com](https://platform.openai.com)
   - Sign up or log in
   - Add payment method (required for API access)

2. **Generate API Key**
   - Navigate to API Keys section
   - Click "Create new secret key"
   - Name it "Lead-Miner-Agent"
   - **Copy and save the key** (starts with `sk-`)
   - Set usage limits: $30/month (safety buffer)

3. **Verify Access**
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        -H "Content-Type: application/json" \
        https://api.openai.com/v1/models
   ```

### 1.2 SerpAPI Setup
1. **Create SerpAPI Account**
   - Go to [https://serpapi.com](https://serpapi.com)
   - Sign up for free account
   - Choose "Basic Plan" ($50/month for 5,000 searches)

2. **Get API Key**
   - Go to Dashboard → API Key
   - **Copy and save the key**

3. **Test API Key**
   ```bash
   curl "https://serpapi.com/search.json?engine=google&q=test&api_key=YOUR_API_KEY"
   ```

### 1.3 Google Sheets API Setup
1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project: "Lead-Miner-Agent"
   - Enable Google Sheets API and Google Drive API

2. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Name: "lead-miner-service"
   - Role: "Editor"
   - Create and download JSON key file

3. **Create Google Sheet**
   - Create new Google Sheet: "Lead-Miner-Results"
   - Share with service account email (from JSON file)
   - Give "Editor" permissions
   - **Copy Sheet ID** from URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

4. **Prepare Service Account Key**
   - Open downloaded JSON file
   - Extract `client_email` and `private_key` values
   - Keep JSON file secure

---

## 🌊 Step 2: DigitalOcean Infrastructure Setup

### 2.1 Create DigitalOcean Account
1. **Sign up** at [https://digitalocean.com](https://digitalocean.com)
2. **Add payment method** and verify account
3. **Optional**: Use referral link for $200 credit

### 2.2 Create Managed PostgreSQL Database
1. **Create Database**
   - Go to Databases → Create Database
   - Choose PostgreSQL 15
   - Plan: Basic ($15/month)
   - Region: Choose closest to your location
   - Database name: `leadminer`
   - **Save connection details**

2. **Configure Database**
   - Wait for database to be ready (5-10 minutes)
   - Go to Settings → Trusted Sources
   - Add your IP address for development access
   - Note down connection string

3. **Install pgvector Extension**
   ```sql
   -- Connect to your database and run:
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 2.3 Create Production Droplet
1. **Create Droplet**
   - Go to Droplets → Create Droplet
   - Choose Ubuntu 22.04 LTS
   - Plan: Basic ($12/month, 2GB RAM)
   - Region: Same as database
   - Authentication: SSH Key (recommended) or Password
   - Hostname: `lead-miner-prod`

2. **Initial Server Setup**
   ```bash
   # SSH into your droplet
   ssh root@your_droplet_ip
   
   # Update system
   apt update && apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Install Docker Compose
   curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   chmod +x /usr/local/bin/docker-compose
   
   # Install Node.js (for development)
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt-get install -y nodejs
   
   # Create application directory
   mkdir -p /opt/lead-miner
   cd /opt/lead-miner
   ```

---

## 💻 Step 3: Local Development Setup

### 3.1 Clone and Setup Project
```bash
# Clone the repository
git clone <your-repo-url>
cd LeadMinerv1

# Run automated setup
chmod +x setup.sh
./setup.sh

# Install dependencies
npm install
```

### 3.2 Configure Environment Variables
Create `.env` file with your API keys:

```bash
# Copy example environment file
cp env.example .env

# Edit with your actual values
nano .env
```

**Complete .env configuration:**
```env
# API Keys
OPENAI_API_KEY=sk-your-openai-key-here
SERPAPI_KEY=your-serpapi-key-here

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=lead-miner-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
GOOGLE_SHEET_ID=your-google-sheet-id-here

# Database Configuration (for local development)
DATABASE_URL=postgresql://username:password@localhost:5432/leadminer

# Production Database (DigitalOcean)
PRODUCTION_DATABASE_URL=postgresql://doadmin:password@db-postgresql-nyc3-12345-do-user-123456-0.b.db.ondigitalocean.com:25060/leadminer?sslmode=require

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
PORT=3000

# Budget and Limits
BUDGET_LIMIT=50
MAX_LEADS_PER_DAY=15
MAX_SEARCH_QUERIES=100
CONFIDENCE_THRESHOLD=0.85

# Search Configuration
SEARCH_STATES=CA,NY,TX,FL,WA,IL,PA,OH,GA,NC
SEARCH_MONTHS=March,April,May,October,November,December
EVENT_DATE_RANGE=2025-03-01,2025-12-31

# Rate Limiting
SERPAPI_DELAY_MS=2000
OPENAI_DELAY_MS=1000
SCRAPER_DELAY_MS=3000
```

### 3.3 Setup Local Database (Optional)
If you want to develop locally:

```bash
# Install PostgreSQL locally
# On Mac:
brew install postgresql pgvector

# On Ubuntu:
sudo apt-get install postgresql postgresql-contrib

# Create local database
createdb leadminer

# Install pgvector extension
psql leadminer -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3.4 Test Local Setup
```bash
# Build the project
npm run build

# Run tests
npm test

# Test hello world functionality
npm run dev
```

---

## 🚀 Step 4: Production Deployment

### 4.1 Prepare Production Files
Create production environment file on your droplet:

```bash
# SSH into your droplet
ssh root@your_droplet_ip
cd /opt/lead-miner

# Create production environment file
cat > .env.production << 'EOF'
# API Keys
OPENAI_API_KEY=sk-your-openai-key-here
SERPAPI_KEY=your-serpapi-key-here

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=lead-miner-service@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
GOOGLE_SHEET_ID=your-google-sheet-id-here

# Production Database
DATABASE_URL=postgresql://doadmin:password@your-db-host:25060/leadminer?sslmode=require

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Budget and Limits
BUDGET_LIMIT=50
MAX_LEADS_PER_DAY=15
MAX_SEARCH_QUERIES=100
CONFIDENCE_THRESHOLD=0.85
EOF
```

### 4.2 Deploy Application
```bash
# Upload your code to the droplet
# From your local machine:
scp -r . root@your_droplet_ip:/opt/lead-miner/

# Or use git:
# ssh root@your_droplet_ip
# cd /opt/lead-miner
# git clone <your-repo-url> .
```

### 4.3 Setup Docker Deployment
```bash
# On your droplet:
cd /opt/lead-miner

# Build and start containers
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f lead-miner
```

### 4.4 Setup Automated Scheduling
```bash
# Create systemd service for daily execution
cat > /etc/systemd/system/lead-miner.service << 'EOF'
[Unit]
Description=Lead Miner Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lead-miner
ExecStart=/usr/local/bin/docker-compose up lead-miner
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create daily timer
cat > /etc/systemd/system/lead-miner.timer << 'EOF'
[Unit]
Description=Run Lead Miner Agent daily
Requires=lead-miner.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start timer
systemctl daemon-reload
systemctl enable lead-miner.timer
systemctl start lead-miner.timer
```

---

## 🔧 Step 5: Configuration & Testing

### 5.1 Configure Search Parameters
Edit the configuration in Google Sheets or update environment variables:

```bash
# Test different configurations
export SEARCH_STATES="CA,NY,TX"
export SEARCH_MONTHS="March,April,May"
export MAX_LEADS_PER_DAY=10
```

### 5.2 Test Production Deployment
```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Run manual test
cd /opt/lead-miner
docker-compose exec lead-miner npm run test

# Run production pipeline
docker-compose exec lead-miner npm run start
```

### 5.3 Monitor System Health
```bash
# Check application logs
docker-compose logs -f lead-miner

# Monitor resource usage
htop

# Check database connections
docker-compose exec lead-miner npm run health-check
```

---

## 📊 Step 6: Monitoring & Maintenance

### 6.1 Setup Monitoring Dashboard
The system automatically creates monitoring sheets in your Google Sheet:
- **Lead Tracking**: Main results
- **Daily Summary**: Metrics and trends
- **Quality Metrics**: Accuracy tracking
- **System Health**: Performance monitoring

### 6.2 Budget Monitoring
```bash
# Check current spend
docker-compose exec lead-miner npm run budget-check

# View cost breakdown
docker-compose exec lead-miner npm run cost-report
```

### 6.3 Backup Setup
```bash
# Create backup script
cat > /opt/lead-miner/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/lead-miner/backups"
mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$DATE.sql

# Backup configuration
cp .env.production $BACKUP_DIR/env_backup_$DATE

# Upload to DigitalOcean Spaces (optional)
# s3cmd put $BACKUP_DIR/db_backup_$DATE.sql s3://your-backup-bucket/
EOF

chmod +x /opt/lead-miner/backup.sh

# Setup daily backup cron
echo "0 2 * * * /opt/lead-miner/backup.sh" | crontab -
```

---

## 🧪 Step 7: Testing & Validation

### 7.1 Run Complete Test Suite
```bash
# Local testing
npm test

# Production testing
docker-compose exec lead-miner npm test

# Integration testing
docker-compose exec lead-miner npm run test:integration
```

### 7.2 Validate Lead Quality
```bash
# Run precision validation
docker-compose exec lead-miner npm run validate-precision

# Check sample results
docker-compose exec lead-miner npm run sample-run
```

### 7.3 Performance Testing
```bash
# Load testing
docker-compose exec lead-miner npm run load-test

# Memory usage check
docker stats lead-miner
```

---

## 🚨 Step 8: Troubleshooting

### 8.1 Common Issues

**API Key Issues:**
```bash
# Test OpenAI connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Test SerpAPI connection
curl "https://serpapi.com/search.json?engine=google&q=test&api_key=$SERPAPI_KEY"
```

**Database Connection Issues:**
```bash
# Test database connection
docker-compose exec lead-miner npm run db-test

# Check database logs
docker-compose logs postgres
```

**Google Sheets Issues:**
```bash
# Test Google Sheets access
docker-compose exec lead-miner npm run sheets-test

# Verify service account permissions
```

### 8.2 Log Analysis
```bash
# View application logs
docker-compose logs -f lead-miner

# Check system logs
journalctl -u lead-miner.service -f

# Monitor error rates
grep "ERROR" /opt/lead-miner/logs/app.log
```

---

## 📋 Step 9: Go-Live Checklist

### Pre-Launch Validation
- [ ] All API keys working and validated
- [ ] Database connection established
- [ ] Google Sheets integration working
- [ ] Test run completed successfully
- [ ] Budget monitoring active
- [ ] Backup system configured
- [ ] Monitoring dashboard setup

### Production Launch
- [ ] Deploy to production droplet
- [ ] Configure daily scheduling
- [ ] Set up monitoring alerts
- [ ] Run initial production test
- [ ] Validate first batch of leads
- [ ] Monitor for 24 hours

### Post-Launch Monitoring
- [ ] Daily lead quality review
- [ ] Weekly budget analysis
- [ ] Monthly performance optimization
- [ ] Quarterly configuration tuning

---

## 🎯 Step 10: Optimization & Scaling

### 10.1 Performance Optimization
```bash
# Enable caching
export ENABLE_CACHING=true

# Optimize database queries
docker-compose exec lead-miner npm run optimize-db

# Tune search parameters
export CONFIDENCE_THRESHOLD=0.90
```

### 10.2 Cost Optimization
```bash
# Enable smart model selection
export SMART_MODEL_SELECTION=true

# Optimize API usage
export BATCH_SIZE=10
export RATE_LIMIT_BUFFER=0.8
```

### 10.3 Scale for Growth
```bash
# Add more search regions
export SEARCH_STATES="ALL"

# Increase daily limits
export MAX_LEADS_PER_DAY=25

# Add more workers
docker-compose scale lead-miner=2
```

---

## 📞 Support & Resources

### Documentation
- [Lead-Miner Guide](./lead-miner-guide.md)
- [Production Guide](./PRODUCTION_GUIDE.md)
- [API Documentation](./docs/api.md)

### Monitoring URLs
- **Google Sheets**: Your lead tracking spreadsheet
- **DigitalOcean Dashboard**: Server monitoring
- **OpenAI Usage**: API usage tracking

### Emergency Contacts
- **System Issues**: Check logs and restart services
- **API Issues**: Verify keys and usage limits
- **Budget Exceeded**: Review cost monitoring alerts

---

## 🎉 Congratulations!

You now have a fully operational Lead-Miner Agent system that will:
- ✅ Generate 5-15 high-quality leads daily
- ✅ Stay within your $50/month budget
- ✅ Automatically update Google Sheets
- ✅ Monitor its own performance
- ✅ Scale as your needs grow

**Your Lead-Miner Agent is ready to start generating valuable nonprofit travel auction leads!** 🚀

---

*For technical support or questions, refer to the troubleshooting section or review the comprehensive logs.* 