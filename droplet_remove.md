# 🏠 Droplet to Local Migration Plan

## 📋 Executive Summary
**Objective**: Migrate Lead-Miner service from DigitalOcean droplet to fully local MacBook setup
**Timeline**: 1-2 hours
**Cost Savings**: $144/year (droplet costs)
**Security Improvement**: No public IP exposure

---

## 🎯 Migration Benefits

### ✅ **Cost Savings**
- **Droplet Cost**: $12/month = $144/year
- **Local Cost**: $0
- **ROI**: Immediate 100% cost reduction

### ✅ **Security Improvements**
- No public IP exposure
- Behind home router firewall
- No SSH key management
- No server hardening required
- Zero attack surface

### ✅ **Development Benefits**
- Instant code changes (no deployment)
- Direct file system access
- Local debugging capabilities
- Full system resource access
- No network latency

### ✅ **Operational Simplicity**
- No server maintenance
- No OS updates to manage
- No service monitoring required
- Simplified backup strategy

---

## 🔄 Migration Steps

### **Phase 1: Pre-Migration Preparation** (15 minutes)

#### 1.1 Verify Local Environment
```bash
# Confirm Node.js version
node --version  # Should be 18+ 

# Confirm npm packages
npm install

# Test local build
npm run build

# Verify environment variables
cat .env  # Ensure all APIs configured
```

#### 1.2 Backup Critical Data
```bash
# Create backup directory
mkdir -p backups/droplet-migration

# Backup current local state
cp -r data/ backups/droplet-migration/local-data-backup
cp .env backups/droplet-migration/env-backup
cp -r dist/ backups/droplet-migration/dist-backup
```

#### 1.3 Document Current Droplet State
```bash
# Document what's running on droplet (before shutdown)
ssh root@24.199.125.35 "ps aux | grep node" > backups/droplet-migration/droplet-processes.txt
ssh root@24.199.125.35 "crontab -l" > backups/droplet-migration/droplet-crontab.txt 2>/dev/null || echo "No crontab"
ssh root@24.199.125.35 "systemctl list-units --type=service --state=running" > backups/droplet-migration/droplet-services.txt
```

### **Phase 2: Local Setup Enhancement** (30 minutes)

#### 2.1 Create Local Automation Scripts
```bash
# Create scripts directory
mkdir -p scripts/local-automation

# Create run-pipeline.sh
cat > scripts/local-automation/run-pipeline.sh << 'EOF'
#!/bin/bash
# Lead-Miner Pipeline Execution Script
cd "$(dirname "$0")/../.."
echo "🚀 Starting Lead-Miner Pipeline at $(date)"

# Ensure build is fresh
npm run build

# Run the pipeline
node dist/production-app.js

# Log completion
echo "✅ Pipeline completed at $(date)"
EOF

chmod +x scripts/local-automation/run-pipeline.sh
```

#### 2.2 Set Up Local Scheduling
```bash
# Create launchd plist for macOS scheduling
mkdir -p ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.leadminer.pipeline.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.leadminer.pipeline</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$(pwd)/scripts/local-automation/run-pipeline.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>14400</integer> <!-- 4 hours -->
    <key>StandardOutPath</key>
    <string>$(pwd)/logs/pipeline.log</string>
    <key>StandardErrorPath</key>
    <string>$(pwd)/logs/pipeline-error.log</string>
</dict>
</plist>
EOF

# Create logs directory
mkdir -p logs

# Load the scheduled job
launchctl load ~/Library/LaunchAgents/com.leadminer.pipeline.plist
```

#### 2.3 Create Local Web UI Startup Script
```bash
cat > scripts/local-automation/start-webui.sh << 'EOF'
#!/bin/bash
# Lead-Miner Web UI Startup Script
cd "$(dirname "$0")/../.."
echo "🌐 Starting Lead-Miner Web UI at $(date)"

# Kill any existing web UI
pkill -f "node.*web-ui-server" || true

# Start web UI
node web-ui-server.js
EOF

chmod +x scripts/local-automation/start-webui.sh
```

