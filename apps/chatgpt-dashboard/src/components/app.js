/**
 * CortexDx ChatGPT Control Panel - Client Application
 * 
 * WCAG 2.2 AA compliant dashboard client with:
 * - Keyboard navigation
 * - Screen reader announcements
 * - Focus management
 * - MCP v2025-03-26 support (Streamable HTTP + WebSocket)
 */

/**
 * @typedef {import('../types').HealthStatus} HealthStatus
 * @typedef {import('../types').LogEntry} LogEntry
 * @typedef {import('../types').TraceSpan} TraceSpan
 * @typedef {import('../types').MetricsSnapshot} MetricsSnapshot
 * @typedef {import('../types').AgentRun} AgentRun
 * @typedef {import('../types').DashboardTab} DashboardTab
 */

class DashboardClient {
  constructor() {
    /** @type {string} */
    this.baseUrl = window.location.origin;
    /** @type {string} */
    this.sessionId = `dashboard-${Date.now()}`;
    /** @type {WebSocket|null} */
    this.ws = null;
    /** @type {EventSource|null} */
    this.eventSource = null;
    /** @type {boolean} */
    this.useWebSocket = false;
    /** @type {NodeJS.Timeout|null} */
    this.autoRefreshTimer = null;
    /** @type {DashboardTab} */
    this.currentTab = 'health';
    
    this.init();
  }

  init() {
    this.setupTabs();
    this.setupControls();
    this.setupForms();
    this.connectTransport();
    this.loadInitialData();
    this.setupAutoRefresh();
  }

