const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

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
        .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .current-config { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #ecf0f1; padding: 15px; border-radius: 5px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .stat-label { color: #7f8c8d; font-size: 14px; }
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
                <div class="stat-number">${(config.SEARCH_STATES || '').split(',').filter(s => s.trim()).length}</div>
                <div class="stat-label">States Configured</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${(config.SEARCH_MONTHS || '').split(',').filter(s => s.trim()).length}</div>
                <div class="stat-label">Months Configured</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${config.MAX_LEADS_PER_DAY || 'N/A'}</div>
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
                    <label>Search States (Current: ${config.SEARCH_STATES || 'None'})</label>
                    <div class="checkbox-group">
                        ${['CA', 'NY', 'TX', 'FL', 'WA', 'MA', 'PA', 'IL', 'OH', 'GA', 'CO', 'NC', 'AZ', 'TN', 'IN', 'MO', 'MD', 'WI', 'MN', 'LA'].map(state => `
                            <div class="checkbox-item">
                                <input type="checkbox" id="state_${state}" name="states" value="${state}" ${(config.SEARCH_STATES || '').includes(state) ? 'checked' : ''}>
                                <label for="state_${state}">${state}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="section">
                <h3>📅 Temporal Configuration</h3>
                <div class="form-group">
                    <label>Search Months (Current: ${config.SEARCH_MONTHS || 'None'})</label>
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
                <h3>⚙️ Performance Settings</h3>
                <div class="form-group">
                    <label>Max Leads Per Day</label>
                    <input type="number" name="MAX_LEADS_PER_DAY" value="${config.MAX_LEADS_PER_DAY || 10}" min="1" max="100">
                </div>
                <div class="form-group">
                    <label>Max Search Queries</label>
                    <input type="number" name="MAX_SEARCH_QUERIES" value="${config.MAX_SEARCH_QUERIES || 50}" min="10" max="500">
                </div>
                <div class="form-group">
                    <label>Confidence Threshold</label>
                    <input type="number" name="CONFIDENCE_THRESHOLD" value="${config.CONFIDENCE_THRESHOLD || 0.85}" min="0.1" max="1.0" step="0.05">
                </div>
            </div>

            <div class="section">
                <h3>💰 Cost Management</h3>
                <div class="form-group">
                    <label>Daily Cost Threshold ($)</label>
                    <input type="number" name="COST_THRESHOLD_DAILY" value="${config.COST_THRESHOLD_DAILY || 10}" min="1" max="1000" step="0.01">
                </div>
                <div class="form-group">
                    <label>Monthly Cost Threshold ($)</label>
                    <input type="number" name="COST_THRESHOLD_MONTHLY" value="${config.COST_THRESHOLD_MONTHLY || 100}" min="10" max="10000" step="0.01">
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
        document.getElementById('configForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const config = {};
            
            // Handle checkboxes
            const states = Array.from(document.querySelectorAll('input[name="states"]:checked')).map(cb => cb.value);
            const months = Array.from(document.querySelectorAll('input[name="months"]:checked')).map(cb => cb.value);
            const quarters = Array.from(document.querySelectorAll('input[name="quarters"]:checked')).map(cb => cb.value);
            
            config.SEARCH_STATES = states.join(',');
            config.SEARCH_MONTHS = months.join(',');
            config.SEARCH_QUARTERS = quarters.join(',');
            
            // Handle other inputs
            for (let [key, value] of formData.entries()) {
                if (!['states', 'months', 'quarters'].includes(key)) {
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
                showStatus(\`Status: \${result.status}, Uptime: \${Math.floor(result.uptime)}s\`, 'success');
            } catch (error) {
                showStatus('Error checking status: ' + error.message, 'error');
            }
        }

        function resetToDefaults() {
            if (confirm('Reset to default configuration? This will overwrite current settings.')) {
                location.href = '/config/reset';
            }
        }

        function testConfiguration() {
            showStatus('Testing configuration...', 'success');
            // Add configuration validation logic here
        }
    </script>
</body>
</html>`;
}

// Simple web server with UI
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.url === '/' || req.url === '/config') {
    // Configuration UI
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(generateConfigUI());
    
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
    
  } else if (req.url === '/run' && req.method === 'POST') {
    // Run pipeline
    const child = spawn('node', ['dist/production-app.js', '--once'], {
      cwd: '/opt/leadminer',
      stdio: 'pipe'
    });
    
    let output = '';
    child.stdout.on('data', (data) => output += data.toString());
    child.stderr.on('data', (data) => output += data.toString());
    
    child.on('close', (code) => {
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