#### 2.4 Create Management Scripts
```bash
# Create start-all.sh
cat > scripts/local-automation/start-all.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Lead-Miner Local Environment"

# Start web UI in background
./scripts/local-automation/start-webui.sh &

# Enable scheduled pipeline
launchctl load ~/Library/LaunchAgents/com.leadminer.pipeline.plist 2>/dev/null || echo "Already loaded"

echo "✅ Local environment started"
echo "📊 Web UI: http://localhost:3000"
echo "⏰ Pipeline scheduled every 4 hours"
EOF

# Create stop-all.sh
cat > scripts/local-automation/stop-all.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping Lead-Miner Local Environment"

# Stop web UI
pkill -f "node.*web-ui-server" || true

# Disable scheduled pipeline
launchctl unload ~/Library/LaunchAgents/com.leadminer.pipeline.plist 2>/dev/null || echo "Already unloaded"

echo "✅ Local environment stopped"
EOF

chmod +x scripts/local-automation/start-all.sh scripts/local-automation/stop-all.sh
```

### **Phase 3: Local Optimization** (20 minutes)

#### 3.1 Configure Local Environment
```bash
# Update .env for local optimization
cat >> .env << 'EOF'

# Local Configuration
NODE_ENV=local
LOCAL_MODE=true
WEB_UI_PORT=3000
LOG_LEVEL=info
EOF
```

#### 3.2 Create Local Docker Setup (Optional)
```bash
# Create docker-compose.local.yml
cat > docker-compose.local.yml << 'EOF'
version: '3.8'
services:
  lead-miner:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=local
    restart: unless-stopped
EOF

# Create local Dockerfile optimization
cat > Dockerfile.local << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "web-ui-server.js"]
EOF
```

#### 3.3 Set Up Local Monitoring
```bash
# Create simple monitoring script
cat > scripts/local-automation/monitor.sh << 'EOF'
#!/bin/bash
# Simple local monitoring
LOG_FILE="logs/monitoring.log"

echo "$(date): Checking Lead-Miner services" >> $LOG_FILE

# Check if web UI is running
if pgrep -f "node.*web-ui-server" > /dev/null; then
    echo "$(date): ✅ Web UI running" >> $LOG_FILE
else
    echo "$(date): ❌ Web UI not running" >> $LOG_FILE
fi

# Check scheduled job status
if launchctl list | grep com.leadminer.pipeline > /dev/null; then
    echo "$(date): ✅ Pipeline scheduled" >> $LOG_FILE
else
    echo "$(date): ❌ Pipeline not scheduled" >> $LOG_FILE
fi

# Check last pipeline run
if [ -f "logs/pipeline.log" ]; then
    LAST_RUN=$(tail -1 logs/pipeline.log)
    echo "$(date): Last pipeline run: $LAST_RUN" >> $LOG_FILE
fi
EOF

chmod +x scripts/local-automation/monitor.sh
```

### **Phase 4: Testing & Validation** (15 minutes)

#### 4.1 Test Local Pipeline
```bash
# Test manual pipeline run
./scripts/local-automation/run-pipeline.sh

# Verify output
ls -la data/
tail -20 logs/pipeline.log
```

#### 4.2 Test Web UI
```bash
# Start web UI
./scripts/local-automation/start-webui.sh &

# Wait for startup
sleep 5

# Test web UI accessibility
curl -s http://localhost:3000 | grep -q "Lead-Miner" && echo "✅ Web UI accessible" || echo "❌ Web UI failed"
```

#### 4.3 Test Automation
```bash
# Test scheduled job
launchctl list | grep com.leadminer.pipeline

# Test monitoring
./scripts/local-automation/monitor.sh
cat logs/monitoring.log
```

### **Phase 5: Droplet Decommission** (10 minutes)

