# Lead-Miner Agent Production Guide
*Complete deployment and operation guide for production environments*

## 📋 Table of Contents
1. [Production Deployment](#production-deployment)
2. [Configuration Guide](#configuration-guide)
3. [Operation Manual](#operation-manual)
4. [Monitoring & Maintenance](#monitoring--maintenance)
5. [Troubleshooting](#troubleshooting)
6. [Cost Management](#cost-management)
7. [Security Best Practices](#security-best-practices)

---

## 🚀 Production Deployment

### Prerequisites
- Docker and Docker Compose installed
- DigitalOcean account (or similar cloud provider)
- Domain name (optional, for SSL)
- Required API keys (see Configuration Guide)

### Step 1: Server Setup

```bash
# Create a new DigitalOcean droplet (Ubuntu 22.04)
# Recommended: 2GB RAM, 2 vCPUs, 50GB SSD

# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Create app directory
mkdir -p /opt/leadminer
cd /opt/leadminer
```

### Step 2: Deploy Application

```bash
# Clone the repository
git clone <your-repo-url> .

# Create environment file
cp .env.example .env.production

# Edit environment variables (see Configuration Guide)
nano .env.production

# Create required directories
mkdir -p logs data ssl

# Deploy with Docker Compose
docker-compose up -d

# Check deployment status
docker-compose ps
docker-compose logs -f leadminer-app
```

### Step 3: SSL Setup (Optional)

```bash
# Install Certbot for Let's Encrypt
apt install certbot -y

# Generate SSL certificate
certbot certonly --standalone -d your-domain.com

# Copy certificates to ssl directory
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem

# Restart nginx
docker-compose restart nginx
```

---

## ⚙️ Configuration Guide

### Environment Variables

Create `.env.production` file with the following variables:

```bash
# Application Settings
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database Configuration
DB_PASSWORD=your_secure_db_password
DATABASE_URL=postgresql://leadminer:${DB_PASSWORD}@postgres:5432/leadminer

# Redis Configuration
REDIS_PASSWORD=your_secure_redis_password
REDIS_URL=redis://redis:6379

# API Keys
OPENAI_API_KEY=sk-your_openai_api_key
SERPAPI_KEY=your_serpapi_key

# Google Sheets Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
GOOGLE_SHEET_ID=your_google_sheet_id

# Budget and Limits
BUDGET_LIMIT=50
MAX_LEADS_PER_DAY=10
MAX_SEARCH_QUERIES=50
CONFIDENCE_THRESHOLD=0.85

# Search Configuration
SEARCH_MONTHS=March,April,May,October,November
SEARCH_REGIONS=West Coast,Northeast,Southeast
EXCLUDED_STATES=AK,HI

# Performance Settings
CACHE_TTL=3600
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600
```

### Google Sheets Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Sheets API and Google Drive API

2. **Create Service Account**
   - Go to IAM & Admin → Service Accounts
   - Create new service account
   - Download JSON key file
   - Extract email and private key for environment variables

3. **Create Google Sheet**
   - Create a new Google Sheet
   - Share it with your service account email
   - Copy the sheet ID from the URL

### API Keys Setup

1. **OpenAI API Key**
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Create API key with appropriate usage limits
   - Set up billing alerts

2. **SerpAPI Key**
   - Go to [SerpAPI](https://serpapi.com/)
   - Sign up for basic plan (1,000 searches/month)
   - Get API key from dashboard

---

## 📖 Operation Manual

### Daily Operations

The Lead-Miner Agent runs automatically with the following schedule:

- **6:00 AM**: System health check and monitoring report
- **9:00 AM**: Main lead generation pipeline execution
- **12:00 PM**: Midday health check and cost monitoring
- **6:00 PM**: Evening pipeline execution (if budget allows)
- **11:00 PM**: Daily summary report and cleanup

### Manual Operations

#### Start/Stop System
```bash
# Start the system
docker-compose up -d

# Stop the system
docker-compose down

# Restart specific service
docker-compose restart leadminer-app

# View logs
docker-compose logs -f leadminer-app
```

#### Run Pipeline Manually
```bash
# Execute pipeline once
docker-compose exec leadminer-app node dist/pipeline/orchestrator.js

# Run with specific configuration
docker-compose exec leadminer-app node dist/pipeline/orchestrator.js --config=high-precision

# Test mode (no actual API calls)
docker-compose exec leadminer-app node dist/pipeline/orchestrator.js --test-mode
```

#### Database Operations
```bash
# Connect to database
docker-compose exec postgres psql -U leadminer -d leadminer

# Backup database
docker-compose exec postgres pg_dump -U leadminer leadminer > backup_$(date +%Y%m%d).sql

# Restore database
docker-compose exec postgres psql -U leadminer -d leadminer < backup_20250101.sql
```

### Google Sheets Output

The system writes to multiple sheets:

1. **Lead Tracking**: Main lead data with contact information
2. **Daily Summary**: Aggregated metrics and performance data
3. **Quality Metrics**: Precision tracking and validation results
4. **Manual Review**: Leads flagged for human review
5. **Configuration**: Current system settings

---

## 📊 Monitoring & Maintenance

### Health Monitoring

The system provides multiple monitoring endpoints:

- **Health Check**: `http://your-domain.com/health`
- **System Metrics**: Available in Google Sheets
- **Cost Monitoring**: Real-time budget tracking
- **Performance Metrics**: Response times and error rates

### Key Metrics to Monitor

1. **System Health**
   - Memory usage < 85%
   - Database connectivity
   - API response times < 2s

2. **Cost Management**
   - Daily spend within budget
   - Monthly projection accuracy
   - Cost per lead efficiency

3. **Quality Metrics**
   - Lead precision > 95%
   - False positive rate < 5%
   - Nonprofit verification accuracy

### Automated Alerts

The system generates alerts for:
- Budget warnings (80%, 95% thresholds)
- System health issues
- High error rates (>5%)
- Performance degradation
- API quota limits

### Maintenance Tasks

#### Daily
- Check system health dashboard
- Review cost monitoring reports
- Validate lead quality metrics
- Monitor alert notifications

#### Weekly
- Update configuration if needed
- Review and resolve manual review items
- Analyze performance trends
- Check for system updates

#### Monthly
- Database maintenance and optimization
- Cost analysis and budget adjustments
- Performance optimization review
- Security updates and patches

---

## 🔧 Troubleshooting

### Common Issues

#### High Memory Usage
```bash
# Check memory usage
docker stats leadminer-app

# Restart application
docker-compose restart leadminer-app

# Check for memory leaks
docker-compose logs leadminer-app | grep "memory"
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U leadminer

# Restart database
docker-compose restart postgres

# Check connection limits
docker-compose exec postgres psql -U leadminer -c "SELECT * FROM pg_stat_activity;"
```

#### API Rate Limiting
```bash
# Check API usage
docker-compose logs leadminer-app | grep "rate limit"

# Adjust rate limiting in configuration
# Edit .env.production and restart
```

#### Google Sheets Access Issues
```bash
# Test Google Sheets connection
docker-compose exec leadminer-app node -e "
const { sheetsManager } = require('./dist/utils/sheets');
sheetsManager.initialize().then(() => console.log('✅ Connected'))
.catch(err => console.error('❌ Failed:', err));
"
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| E001 | Database connection failed | Check DATABASE_URL and restart postgres |
| E002 | OpenAI API key invalid | Verify OPENAI_API_KEY in environment |
| E003 | Budget limit exceeded | Increase BUDGET_LIMIT or wait for reset |
| E004 | Google Sheets access denied | Check service account permissions |
| E005 | SerpAPI quota exceeded | Upgrade plan or reduce search frequency |

---

## 💰 Cost Management

### Budget Monitoring

The system enforces a strict $50/month budget:

- **Real-time tracking**: Every API call is monitored
- **Automatic shutdown**: Operations halt when budget is exceeded
- **Predictive alerts**: Warnings at 80% and 95% usage
- **Daily reports**: Cost breakdown by service

### Cost Optimization

1. **Model Selection**
   - Use gpt-4.1-mini for simple tasks
   - Reserve o4-mini for complex reasoning
   - Implement intelligent caching

2. **Search Optimization**
   - Optimize query patterns
   - Use geographic and date filters
   - Implement smart deduplication

3. **Processing Efficiency**
   - Batch operations when possible
   - Use vector similarity for deduplication
   - Implement result caching

### Budget Breakdown

| Service | Monthly Allocation | Usage |
|---------|-------------------|--------|
| OpenAI API | $25 (50%) | Classification, embeddings |
| SerpAPI | $15 (30%) | Search queries |
| DigitalOcean | $10 (20%) | Infrastructure |

---

## 🔒 Security Best Practices

### Environment Security

1. **Secure Environment Variables**
   - Use strong, unique passwords
   - Rotate API keys regularly
   - Never commit secrets to version control

2. **Network Security**
   - Use HTTPS for all external communications
   - Implement proper firewall rules
   - Regular security updates

3. **Database Security**
   - Use encrypted connections
   - Regular backups with encryption
   - Implement proper access controls

### API Security

1. **Rate Limiting**
   - Implement per-IP rate limiting
   - Use API key rotation
   - Monitor for unusual usage patterns

2. **Data Protection**
   - Encrypt sensitive data at rest
   - Use secure transmission protocols
   - Implement data retention policies

### Monitoring Security

1. **Audit Logging**
   - Log all API calls
   - Monitor authentication attempts
   - Track configuration changes

2. **Alert Management**
   - Set up security alerts
   - Monitor for suspicious activity
   - Implement incident response procedures

---

## 🎯 Performance Optimization

### System Performance

1. **Resource Optimization**
   - Monitor memory usage
   - Optimize database queries
   - Implement efficient caching

2. **Scaling Considerations**
   - Horizontal scaling for high load
   - Database connection pooling
   - Load balancing for multiple instances

### Lead Quality

1. **Precision Tuning**
   - Adjust confidence thresholds
   - Improve classification prompts
   - Enhance keyword detection

2. **Validation Improvements**
   - Multi-source nonprofit verification
   - Geographic validation
   - Date range accuracy

---

## 📞 Support & Contact

For technical support:
- Check troubleshooting section first
- Review system logs for error details
- Contact system administrator

For configuration changes:
- Update environment variables
- Restart affected services
- Monitor system health after changes

---

*This guide covers the complete production deployment and operation of the Lead-Miner Agent. Keep this document updated as the system evolves.* 