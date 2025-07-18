const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

// Pipeline execution tracking
let pipelineStatus = {
  isRunning: false,
  currentPhase: 'idle',
  progress: 0,
  startTime: null,
  logs: [],
  stats: {
    searchQueries: 0,
    scrapedPages: 0,
    classifiedItems: 0,
    verifiedNonprofits: 0,
    finalLeads: 0,
    errors: 0
  },
  lastExecution: null
};

// Add log entry
function addLog(level, message, phase = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    phase,
    id: Date.now() + Math.random()
  };
  
  pipelineStatus.logs.unshift(logEntry);
  
  // Keep only last 100 logs
  if (pipelineStatus.logs.length > 100) {
    pipelineStatus.logs = pipelineStatus.logs.slice(0, 100);
  }
  
  console.log(`[${level.toUpperCase()}] ${phase ? `[${phase}] ` : ''}${message}`);
}

// Read current .env configuration
function readEnvConfig() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const config = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    });
    
    return config;
  } catch (error) {
    console.error('Error reading .env file:', error);
    return {};
  }
}

// Update .env configuration
function updateEnvConfig(updates) {
  try {
    let envContent = fs.readFileSync('.env', 'utf8');
    
    Object.keys(updates).forEach(key => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}=${updates[key]}`;
      
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        envContent += `\n${newLine}`;
      }
    });
    
    fs.writeFileSync('.env', envContent);
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    return false;
  }
}

// Generate HTML for monitoring dashboard
function generateMonitoringDashboard() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead-Miner Pipeline Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { margin: 0; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .status-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status-card h3 { margin: 0 0 10px 0; color: #2c3e50; }
        .status-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
        .status-running { color: #27ae60; }
        .status-idle { color: #7f8c8d; }
        .status-error { color: #e74c3c; }
        .progress-bar { width: 100%; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; background: #3498db; transition: width 0.3s ease; }
        .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .logs-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .log-entry { padding: 8px 12px; margin: 5px 0; border-radius: 4px; font-family: monospace; font-size: 12px; }
        .log-info { background: #e8f5e8; border-left: 4px solid #27ae60; }
        .log-error { background: #fdf2f2; border-left: 4px solid #e74c3c; }
        .log-warn { background: #fff8e1; border-left: 4px solid #f39c12; }
        .log-debug { background: #f8f9fa; border-left: 4px solid #6c757d; }
        .controls { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #3498db; color: white; }
        .btn-success { background: #27ae60; color: white; }
        .btn-danger { background: #e74c3c; color: white; }
        .btn-secondary { background: #95a5a6; color: white; }
        .btn:hover { opacity: 0.8; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .phase-indicator { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .phase-idle { background: #ecf0f1; color: #2c3e50; }
        .phase-running { background: #3498db; color: white; }
        .phase-complete { background: #27ae60; color: white; }
        .auto-refresh { color: #7f8c8d; font-size: 12px; margin-top: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 15px 0; }
        .stat-item { text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .stat-number { font-size: 20px; font-weight: bold; color: #2c3e50; }
        .stat-label { font-size: 12px; color: #7f8c8d; }
        .log-timestamp { color: #7f8c8d; font-size: 10px; }
        .log-phase { color: #3498db; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Lead-Miner Pipeline Monitor</h1>
            <p>Real-time monitoring of lead generation pipeline execution</p>
        </div>

        <div class="controls">
            <button class="btn btn-success" onclick="startPipeline()" id="startBtn">▶️ Start Pipeline</button>
            <button class="btn btn-danger" onclick="stopPipeline()" id="stopBtn" disabled>⏹️ Stop Pipeline</button>
            <button class="btn btn-secondary" onclick="clearLogs()">🗑️ Clear Logs</button>
            <button class="btn btn-primary" onclick="refreshStatus()">🔄 Refresh</button>
            <button class="btn btn-secondary" onclick="window.location.href='/config'">⚙️ Configuration</button>
        </div>

        <div class="status-grid">
            <div class="status-card">
                <h3>Pipeline Status</h3>
                <div class="status-value" id="pipelineStatus">Loading...</div>
                <div class="phase-indicator" id="currentPhase">idle</div>
            </div>
            <div class="status-card">
                <h3>Progress</h3>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                </div>
                <div id="progressText">0%</div>
            </div>
            <div class="status-card">
                <h3>Execution Time</h3>
                <div class="status-value" id="executionTime">-</div>
            </div>
            <div class="status-card">
                <h3>Last Run</h3>
                <div class="status-value" id="lastExecution">Never</div>
            </div>
        </div>

        <div class="two-column">
            <div class="logs-section">
                <h3>📋 Pipeline Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number" id="searchQueries">0</div>
                        <div class="stat-label">Search Queries</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="scrapedPages">0</div>
                        <div class="stat-label">Scraped Pages</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="classifiedItems">0</div>
                        <div class="stat-label">Classified Items</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="verifiedNonprofits">0</div>
                        <div class="stat-label">Verified Nonprofits</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="finalLeads">0</div>
                        <div class="stat-label">Final Leads</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="errors">0</div>
                        <div class="stat-label">Errors</div>
                    </div>
                </div>
            </div>

            <div class="logs-section">
                <h3>📊 Real-time Logs</h3>
                <div id="logContainer" style="height: 400px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                    <div class="log-entry log-info">Pipeline monitoring initialized</div>
                </div>
                <div class="auto-refresh">Auto-refreshing every 2 seconds</div>
            </div>
        </div>
    </div>

    <script>
        let refreshInterval;
        let isRefreshing = false;

        // Start auto-refresh
        function startAutoRefresh() {
            if (refreshInterval) clearInterval(refreshInterval);
            refreshInterval = setInterval(refreshStatus, 2000);
        }

        // Stop auto-refresh
        function stopAutoRefresh() {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        }

        // Refresh status
        async function refreshStatus() {
            if (isRefreshing) return;
            isRefreshing = true;

            try {
                const response = await fetch('/pipeline-status');
                const data = await response.json();
                updateUI(data);
            } catch (error) {
                console.error('Error refreshing status:', error);
            } finally {
                isRefreshing = false;
            }
        }

        // Update UI with status data
        function updateUI(data) {
            // Update status
            const statusElement = document.getElementById('pipelineStatus');
            const phaseElement = document.getElementById('currentPhase');
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');

            if (data.isRunning) {
                statusElement.textContent = 'Running';
                statusElement.className = 'status-value status-running';
                phaseElement.textContent = data.currentPhase;
                phaseElement.className = 'phase-indicator phase-running';
                startBtn.disabled = true;
                stopBtn.disabled = false;
            } else {
                statusElement.textContent = 'Idle';
                statusElement.className = 'status-value status-idle';
                phaseElement.textContent = 'idle';
                phaseElement.className = 'phase-indicator phase-idle';
                startBtn.disabled = false;
                stopBtn.disabled = true;
            }

            // Update progress
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const progress = Math.round(data.progress * 100);
            progressFill.style.width = progress + '%';
            progressText.textContent = progress + '%';

            // Update execution time
            const executionTime = document.getElementById('executionTime');
            if (data.startTime) {
                const elapsed = Math.floor((Date.now() - new Date(data.startTime).getTime()) / 1000);
                executionTime.textContent = formatTime(elapsed);
            } else {
                executionTime.textContent = '-';
            }

            // Update last execution
            const lastExecution = document.getElementById('lastExecution');
            if (data.lastExecution) {
                lastExecution.textContent = new Date(data.lastExecution).toLocaleString();
            }

            // Update stats
            document.getElementById('searchQueries').textContent = data.stats.searchQueries;
            document.getElementById('scrapedPages').textContent = data.stats.scrapedPages;
            document.getElementById('classifiedItems').textContent = data.stats.classifiedItems;
            document.getElementById('verifiedNonprofits').textContent = data.stats.verifiedNonprofits;
            document.getElementById('finalLeads').textContent = data.stats.finalLeads;
            document.getElementById('errors').textContent = data.stats.errors;

            // Update logs
            updateLogs(data.logs);
        }

        // Update logs display
        function updateLogs(logs) {
            const logContainer = document.getElementById('logContainer');
            const shouldScrollToBottom = logContainer.scrollTop + logContainer.clientHeight >= logContainer.scrollHeight - 10;

            logContainer.innerHTML = logs.map(log => {
                const logClass = 'log-' + log.level;
                const timestamp = new Date(log.timestamp).toLocaleTimeString();
                const phase = log.phase ? '<span class="log-phase">[' + log.phase + ']</span> ' : '';
                return '<div class="log-entry ' + logClass + '">' +
                       '<span class="log-timestamp">' + timestamp + '</span> ' +
                       phase + log.message + '</div>';
            }).join('');

            if (shouldScrollToBottom) {
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        }

        // Format time in seconds to readable format
        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return mins > 0 ? mins + 'm ' + secs + 's' : secs + 's';
        }

        // Start pipeline
        async function startPipeline() {
            try {
                const response = await fetch('/run', { method: 'POST' });
                const result = await response.json();
                if (result.status === 'started') {
                    refreshStatus();
                }
            } catch (error) {
                alert('Error starting pipeline: ' + error.message);
            }
        }

        // Stop pipeline (placeholder)
        async function stopPipeline() {
            alert('Pipeline stopping not implemented yet');
        }

        // Clear logs
        async function clearLogs() {
            try {
                await fetch('/clear-logs', { method: 'POST' });
                refreshStatus();
            } catch (error) {
                alert('Error clearing logs: ' + error.message);
            }
        }

        // Manual refresh
        function refreshStatusManual() {
            refreshStatus();
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            refreshStatus();
            startAutoRefresh();
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', function() {
            stopAutoRefresh();
        });
    </script>
</body>
</html>`;
}

// Generate HTML for configuration UI
function generateConfigUI() {
  const config = readEnvConfig();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lead-Miner Configuration</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2c3e50; color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .section h3 { margin-top: 0; color: #2c3e50; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .checkbox-group { display: flex; flex-wrap: wrap; gap: 10px; }
        .checkbox-item { display: flex; align-items: center; margin-right: 15px; }
        .checkbox-item input { width: auto; margin-right: 5px; }
        button { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #2980b9; }
        .danger { background: #e74c3c; }
        .danger:hover { background: #c0392b; }
        .success { background: #27ae60; }
        .success:hover { background: #229954; }
        .secondary { background: #95a5a6; }
        .secondary:hover { background: #7f8c8d; }
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .current-config { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #ecf0f1; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .stat-label { color: #7f8c8d; font-size: 14px; }
        .select-all-container { margin: 10px 0; }
        .select-all-btn { background: #f39c12; padding: 5px 10px; font-size: 12px; }
        .select-all-btn:hover { background: #e67e22; }
        .date-range-container { display: flex; gap: 10px; align-items: center; }
        .date-range-container input { flex: 1; }
        .form-row { display: flex; gap: 15px; align-items: center; }
        .form-row > div { flex: 1; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Lead-Miner Configuration Dashboard</h1>
            <p>Manage your search parameters and system settings</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${(config.TARGET_STATES || '').split(',').filter(s => s.trim()).length}</div>
                <div class="stat-label">States Configured</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${(config.SEARCH_MONTHS || '').split(',').filter(s => s.trim()).length}</div>
                <div class="stat-label">Months Configured</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${config.MAX_LEADS_PER_DAY || 100}</div>
                <div class="stat-label">Max Leads/Day</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${config.MAX_SEARCH_QUERIES || 'N/A'}</div>
                <div class="stat-label">Max Queries</div>
            </div>
        </div>

        <form id="configForm">
            <div class="section">
                <h3>🌍 Geographic Configuration</h3>
                <div class="form-group">
                    <label>Search States (Current: ${config.TARGET_STATES || 'None'})</label>
                    <div class="select-all-container">
                        <button type="button" class="select-all-btn" onclick="selectAllStates()">Select All States</button>
                        <button type="button" class="select-all-btn secondary" onclick="clearAllStates()">Clear All</button>
                    </div>
                    <div class="checkbox-group">
                        ${['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'].map(state => `
                            <div class="checkbox-item">
                                <input type="checkbox" id="state_${state}" name="states" value="${state}" ${(config.TARGET_STATES || '').includes(state) ? 'checked' : ''}>
                                <label for="state_${state}">${state}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>📅 Temporal Configuration</h3>
                <div class="form-group">
                    <label>Event Date Range</label>
                    <div class="date-range-container">
                        <div>
                            <label for="start_date">Start Date:</label>
                            <input type="date" id="start_date" name="EVENT_START_DATE" value="${config.EVENT_START_DATE || new Date().toISOString().split('T')[0]}">
                        </div>
                        <div>
                            <label for="end_date">End Date:</label>
                            <input type="date" id="end_date" name="EVENT_END_DATE" value="${config.EVENT_END_DATE || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]}">
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Search Months (Current: ${config.SEARCH_MONTHS || 'None'})</label>
                    <div class="select-all-container">
                        <button type="button" class="select-all-btn" onclick="selectAllMonths()">Select All Months</button>
                        <button type="button" class="select-all-btn secondary" onclick="clearAllMonths()">Clear All</button>
                    </div>
                    <div class="checkbox-group">
                        ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => `
                            <div class="checkbox-item">
                                <input type="checkbox" id="month_${month}" name="months" value="${month}" ${(config.SEARCH_MONTHS || '').includes(month) ? 'checked' : ''}>
                                <label for="month_${month}">${month}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Search Quarters</label>
                    <div class="select-all-container">
                        <button type="button" class="select-all-btn" onclick="selectAllQuarters()">Select All Quarters</button>
                        <button type="button" class="select-all-btn secondary" onclick="clearAllQuarters()">Clear All</button>
                    </div>
                    <div class="checkbox-group">
                        ${['Q1', 'Q2', 'Q3', 'Q4'].map(quarter => `
                            <div class="checkbox-item">
                                <input type="checkbox" id="quarter_${quarter}" name="quarters" value="${quarter}" ${(config.SEARCH_QUARTERS || '').includes(quarter) ? 'checked' : ''}>
                                <label for="quarter_${quarter}">${quarter}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>🎯 Search Categories</h3>
                <div class="form-group">
                    <label>Organization Types</label>
                    <div class="select-all-container">
                        <button type="button" class="select-all-btn" onclick="selectAllOrgTypes()">Select All Types</button>
                        <button type="button" class="select-all-btn secondary" onclick="clearAllOrgTypes()">Clear All</button>
                    </div>
                    <div class="checkbox-group">
                        ${['Hospitals', 'Schools', 'Museums', 'Churches', 'Nonprofits', 'Foundations', 'Charities', 'Universities', 'Arts Organizations', 'Healthcare'].map(type => `
                            <div class="checkbox-item">
                                <input type="checkbox" id="org_${type.replace(/\s+/g, '_')}" name="org_types" value="${type}" ${(config.ORG_TYPES || '').includes(type) ? 'checked' : ''}>
                                <label for="org_${type.replace(/\s+/g, '_')}">${type}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Event Types</label>
                    <div class="select-all-container">
                        <button type="button" class="select-all-btn" onclick="selectAllEventTypes()">Select All Events</button>
                        <button type="button" class="select-all-btn secondary" onclick="clearAllEventTypes()">Clear All</button>
                    </div>
                    <div class="checkbox-group">
                        ${['Auctions', 'Galas', 'Fundraisers', 'Raffles', 'Benefits', 'Silent Auctions', 'Travel Auctions', 'Charity Events'].map(type => `
                            <div class="checkbox-item">
                                <input type="checkbox" id="event_${type.replace(/\s+/g, '_')}" name="event_types" value="${type}" ${(config.EVENT_TYPES || '').includes(type) ? 'checked' : ''}>
                                <label for="event_${type.replace(/\s+/g, '_')}">${type}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>⚙️ Performance Settings</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Max Leads Per Day</label>
                        <input type="number" name="MAX_LEADS_PER_DAY" value="${config.MAX_LEADS_PER_DAY || 100}" min="1" max="500">
                </div>
                <div class="form-group">
                    <label>Max Search Queries</label>
                    <input type="number" name="MAX_SEARCH_QUERIES" value="${config.MAX_SEARCH_QUERIES || 50}" min="10" max="500">
                    </div>
                </div>
                <div class="form-row">
                <div class="form-group">
                    <label>Confidence Threshold</label>
                    <input type="number" name="CONFIDENCE_THRESHOLD" value="${config.CONFIDENCE_THRESHOLD || 0.85}" min="0.1" max="1.0" step="0.05">
                    </div>
                    <div class="form-group">
                        <label>Minimum Future Days</label>
                        <input type="number" name="MIN_FUTURE_DAYS" value="${config.MIN_FUTURE_DAYS || 14}" min="1" max="365">
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>💰 Cost Management</h3>
                <div class="form-row">
                <div class="form-group">
                    <label>Daily Cost Threshold ($)</label>
                    <input type="number" name="COST_THRESHOLD_DAILY" value="${config.COST_THRESHOLD_DAILY || 10}" min="1" max="1000" step="0.01">
                </div>
                <div class="form-group">
                    <label>Monthly Cost Threshold ($)</label>
                    <input type="number" name="COST_THRESHOLD_MONTHLY" value="${config.COST_THRESHOLD_MONTHLY || 100}" min="10" max="10000" step="0.01">
                    </div>
                </div>
            </div>

            <div class="section">
                <button type="submit" class="success">💾 Save Configuration</button>
                <button type="button" onclick="resetToDefaults()" class="danger">🔄 Reset to Defaults</button>
                <button type="button" onclick="testConfiguration()">🧪 Test Configuration</button>
            </div>
        </form>

        <div class="section">
            <h3>🚀 Actions</h3>
            <button onclick="runPipeline()" class="success">▶️ Run Pipeline</button>
            <button onclick="viewLogs()">📋 View Logs</button>
            <button onclick="checkStatus()">📊 Check Status</button>
        </div>

        <div id="status"></div>
    </div>

    <script>
        // Select All Functions
        function selectAllStates() {
            document.querySelectorAll('input[name="states"]').forEach(cb => cb.checked = true);
        }
        function clearAllStates() {
            document.querySelectorAll('input[name="states"]').forEach(cb => cb.checked = false);
        }
        function selectAllMonths() {
            document.querySelectorAll('input[name="months"]').forEach(cb => cb.checked = true);
        }
        function clearAllMonths() {
            document.querySelectorAll('input[name="months"]').forEach(cb => cb.checked = false);
        }
        function selectAllQuarters() {
            document.querySelectorAll('input[name="quarters"]').forEach(cb => cb.checked = true);
        }
        function clearAllQuarters() {
            document.querySelectorAll('input[name="quarters"]').forEach(cb => cb.checked = false);
        }
        function selectAllOrgTypes() {
            document.querySelectorAll('input[name="org_types"]').forEach(cb => cb.checked = true);
        }
        function clearAllOrgTypes() {
            document.querySelectorAll('input[name="org_types"]').forEach(cb => cb.checked = false);
        }
        function selectAllEventTypes() {
            document.querySelectorAll('input[name="event_types"]').forEach(cb => cb.checked = true);
        }
        function clearAllEventTypes() {
            document.querySelectorAll('input[name="event_types"]').forEach(cb => cb.checked = false);
        }

        // Form submission
        document.getElementById('configForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const config = {};
            
            // Handle checkboxes
            const states = Array.from(document.querySelectorAll('input[name="states"]:checked')).map(cb => cb.value);
            const months = Array.from(document.querySelectorAll('input[name="months"]:checked')).map(cb => cb.value);
            const quarters = Array.from(document.querySelectorAll('input[name="quarters"]:checked')).map(cb => cb.value);
            const orgTypes = Array.from(document.querySelectorAll('input[name="org_types"]:checked')).map(cb => cb.value);
            const eventTypes = Array.from(document.querySelectorAll('input[name="event_types"]:checked')).map(cb => cb.value);
            
            config.TARGET_STATES = states.join(',');
            config.SEARCH_MONTHS = months.join(',');
            config.SEARCH_QUARTERS = quarters.join(',');
            config.ORG_TYPES = orgTypes.join(',');
            config.EVENT_TYPES = eventTypes.join(',');
            
            // Handle other inputs
            for (let [key, value] of formData.entries()) {
                if (!['states', 'months', 'quarters', 'org_types', 'event_types'].includes(key)) {
                    config[key] = value;
                }
            }
            
            try {
                const response = await fetch('/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                });
                
                const result = await response.json();
                showStatus(result.success ? 'Configuration saved successfully!' : 'Error saving configuration', result.success ? 'success' : 'error');
                
                if (result.success) {
                    setTimeout(() => location.reload(), 1500);
                }
            } catch (error) {
                showStatus('Error saving configuration: ' + error.message, 'error');
            }
        });

        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = \`<div class="status \${type}">\${message}</div>\`;
            setTimeout(() => statusDiv.innerHTML = '', 5000);
        }

        async function runPipeline() {
            showStatus('Starting pipeline execution...', 'success');
            try {
                const response = await fetch('/run', { method: 'POST' });
                const result = await response.json();
                showStatus('Pipeline executed: ' + result.status, result.status === 'success' ? 'success' : 'error');
            } catch (error) {
                showStatus('Error running pipeline: ' + error.message, 'error');
            }
        }

        async function checkStatus() {
            try {
                const response = await fetch('/status');
                const result = await response.json();
                showStatus('System status: ' + result.status, 'success');
            } catch (error) {
                showStatus('Error checking status: ' + error.message, 'error');
            }
        }

        function viewLogs() {
            window.open('/', '_blank');
        }

        function resetToDefaults() {
            if (confirm('Are you sure you want to reset all settings to defaults?')) {
                // Reset to default values
                document.querySelector('input[name="MAX_LEADS_PER_DAY"]').value = '100';
                document.querySelector('input[name="MAX_SEARCH_QUERIES"]').value = '50';
                document.querySelector('input[name="CONFIDENCE_THRESHOLD"]').value = '0.85';
                document.querySelector('input[name="MIN_FUTURE_DAYS"]').value = '14';
                document.querySelector('input[name="COST_THRESHOLD_DAILY"]').value = '10';
                document.querySelector('input[name="COST_THRESHOLD_MONTHLY"]').value = '100';
                
                // Clear all checkboxes
                clearAllStates();
                clearAllMonths();
                clearAllQuarters();
                clearAllOrgTypes();
                clearAllEventTypes();
                
                // Set default dates
                const today = new Date().toISOString().split('T')[0];
                const nextYear = new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
                document.getElementById('start_date').value = today;
                document.getElementById('end_date').value = nextYear;
                
                showStatus('Configuration reset to defaults', 'success');
            }
        }

        function testConfiguration() {
            const states = Array.from(document.querySelectorAll('input[name="states"]:checked')).length;
            const months = Array.from(document.querySelectorAll('input[name="months"]:checked')).length;
            const orgTypes = Array.from(document.querySelectorAll('input[name="org_types"]:checked')).length;
            const eventTypes = Array.from(document.querySelectorAll('input[name="event_types"]:checked')).length;
            
            let message = \`Configuration Test Results:\\n\`;
            message += \`- States selected: \${states}\\n\`;
            message += \`- Months selected: \${months}\\n\`;
            message += \`- Organization types: \${orgTypes}\\n\`;
            message += \`- Event types: \${eventTypes}\\n\`;
            message += \`- Max leads: \${document.querySelector('input[name="MAX_LEADS_PER_DAY"]').value}\\n\`;
            
            if (states === 0) message += '\\n⚠️ Warning: No states selected!';
            if (months === 0) message += '\\n⚠️ Warning: No months selected!';
            if (orgTypes === 0) message += '\\n⚠️ Warning: No organization types selected!';
            if (eventTypes === 0) message += '\\n⚠️ Warning: No event types selected!';
            
            alert(message);
        }

        // Set default date range on page load
        document.addEventListener('DOMContentLoaded', function() {
            const startDate = document.getElementById('start_date');
            const endDate = document.getElementById('end_date');
            
            if (!startDate.value) {
                startDate.value = new Date().toISOString().split('T')[0];
            }
            if (!endDate.value) {
                endDate.value = new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
            }
        });
    </script>
</body>
</html>
  `;
}

// Simple web server with UI
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.url === '/') {
    // Main dashboard - monitoring
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(generateMonitoringDashboard());
    
  } else if (req.url === '/config' && req.method === 'POST') {
    // Update configuration
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const success = updateEnvConfig(updates);
        
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ success, message: success ? 'Configuration updated' : 'Update failed' }));
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    
  } else if (req.url === '/config') {
    // Configuration UI
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(generateConfigUI());
    
  } else if (req.url === '/health') {
    // Health check
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Lead-Miner Agent',
      version: '1.0.0'
    }));
    
  } else if (req.url === '/status') {
    // Status endpoint
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      status: 'running',
      timestamp: new Date().toISOString(),
      service: 'Lead-Miner Agent',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: readEnvConfig()
    }));
    
  } else if (req.url === '/pipeline-status') {
    // Pipeline status endpoint
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(pipelineStatus));
    
  } else if (req.url === '/clear-logs' && req.method === 'POST') {
    // Clear logs endpoint
    pipelineStatus.logs = [];
    addLog('info', 'Logs cleared by user');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true }));
    
  } else if (req.url === '/run' && req.method === 'POST') {
    // Run pipeline
    if (pipelineStatus.isRunning) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      res.end(JSON.stringify({
        status: 'error',
        message: 'Pipeline is already running'
      }));
      return;
    }
    
    // Update pipeline status
    pipelineStatus.isRunning = true;
    pipelineStatus.currentPhase = 'starting';
    pipelineStatus.progress = 0;
    pipelineStatus.startTime = new Date().toISOString();
    pipelineStatus.stats = {
      searchQueries: 0,
      scrapedPages: 0,
      classifiedItems: 0,
      verifiedNonprofits: 0,
      finalLeads: 0,
      errors: 0
    };
    
    addLog('info', 'Pipeline execution started', 'system');
    
    const child = spawn('node', ['dist/production-app.js', '--once'], {
      cwd: '/root/LeadMinerv1',
      stdio: 'pipe'
    });
    
    let output = '';
    
    // Monitor output for progress updates
    child.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      
      // Parse progress from output
      if (dataStr.includes('Phase 1:')) {
        pipelineStatus.currentPhase = 'search-queries';
        pipelineStatus.progress = 0.2;
        addLog('info', 'Generating search queries', 'search');
      } else if (dataStr.includes('Phase 2:')) {
        pipelineStatus.currentPhase = 'scraping';
        pipelineStatus.progress = 0.4;
        addLog('info', 'Scraping web content', 'scraping');
      } else if (dataStr.includes('Phase 3:')) {
        pipelineStatus.currentPhase = 'classification';
        pipelineStatus.progress = 0.6;
        addLog('info', 'Classifying content', 'classification');
      } else if (dataStr.includes('Phase 4:')) {
        pipelineStatus.currentPhase = 'final-leads';
        pipelineStatus.progress = 0.8;
        addLog('info', 'Creating final leads', 'leads');
      }
      
      // Extract stats from output
      const queryMatch = dataStr.match(/Generated (\d+) search queries/);
      if (queryMatch) {
        pipelineStatus.stats.searchQueries = parseInt(queryMatch[1]);
      }
      
      const scrapedMatch = dataStr.match(/Scraped (\d+) pages/);
      if (scrapedMatch) {
        pipelineStatus.stats.scrapedPages = parseInt(scrapedMatch[1]);
      }
      
      const classifiedMatch = dataStr.match(/Classified (\d+) items/);
      if (classifiedMatch) {
        pipelineStatus.stats.classifiedItems = parseInt(classifiedMatch[1]);
      }
      
      const leadsMatch = dataStr.match(/Created (\d+) final leads/);
      if (leadsMatch) {
        pipelineStatus.stats.finalLeads = parseInt(leadsMatch[1]);
      }
    });
    
    child.stderr.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      addLog('error', dataStr.trim(), pipelineStatus.currentPhase);
      pipelineStatus.stats.errors++;
    });
    
    child.on('close', (code) => {
      pipelineStatus.isRunning = false;
      pipelineStatus.progress = 1.0;
      pipelineStatus.currentPhase = 'complete';
      pipelineStatus.lastExecution = new Date().toISOString();
      
      if (code === 0) {
        addLog('info', 'Pipeline execution completed successfully', 'system');
      } else {
        addLog('error', `Pipeline execution failed with code ${code}`, 'system');
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: code === 0 ? 'success' : 'error',
        exitCode: code,
        output: output,
        timestamp: new Date().toISOString()
      }));
    });
    
  } else {
    // 404
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Lead-Miner Configuration UI running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/`);
  console.log(`🔧 Configuration: http://localhost:${PORT}/config`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  
  // Initialize pipeline status
  addLog('info', 'Lead-Miner monitoring system started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Web server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Web server closed.');
    process.exit(0);
  });
}); 