#### 5.1 Final Data Backup (if needed)
```bash
# Only if there's any data on droplet you need
# ssh root@24.199.125.35 "tar -czf /tmp/final-backup.tar.gz /root/LeadMinerv1/data"
# scp root@24.199.125.35:/tmp/final-backup.tar.gz backups/droplet-migration/
```

#### 5.2 Droplet Shutdown
```bash
# Droplet is already shut down from previous session
# Verify it's offline
ssh -o ConnectTimeout=5 root@24.199.125.35 "echo 'Still up'" || echo "✅ Droplet offline"
```

#### 5.3 DigitalOcean Cleanup
- Log into DigitalOcean dashboard
- Navigate to Droplets
- Delete the droplet: `leadminer-production`
- Verify billing stops

---

## 🚀 Quick Start Commands

### **Start Local Environment**
```bash
./scripts/local-automation/start-all.sh
```

### **Stop Local Environment**
```bash
./scripts/local-automation/stop-all.sh
```

### **Manual Pipeline Run**
```bash
./scripts/local-automation/run-pipeline.sh
```

### **Check Status**
```bash
./scripts/local-automation/monitor.sh
cat logs/monitoring.log
```

---

## 📊 Monitoring & Maintenance

### **Daily Checks**
- Web UI accessible: http://localhost:3000
- Pipeline logs: `tail -f logs/pipeline.log`
- Error logs: `tail -f logs/pipeline-error.log`

### **Weekly Maintenance**
- Review pipeline performance
- Clean old log files
- Update dependencies: `npm update`

### **Monthly Tasks**
- Review Google Sheets output
- Optimize search queries
- Update API configurations

---

## 🔄 Rollback Plan

### **If Migration Fails**
1. **Boot droplet** from DigitalOcean dashboard
2. **SSH back in**: `ssh root@24.199.125.35`
3. **Restart services**: `cd /root/LeadMinerv1 && node web-ui-server.js`
4. **Debug local issues** while droplet runs

### **Data Recovery**
- All backups stored in `backups/droplet-migration/`
- Git history preserved with all configurations
- Environment variables backed up

---

## 📈 Success Metrics

### **Cost Savings**
- [ ] Droplet deleted from DigitalOcean
- [ ] Monthly billing reduced by $12
- [ ] Annual savings: $144

### **Functionality**
- [ ] Local pipeline runs successfully
- [ ] Web UI accessible on localhost:3000
- [ ] Scheduled execution working
- [ ] Google Sheets integration functional

### **Security**
- [ ] No public IP exposure
- [ ] All services behind home router
- [ ] No SSH key management needed

### **Operational**
- [ ] Automated scheduling working
- [ ] Monitoring script functional
- [ ] Easy start/stop commands
- [ ] Log rotation configured

---

## 🎯 Next Steps After Migration

1. **Optimize for local development**
   - Set up hot-reload for faster iteration
   - Configure IDE debugging
   - Set up local testing environment

2. **Enhance automation**
   - Add email notifications for pipeline completion
   - Set up Slack webhooks for alerts
   - Create dashboard for pipeline metrics

3. **Scale when needed**
   - Document requirements for future server needs
   - Plan for team collaboration features
   - Consider containerization for consistency

---

## 📞 Support & Troubleshooting

### **Common Issues**
- **Port 3000 in use**: `lsof -ti:3000 | xargs kill -9`
- **Permission denied**: `chmod +x scripts/local-automation/*.sh`
- **Launchd not loading**: Check plist syntax and paths

### **Logs Location**
- Pipeline logs: `logs/pipeline.log`
- Error logs: `logs/pipeline-error.log`
- Monitoring logs: `logs/monitoring.log`
- Web UI logs: Console output

### **Emergency Commands**
```bash
# Stop everything
./scripts/local-automation/stop-all.sh

# Kill all Node processes
pkill -f node

# Restart from scratch
./scripts/local-automation/start-all.sh
```

---

**Migration Complete! 🎉**
*Your Lead-Miner service is now running fully local, secure, and cost-effective.* 