  /**
   * Announce message to screen readers
   * @param {string} message 
   * @param {'polite'|'assertive'} priority 
   */
  announce(message, priority = 'polite') {
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.setAttribute('aria-live', priority);
      announcer.textContent = message;
      // Clear after announcement
      setTimeout(() => { announcer.textContent = ''; }, 1000);
    }
  }

  /**
   * Setup tab navigation with proper ARIA and keyboard support
   */
  setupTabs() {
    const tabs = document.querySelectorAll('[role="tab"]');

    for (const tab of tabs) {
      tab.addEventListener('click', () => this.selectTab(tab.id.replace('tab-', '')));
      
      // Keyboard navigation
      tab.addEventListener('keydown', (e) => {
        const tabsArray = Array.from(tabs);
        const index = tabsArray.indexOf(tab);
        
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp': {
            e.preventDefault();
            const prevIndex = index === 0 ? tabsArray.length - 1 : index - 1;
            this.selectTab(tabsArray[prevIndex].id.replace('tab-', ''));
            tabsArray[prevIndex].focus();
            break;
          }
          case 'ArrowRight':
          case 'ArrowDown': {
            e.preventDefault();
            const nextIndex = index === tabsArray.length - 1 ? 0 : index + 1;
            this.selectTab(tabsArray[nextIndex].id.replace('tab-', ''));
            tabsArray[nextIndex].focus();
            break;
          }
          case 'Home':
            e.preventDefault();
            this.selectTab(tabsArray[0].id.replace('tab-', ''));
            tabsArray[0].focus();
            break;
          case 'End':
            e.preventDefault();
            this.selectTab(tabsArray[tabsArray.length - 1].id.replace('tab-', ''));
            tabsArray[tabsArray.length - 1].focus();
            break;
        }
      });
    }
  }

  /**
   * Select a tab and show its panel
   * @param {DashboardTab} tabId 
   */
  selectTab(tabId) {
    this.currentTab = tabId;
    
    // Update tab states
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const isSelected = tab.id === `tab-${tabId}`;
      tab.setAttribute('aria-selected', isSelected.toString());
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');
    }
    
    // Update panel visibility
    for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
      const isActive = panel.id === `panel-${tabId}`;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    }
    
    // Announce tab change
    const tabNames = {
      health: 'System Health',
      logs: 'System Logs',
      traces: 'Distributed Traces',
      metrics: 'System Metrics',
      controls: 'Agent Controls'
    };
    this.announce(`${tabNames[tabId]} panel is now active`);
    
    // Load tab-specific data
    this.loadTabData(tabId);
  }

  /**
   * Load data for the selected tab
   * @param {DashboardTab} tabId 
   */
  async loadTabData(tabId) {
    switch (tabId) {
      case 'health':
        await this.loadHealth();
        break;
      case 'logs':
        await this.loadLogs();
        break;
      case 'traces':
        await this.loadTraces();
        break;
      case 'metrics':
        await this.loadMetrics();
        break;
      case 'controls':
        await this.loadAgentRuns();
        break;
    }
  }

  /**
   * Connect to server using best available transport
   */
  async connectTransport() {
    this.updateConnectionStatus('connecting', 'Connecting...');
    
    // Try WebSocket first (bidirectional, real-time)
    try {
      await this.connectWebSocket();
      return;
    } catch {
      console.log('WebSocket unavailable, falling back to SSE');
    }
    
    // Fallback to SSE (Streamable HTTP)
    try {
      await this.connectSSE();
    } catch (error) {
      console.error('Both transports failed:', error);
      this.updateConnectionStatus('disconnected', 'Connection failed');
      this.scheduleReconnect();
    }
  }

  /**
   * Connect via WebSocket
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.baseUrl.replace('http', 'ws')}/mcp`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.useWebSocket = true;
        this.updateConnectionStatus('connected', 'Connected (WebSocket)');
        this.announce('Connected to server via WebSocket');
        
        // Send initialize message
        this.sendMessage({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            clientInfo: {
              name: 'CortexDx Dashboard',
              version: '0.1.0'
            }
          }
        });
        
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
      
      this.ws.onclose = () => {
        this.updateConnectionStatus('disconnected', 'Disconnected');
        this.announce('Disconnected from server');
        this.scheduleReconnect();
      };
    });
  }

  /**
   * Connect via Server-Sent Events (Streamable HTTP)
   */
  async connectSSE() {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.baseUrl}/events`);
      
      this.eventSource.onopen = () => {
        this.useWebSocket = false;
        this.updateConnectionStatus('connected', 'Connected (SSE)');
        this.announce('Connected to server via SSE');
        resolve();
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
      
      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.updateConnectionStatus('disconnected', 'Disconnected');
        this.scheduleReconnect();
        reject(new Error('SSE connection failed'));
      };
    });
  }

  /**
   * Handle incoming server message
   * @param {object} data 
   */
  handleServerMessage(data) {
    if (data.type === 'health') {
      this.updateHealthDisplay(data.payload);
    } else if (data.type === 'log') {
      this.appendLogEntry(data.payload);
    } else if (data.type === 'metric') {
      this.updateMetricDisplay(data.payload);
    } else if (data.type === 'trace') {
      this.appendTraceSpan(data.payload);
    } else if (data.type === 'run-update') {
      this.updateRunDisplay(data.payload);
    }
  }

  /**
   * Send message to server
   * @param {object} message 
   */
  async sendMessage(message) {
    if (this.useWebSocket && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Fallback to HTTP POST
      await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-03-26',
          'Mcp-Session-Id': this.sessionId
        },
        body: JSON.stringify(message)
      });
    }
  }

  /**
   * Update connection status UI
   * @param {'connected'|'disconnected'|'connecting'} status 
   * @param {string} text 
   */
  updateConnectionStatus(status, text) {
    const indicator = document.getElementById('connection-indicator');
    const textEl = document.getElementById('connection-text');
    
    if (indicator) {
      indicator.className = `status-dot ${status}`;
    }
    if (textEl) {
      textEl.textContent = text;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    setTimeout(() => this.connectTransport(), 5000);
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    await this.loadHealth();
  }

  /**
   * Load health data
   */
  async loadHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/api/health`);
      const data = await response.json();
      this.updateHealthDisplay(data);
    } catch (error) {
      console.error('Failed to load health:', error);
    }
  }

  /**
   * Update health display
   * @param {HealthStatus} health 
   */
  updateHealthDisplay(health) {
    const statusEl = document.getElementById('overall-status');
    if (statusEl) {
      statusEl.className = `status-badge ${health.status}`;
      statusEl.textContent = health.status.charAt(0).toUpperCase() + health.status.slice(1);
    }
    
    const uptimeEl = document.getElementById('uptime-value');
    if (uptimeEl) {
      uptimeEl.textContent = this.formatUptime(health.uptime);
    }
    
    const versionEl = document.getElementById('version-value');
    if (versionEl) {
      versionEl.textContent = health.version || '--';
    }
    
    const protocolEl = document.getElementById('protocol-value');
    if (protocolEl) {
      protocolEl.textContent = `MCP v${health.protocolVersion || '2025-03-26'}`;
    }
    
    this.updateComponentsTable(health.components || []);
  }

  /**
   * Format uptime seconds to human readable
   * @param {number} seconds 
   * @returns {string}
   */
  formatUptime(seconds) {
    if (!seconds) return '--';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /**
   * Update components health table
   * @param {Array} components 
   */
  updateComponentsTable(components) {
    const tbody = document.getElementById('components-body');
    if (!tbody) return;
    
    if (components.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No components registered</td></tr>';
      return;
    }
    
    tbody.innerHTML = components.map(comp => `
      <tr>
        <td>${this.escapeHtml(comp.name)}</td>
        <td>
          <span class="status-badge ${comp.status}">
            ${comp.status}
          </span>
        </td>
        <td>${this.formatTimestamp(comp.lastCheck)}</td>
        <td>${this.escapeHtml(comp.message || '')}</td>
      </tr>
    `).join('');
  }

  /**
   * Load logs
   */
  async loadLogs() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/api/logs?limit=100`);
      const logs = await response.json();
      this.renderLogs(logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  /**
   * Render logs
   * @param {LogEntry[]} logs 
   */
  renderLogs(logs) {
    const container = document.getElementById('logs-container');
    if (!container) return;
    
    if (!logs || logs.length === 0) {
      container.innerHTML = '<p>No log entries</p>';
      return;
    }
    
    container.innerHTML = logs.map(log => `
      <div class="log-entry" role="listitem">
        <span class="log-level ${log.level}">${log.level}</span>
        <span class="log-timestamp">${this.formatTimestamp(log.timestamp)}</span>
        <span class="log-message">${this.escapeHtml(log.message)}</span>
      </div>
    `).join('');
  }

  /**
   * Append log entry
   * @param {LogEntry} log 
   */
  appendLogEntry(log) {
    const container = document.getElementById('logs-container');
    if (!container) return;
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.setAttribute('role', 'listitem');
    entry.innerHTML = `
      <span class="log-level ${log.level}">${log.level}</span>
      <span class="log-timestamp">${this.formatTimestamp(log.timestamp)}</span>
      <span class="log-message">${this.escapeHtml(log.message)}</span>
    `;
    
    container.insertBefore(entry, container.firstChild);
    
    // Limit displayed entries
    while (container.children.length > 500) {
      container.removeChild(container.lastChild);
    }
  }

  /**
   * Load traces
   */
  async loadTraces() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/api/traces?limit=50`);
      const traces = await response.json();
      this.renderTraces(traces);
    } catch (error) {
      console.error('Failed to load traces:', error);
    }
  }

  /**
   * Render traces
   * @param {TraceSpan[]} traces 
   */
  renderTraces(traces) {
    const container = document.getElementById('traces-container');
    if (!container) return;
    
    if (!traces || traces.length === 0) {
      container.innerHTML = '<p>No trace spans</p>';
      return;
    }
    
    container.innerHTML = traces.map(span => `
      <div class="trace-span" role="listitem">
        <div class="trace-header">
          <span class="trace-name">${this.escapeHtml(span.name)}</span>
          <span class="trace-duration">${span.duration ? `${span.duration}ms` : 'running'}</span>
        </div>
        <div class="trace-ids">
          <span>Trace: ${span.traceId.slice(0, 8)}...</span>
          <span>Span: ${span.spanId.slice(0, 8)}...</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Append trace span
   * @param {TraceSpan} span 
   */
  appendTraceSpan(span) {
    const container = document.getElementById('traces-container');
    if (!container) return;
    
    const entry = document.createElement('div');
    entry.className = 'trace-span';
    entry.setAttribute('role', 'listitem');
    entry.innerHTML = `
      <div class="trace-header">
        <span class="trace-name">${this.escapeHtml(span.name)}</span>
        <span class="trace-duration">${span.duration ? `${span.duration}ms` : 'running'}</span>
      </div>
      <div class="trace-ids">
        <span>Trace: ${span.traceId.slice(0, 8)}...</span>
        <span>Span: ${span.spanId.slice(0, 8)}...</span>
      </div>
    `;
    
    container.insertBefore(entry, container.firstChild);
  }

  /**
   * Load metrics
   */
  async loadMetrics() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/api/metrics`);
      const data = await response.json();
      this.renderMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  }

  /**
   * Render metrics
   * @param {MetricsSnapshot} data 
   */
  renderMetrics(data) {
    const container = document.getElementById('metrics-container');
    if (!container) return;
    
    if (!data.metrics || data.metrics.length === 0) {
      container.innerHTML = '<p>No metrics available</p>';
      return;
    }
    
    container.innerHTML = data.metrics.map(metric => `
      <div class="metric-card">
        <h4>${this.escapeHtml(metric.name)}</h4>
        <div class="metric-value">
          ${this.formatMetricValue(metric.value)}
          <span class="metric-unit">${this.escapeHtml(metric.unit)}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update metric display
   * @param {object} metric 
   */
  updateMetricDisplay(metric) {
    // Find and update existing metric card or append new one
    const container = document.getElementById('metrics-container');
    if (!container) return;
    
    let card = container.querySelector(`[data-metric="${metric.name}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'metric-card';
      card.setAttribute('data-metric', metric.name);
      container.appendChild(card);
    }
    
    card.innerHTML = `
      <h4>${this.escapeHtml(metric.name)}</h4>
      <div class="metric-value">
        ${this.formatMetricValue(metric.value)}
        <span class="metric-unit">${this.escapeHtml(metric.unit)}</span>
      </div>
    `;
  }

  /**
   * Format metric value
   * @param {number} value 
   * @returns {string}
   */
  formatMetricValue(value) {
    if (typeof value !== 'number') return String(value);
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  }

  /**
   * Load agent runs
   */
  async loadAgentRuns() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/api/runs`);
      const runs = await response.json();
      this.renderAgentRuns(runs);
    } catch (error) {
      console.error('Failed to load runs:', error);
    }
  }

  /**
   * Render agent runs
   * @param {AgentRun[]} runs 
   */
  renderAgentRuns(runs) {
    const tbody = document.getElementById('runs-body');
    if (!tbody) return;
    
    if (!runs || runs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">No active runs</td></tr>';
      return;
    }
    
    tbody.innerHTML = runs.map(run => `
      <tr>
        <td>${run.id.slice(0, 8)}...</td>
        <td>${this.escapeHtml(run.workflow)}</td>
        <td><span class="phase-badge ${run.phase}">${run.phase}</span></td>
        <td><span class="status-badge ${run.status}">${run.status}</span></td>
        <td>
          <div class="progress-bar" role="progressbar" aria-valuenow="${run.progress || 0}" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar-fill" style="width: ${run.progress || 0}%"></div>
          </div>
        </td>
        <td>
          ${run.status === 'running' ? `
            <button type="button" class="action-btn" onclick="dashboard.pauseRun('${run.id}')" aria-label="Pause run ${run.id}">
              Pause
            </button>
          ` : ''}
          ${run.status === 'paused' ? `
            <button type="button" class="action-btn success" onclick="dashboard.resumeRun('${run.id}')" aria-label="Resume run ${run.id}">
              Resume
            </button>
          ` : ''}
          <button type="button" class="action-btn warning" onclick="dashboard.cancelRun('${run.id}')" aria-label="Cancel run ${run.id}">
            Cancel
          </button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Update run display
   * @param {AgentRun} _run 
   */
  updateRunDisplay(_run) {
    // Refresh the runs table
    this.loadAgentRuns();
  }

  /**
   * Setup control buttons
   */
  setupControls() {
    document.getElementById('action-pause-all')?.addEventListener('click', () => this.executeAction('pause'));
    document.getElementById('action-resume-all')?.addEventListener('click', () => this.executeAction('resume'));
    document.getElementById('action-drain')?.addEventListener('click', () => this.executeAction('drain'));
    
    document.getElementById('refresh-logs')?.addEventListener('click', () => this.loadLogs());
    document.getElementById('refresh-traces')?.addEventListener('click', () => this.loadTraces());
    document.getElementById('refresh-metrics')?.addEventListener('click', () => this.loadMetrics());
  }

  /**
   * Execute control action
   * @param {'pause'|'resume'|'drain'} action 
   * @param {string} [targetId] 
   */
  async executeAction(action, targetId) {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/api/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': this.sessionId
        },
        body: JSON.stringify({ action, targetId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.announce(`Action ${action} executed successfully`, 'polite');
      } else {
        this.announce(`Action ${action} failed: ${result.message}`, 'assertive');
      }
      
      // Refresh data
      this.loadAgentRuns();
    } catch (error) {
      this.announce(`Failed to execute action: ${error.message}`, 'assertive');
    }
  }

  /**
   * Pause a specific run
   * @param {string} runId 
   */
  async pauseRun(runId) {
    await this.executeAction('pause', runId);
  }

  /**
   * Resume a specific run
   * @param {string} runId 
   */
  async resumeRun(runId) {
    await this.executeAction('resume', runId);
  }

  /**
   * Cancel a specific run
   * @param {string} runId 
   */
  async cancelRun(runId) {
    await this.executeAction('cancel', runId);
  }

  /**
   * Setup forms
   */
  setupForms() {
    const testFlowForm = document.getElementById('test-flow-form');
    testFlowForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const endpoint = document.getElementById('test-endpoint')?.value;
      const workflow = document.getElementById('test-workflow')?.value;
      
      if (!endpoint || !workflow) return;
      
      await this.runTestFlow(endpoint, workflow);
    });
    
    // Log level filter
    document.getElementById('log-level-filter')?.addEventListener('change', (e) => {
      this.filterLogs(e.target.value);
    });
    
    // Log search
    document.getElementById('log-search')?.addEventListener('input', (e) => {
      this.searchLogs(e.target.value);
    });
  }

  /**
   * Run test flow
   * @param {string} endpoint 
   * @param {string} workflow 
   */
  async runTestFlow(endpoint, workflow) {
    try {
      this.announce(`Starting ${workflow} test flow...`, 'polite');
      
      const response = await fetch(`${this.baseUrl}/dashboard/api/test-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': this.sessionId
        },
        body: JSON.stringify({ endpoint, workflow })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.announce(`Test flow started: ${result.runId}`, 'polite');
        this.loadAgentRuns();
      } else {
        this.announce(`Failed to start test flow: ${result.message}`, 'assertive');
      }
    } catch (error) {
      this.announce(`Error: ${error.message}`, 'assertive');
    }
  }

  /**
   * Filter logs by level
   * @param {string} level 
   */
  filterLogs(level) {
    const entries = document.querySelectorAll('#logs-container .log-entry');
    for (const entry of entries) {
      if (level === 'all') {
        entry.style.display = '';
      } else {
        const entryLevel = entry.querySelector('.log-level')?.textContent.trim();
        entry.style.display = entryLevel === level ? '' : 'none';
      }
    }
  }

  /**
   * Search logs
   * @param {string} query 
   */
  searchLogs(query) {
    const entries = document.querySelectorAll('#logs-container .log-entry');
    const lowerQuery = query.toLowerCase();
    
    for (const entry of entries) {
      const message = entry.querySelector('.log-message')?.textContent.toLowerCase() || '';
      entry.style.display = message.includes(lowerQuery) ? '' : 'none';
    }
  }

  /**
   * Setup auto-refresh
   */
  setupAutoRefresh() {
    const checkbox = document.getElementById('auto-refresh');
    checkbox?.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    });
    
    // Start auto-refresh by default
    this.startAutoRefresh();
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => {
      this.loadTabData(this.currentTab);
    }, 5000);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  /**
   * Format timestamp
   * @param {string} timestamp 
   * @returns {string}
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str 
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  try {
    window.dashboard = new DashboardClient();
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    // Show error in the UI
    const container = document.querySelector('.dashboard-container');
    if (container) {
      container.innerHTML = `
        <div class="finding blocker" style="margin: 20px; padding: 20px;">
          <div class="finding-title">[ERROR] Dashboard Initialization Failed</div>
          <div class="finding-description">Unable to initialize the dashboard. Please refresh the page or check the console for details.</div>
        </div>
      `;
    }
  }
});
