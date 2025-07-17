# ⚡ Lead-Miner Agent Quick Start Checklist

*30-minute setup for experienced developers*

## 📋 Pre-Setup Requirements

- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Credit card for API services (~$50/month)
- [ ] Text editor (VS Code recommended)

---

## 🔑 API Keys Setup (15 minutes)

### OpenAI API
- [ ] Go to [platform.openai.com](https://platform.openai.com)
- [ ] Create account + add payment method
- [ ] Generate API key (starts with `sk-`)
- [ ] Set $30/month usage limit

### SerpAPI
- [ ] Go to [serpapi.com](https://serpapi.com)
- [ ] Sign up for Basic Plan ($50/month)
- [ ] Copy API key from dashboard

### Google Sheets
- [ ] Create Google Cloud project
- [ ] Enable Sheets API + Drive API
- [ ] Create service account + download JSON
- [ ] Create new Google Sheet
- [ ] Share sheet with service account email
- [ ] Copy Sheet ID from URL

---

## 🌊 DigitalOcean Setup (10 minutes)

### Database
- [ ] Create DigitalOcean account
- [ ] Create PostgreSQL database ($15/month)
- [ ] Note connection string
- [ ] Add your IP to trusted sources

### Droplet (Optional for production)
- [ ] Create Ubuntu 22.04 droplet ($12/month)
- [ ] Install Docker + Docker Compose
- [ ] Create `/opt/lead-miner` directory

---

## 💻 Local Setup (5 minutes)

```bash
# Clone and setup
git clone <repo-url>
cd LeadMinerv1
chmod +x setup.sh
./setup.sh

# Configure environment
cp env.example .env
# Edit .env with your API keys

# Test setup
npm run build
npm test
npm run dev
```

### Required .env Variables
```env
OPENAI_API_KEY=sk-your-key-here
SERPAPI_KEY=your-serpapi-key
GOOGLE_SERVICE_ACCOUNT_EMAIL=service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----"
GOOGLE_SHEET_ID=your-sheet-id
DATABASE_URL=postgresql://user:pass@host:5432/leadminer
```

---

## 🚀 Production Deployment (Optional)

```bash
# On your droplet
cd /opt/lead-miner
# Upload code via git or scp
docker-compose up -d

# Setup daily scheduling
systemctl enable lead-miner.timer
systemctl start lead-miner.timer
```

---

## ✅ Validation Tests

- [ ] `npm test` - All tests pass
- [ ] `npm run build` - Clean build
- [ ] Check Google Sheets for "Hello World" entry
- [ ] Verify budget monitoring is active
- [ ] Run sample search to test pipeline

---

## 📊 Expected Results

After setup, your system will:
- Generate 5-15 high-quality leads daily
- Update Google Sheets automatically
- Stay within $50/month budget
- Monitor its own performance

---

## 🚨 Common Issues

**API Key Errors:**
```bash
# Test OpenAI
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Test SerpAPI
curl "https://serpapi.com/search.json?engine=google&q=test&api_key=$SERPAPI_KEY"
```

**Google Sheets Issues:**
- Verify service account has editor permissions
- Check Sheet ID is correct
- Ensure APIs are enabled in Google Cloud

**Database Connection:**
- Verify connection string format
- Check IP is in trusted sources
- Test connection with `npm run db-test`

---

## 📞 Need Help?

- **Full Setup Guide**: [COMPLETE_SETUP_GUIDE.md](./COMPLETE_SETUP_GUIDE.md)
- **Production Guide**: [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md)
- **Troubleshooting**: Check logs with `docker-compose logs -f`

---

**Ready to generate leads? Run `npm run start` to begin!** 🚀 