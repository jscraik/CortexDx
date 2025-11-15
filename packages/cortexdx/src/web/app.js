// CortexDx Web Interface
import { safeParseJson } from "../utils/json.js";
class CortexDxClient {
    constructor() {
        this.baseUrl = window.location.origin;
        this.sessionId = `session-${Date.now()}`;
        this.expertiseLevel = 'intermediate';
        this.eventSource = null;
        this.init();
    }

    init() {
        this.setupTabs();
        this.setupDiagnoseForm();
        this.setupChatForm();
        this.setupPluginManagement();
        this.setupConfiguration();
        this.connectToServer();
        this.loadPlugins();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');

        for (const tab of tabs) {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                for (const t of tabs) {
                    t.classList.remove('active');
                }
                for (const tc of tabContents) {
                    tc.classList.remove('active');
                }
                
                tab.classList.add('active');
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        }
    }

    async connectToServer() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();
            
            if (data.status === 'healthy') {
                this.updateConnectionStatus(true, 'Connected');
                this.setupEventSource();
            }
        } catch (error) {
            this.updateConnectionStatus(false, 'Disconnected');
            setTimeout(() => this.connectToServer(), 5000);
        }
    }

    setupEventSource() {
        // Setup SSE for real-time updates
        this.eventSource = new EventSource(`${this.baseUrl}/events`);
        
        this.eventSource.onmessage = (event) => {
            const data = safeParseJson(event.data);
            this.handleServerEvent(data);
        };

        this.eventSource.onerror = () => {
            this.updateConnectionStatus(false, 'Connection lost');
            this.eventSource.close();
            setTimeout(() => this.connectToServer(), 5000);
        };
    }

    handleServerEvent(data) {
        // Handle real-time updates from server
        console.log('Server event:', data);
    }

    updateConnectionStatus(connected, text) {
        const indicator = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');
        
        indicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;
        statusText.textContent = text;
    }

    setupDiagnoseForm() {
        const form = document.getElementById('diagnose-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.runDiagnostics();
        });
    }

    async runDiagnostics() {
        const endpoint = document.getElementById('endpoint').value;
        const suitesSelect = document.getElementById('suites');
        const suites = Array.from(suitesSelect.selectedOptions).map(opt => opt.value);
        const full = document.getElementById('full-scan').checked;
        const resultsPanel = document.getElementById('diagnose-results');

        resultsPanel.innerHTML = '<div class="loading"></div> Running diagnostics...';

        try {
            const response = await fetch(`${this.baseUrl}/mcp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': this.sessionId,
                    'X-Expertise-Level': this.expertiseLevel
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: 'tools/call',
                    params: {
                        name: 'diagnose_mcp_server',
                        arguments: { endpoint, suites, full }
                    }
                })
            });

            const data = await response.json();
            
            if (data.result) {
                this.displayDiagnosticResults(data.result);
            } else if (data.error) {
                resultsPanel.innerHTML = `<div class="finding blocker">
                    <div class="finding-title">Error</div>
                    <div class="finding-description">${data.error.message}</div>
                </div>`;
            }
        } catch (error) {
            resultsPanel.innerHTML = `<div class="finding blocker">
                <div class="finding-title">Connection Error</div>
                <div class="finding-description">${error.message}</div>
            </div>`;
        }
    }

    displayDiagnosticResults(result) {
        const resultsPanel = document.getElementById('diagnose-results');
        
        try {
            const content = result.content?.[0]?.text;
            const findings = content ? safeParseJson(content) : result;
            
            if (!findings || !findings.findings || findings.findings.length === 0) {
                resultsPanel.innerHTML = '<div class="finding info"><div class="finding-title">No Issues Found</div><div class="finding-description">The MCP server appears to be functioning correctly.</div></div>';
                return;
            }

            const html = findings.findings.map(finding => `
                <div class="finding ${finding.severity || 'info'}">
                    <div class="finding-title">[${(finding.severity || 'INFO').toUpperCase()}] ${finding.title}</div>
                    <div class="finding-description">${finding.description || finding.message || ''}</div>
                    ${finding.recommendation ? `<div class="finding-description"><strong>Recommendation:</strong> ${finding.recommendation}</div>` : ''}
                </div>
            `).join('');

            resultsPanel.innerHTML = html;
        } catch (error) {
            resultsPanel.innerHTML = `<pre>${JSON.stringify(result, null, 2)}</pre>`;
        }
    }

    setupChatForm() {
        const form = document.getElementById('chat-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.sendChatMessage();
        });
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        this.addChatMessage('user', message);
        input.value = '';

        try {
            const response = await fetch(`${this.baseUrl}/mcp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': this.sessionId,
                    'X-Expertise-Level': this.expertiseLevel
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: 'tools/call',
                    params: {
                        name: 'continue_conversation',
                        arguments: {
                            sessionId: this.sessionId,
                            userInput: message
                        }
                    }
                })
            });

            const data = await response.json();
            
            if (data.result) {
                const content = data.result.content?.[0]?.text;
                const responseData = content ? safeParseJson(content) : data.result;
                this.addChatMessage('assistant', responseData.response || responseData.message || JSON.stringify(responseData));
            } else if (data.error) {
                this.addChatMessage('assistant', `Error: ${data.error.message}`);
            }
        } catch (error) {
            this.addChatMessage('assistant', `Connection error: ${error.message}`);
        }
    }

    addChatMessage(role, content) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    setupPluginManagement() {
        const refreshBtn = document.getElementById('refresh-plugins');
        refreshBtn.addEventListener('click', () => this.loadPlugins());

        const searchInput = document.getElementById('plugin-search');
        searchInput.addEventListener('input', (e) => this.filterPlugins(e.target.value));
    }

    async loadPlugins() {
        const pluginsList = document.getElementById('plugins-list');
        pluginsList.innerHTML = '<div class="loading"></div> Loading plugins...';

        try {
            const response = await fetch(`${this.baseUrl}/providers`);
            const data = await response.json();
            
            this.displayPlugins(data.providers);
        } catch (error) {
            pluginsList.innerHTML = `<div class="finding blocker">Failed to load plugins: ${error.message}</div>`;
        }
    }

    displayPlugins(providers) {
        const pluginsList = document.getElementById('plugins-list');
        
        if (!providers || Object.keys(providers).length === 0) {
            pluginsList.innerHTML = '<p>No plugins available</p>';
            return;
        }

        const html = Object.entries(providers).map(([id, provider]) => `
            <div class="plugin-card" data-plugin-id="${id}">
                <h4>${provider.name || id}</h4>
                <p>${provider.description || 'No description available'}</p>
                <div>
                    <span class="plugin-status enabled">Enabled</span>
                    <span style="margin-left: 8px; font-size: 12px; color: var(--text-secondary);">
                        ${provider.capabilities?.tools?.length || 0} tools
                    </span>
                </div>
            </div>
        `).join('');

        pluginsList.innerHTML = html;
    }

    filterPlugins(query) {
        const cards = document.querySelectorAll('.plugin-card');
        const lowerQuery = query.toLowerCase();

        for (const card of cards) {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(lowerQuery) ? 'block' : 'none';
        }
    }

    setupConfiguration() {
        const saveBtn = document.getElementById('save-config');
        saveBtn.addEventListener('click', () => this.saveConfiguration());

        // Load saved configuration
        this.loadConfiguration();
    }

    loadConfiguration() {
        const saved = localStorage.getItem('cortexdx-config');
        if (saved) {
            const config = safeParseJson(saved);
            document.getElementById('llm-backend').value = config.llmBackend || 'ollama';
            document.getElementById('llm-model').value = config.llmModel || 'llama3';
            document.getElementById('expertise-level').value = config.expertiseLevel || 'intermediate';
            this.expertiseLevel = config.expertiseLevel || 'intermediate';
        }
    }

    saveConfiguration() {
        const config = {
            llmBackend: document.getElementById('llm-backend').value,
            llmModel: document.getElementById('llm-model').value,
            expertiseLevel: document.getElementById('expertise-level').value
        };

        this.expertiseLevel = config.expertiseLevel;
        localStorage.setItem('cortexdx-config', JSON.stringify(config));
        
        alert('Configuration saved successfully!');
    }
}

// Initialize the client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cortexDxClient = new CortexDxClient();
});
