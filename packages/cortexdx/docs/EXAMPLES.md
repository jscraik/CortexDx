# CortexDx Examples

Complete, real-world walkthroughs for common CortexDx use cases. Each example is self-contained and includes all prerequisites, commands, and expected output.

📖 **New to CortexDx?** See the [Glossary](GLOSSARY.md) for definitions of technical terms.

---

## Table of Contents

- [Example 1: Your First MCP Diagnostic](#example-1-your-first-mcp-diagnostic) - ⏱️ 5 minutes
- [Example 2: Debugging SSE Connection Issues](#example-2-debugging-sse-connection-issues) - ⏱️ 10 minutes
- [Example 3: Security Audit Before Production](#example-3-security-audit-before-production) - ⏱️ 15 minutes
- [Example 4: Setting Up Continuous Monitoring](#example-4-setting-up-continuous-monitoring) - ⏱️ 20 minutes
- [Example 5: Researching MCP Best Practices](#example-5-researching-mcp-best-practices) - ⏱️ 10 minutes
- [Example 6: Fixing Protocol Compliance Issues](#example-6-fixing-protocol-compliance-issues) - ⏱️ 15 minutes

---

## Example 1: Your First MCP Diagnostic

**⏱️ Time:** 5 minutes
**📊 Level:** 🟢 Beginner
**💡 Goal:** Run a basic diagnostic and understand the output

### Prerequisites

- **Node.js** 20.0.0 or higher installed
- An MCP server running locally or remotely
- No API keys required for this example

### Verify Prerequisites

```bash
# Check Node.js version (should show v20.x.x or higher)
node --version

# Verify your MCP server is running (example for local server)
curl http://localhost:3000/health
# Expected: Some response (200 OK, JSON, or HTML)
```

### Step 1: Install CortexDx

**Option A: Use npx (no installation required)**

```bash
npx @brainwav/cortexdx --version
```

**Option B: Install globally**

```bash
npm install -g @brainwav/cortexdx
cortexdx --version
```

**Expected Output:**
```
1.0.0
```

### Step 2: Run Your First Diagnostic

```bash
cortexdx diagnose http://localhost:3000
```

**Expected Output:**

```
[brAInwav] CortexDx Diagnostic Report
🔍 Analyzing: http://localhost:3000
⚡ Duration: 1.8s

✅ [INFO] MCP server responding (200 OK)
✅ [INFO] JSON-RPC (Remote Procedure Call) endpoint available
⚠️  [MAJOR] SSE (Server-Sent Events) endpoint not configured
ℹ️  [MINOR] No rate limiting detected

📊 Reports generated:
  • reports/cortexdx-report.md (human-readable)
  • reports/cortexdx-findings.json (machine-readable)

🎯 Next steps: Review reports for detailed findings
```

### Step 3: Understand the Output

**Severity Levels:**

- ✅ **INFO** - Everything working correctly
- ℹ️ **MINOR** - Nice-to-have improvements
- ⚠️ **MAJOR** - Important issues to fix
- 🚨 **BLOCKER** - Critical issues preventing functionality

**Exit Codes:**

- **0** - No blockers or majors (safe to deploy)
- **1** - Blocker issues found (must fix before deploying)
- **2** - Major issues found (should fix before deploying)

### Step 4: Review the Detailed Report

```bash
# View the human-readable report
cat reports/cortexdx-report.md

# Or view in your editor
code reports/cortexdx-report.md  # VS Code
vim reports/cortexdx-report.md   # Vim
```

### Step 5: View Machine-Readable Findings

```bash
# Pretty-print the JSON findings
cat reports/cortexdx-findings.json | jq '.'

# Count major issues
cat reports/cortexdx-findings.json | jq '.findings[] | select(.severity == "major") | length'

# List all blocker issues
cat reports/cortexdx-findings.json | jq '.findings[] | select(.severity == "blocker")'
```

### What You Learned

- ✅ How to install and run CortexDx
- ✅ How to interpret diagnostic output
- ✅ Where to find detailed reports
- ✅ How to filter findings by severity

### Next Steps

- Try [Example 2](#example-2-debugging-sse-connection-issues) to fix the SSE warning
- Run a full diagnostic with `cortexdx diagnose http://localhost:3000 --full`
- Explore the [CLI Commands Reference](../README.md#️-cli-commands-reference)

---

## Example 2: Debugging SSE Connection Issues

**⏱️ Time:** 10 minutes
**📊 Level:** 🟡 Intermediate
**💡 Goal:** Diagnose and fix Server-Sent Events (SSE) configuration problems

### The Problem

You ran a diagnostic and saw:

```
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
```

Your MCP clients can't receive real-time updates from the server.

### Prerequisites

- Completed [Example 1](#example-1-your-first-mcp-diagnostic)
- Access to your MCP server code
- Basic understanding of HTTP endpoints

### Step 1: Run Targeted SSE Diagnostic

Focus on streaming issues only:

```bash
cortexdx diagnose http://localhost:3000 --suites streaming --out sse-debug
```

**Expected Output:**

```
⚠️  [MAJOR] SSE endpoint not streaming (HTTP 502)
  Evidence:
    - Tried: http://localhost:3000/events (502 Bad Gateway)
    - Tried: http://localhost:3000/sse (404 Not Found)

  Recommendation: Implement SSE endpoint at /events with proper headers
```

### Step 2: Review the Implementation Plan

CortexDx generates a test-driven implementation plan:

```bash
cat sse-debug/cortexdx-arctdd.md
```

**You'll see:**

```markdown
## Phase 1: Critical Issues

### Fix SSE Endpoint

**Test First (Red Phase):**
\`\`\`javascript
describe('SSE Endpoint', () => {
  test('should return correct headers', async () => {
    const response = await fetch('/events');
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });
});
\`\`\`

**Implementation (Green Phase):**
[specific code to add]
```

### Step 3: Apply the Fix

**For Express.js servers:**

Add this to your server code:

```javascript
// SSE endpoint for real-time events
app.get('/events', (req, res) => {
  // Set proper headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send keepalive every 30 seconds
  const keepalive = setInterval(() => {
    res.write('event: keepalive\ndata: {}\n\n');
  }, 30000);

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(keepalive);
  });
});
```

### Step 4: Restart and Verify

```bash
# Restart your MCP server
npm run dev

# Wait for startup, then test again
cortexdx diagnose http://localhost:3000 --suites streaming
```

**Expected Output:**

```
✅ [INFO] SSE endpoint streaming correctly
✅ [INFO] Keepalive events received
✅ [INFO] Proper headers configured

🎉 All streaming checks passed!
```

### Step 5: Test the Fix with curl

```bash
# Connect to SSE endpoint
curl -N http://localhost:3000/events

# You should see keepalive events every 30 seconds:
# event: keepalive
# data: {}
```

Press Ctrl+C to disconnect.

### What You Learned

- ✅ How to run targeted diagnostic suites
- ✅ How to read ArcTDD (Architecture Test-Driven Development) implementation plans
- ✅ How to implement SSE endpoints correctly
- ✅ How to verify fixes with CortexDx

### Troubleshooting

**Still seeing 502 errors?**

Check if your reverse proxy (nginx, Cloudflare, etc.) is configured for streaming:

```nginx
# nginx configuration
location /events {
    proxy_pass http://localhost:3000;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
    proxy_buffering off;
    proxy_cache off;
}
```

---

## Example 3: Security Audit Before Production

**⏱️ Time:** 15 minutes
**📊 Level:** 🟡 Intermediate
**💡 Goal:** Perform a comprehensive security audit and fix critical vulnerabilities

### The Scenario

You're about to deploy your MCP server to production. You need to ensure it meets security best practices.

### Prerequisites

- MCP server code access
- Understanding of CORS (Cross-Origin Resource Sharing), authentication, and rate limiting
- 15 minutes of uninterrupted time

### Step 1: Run Comprehensive Security Scan

```bash
cortexdx diagnose https://staging.yourapp.com \
  --suites security,cors,auth,ratelimit,threat-model \
  --out security-audit \
  --har
```

**Flags Explained:**

- `--suites security,cors,auth,ratelimit,threat-model` - Run all security-related checks
- `--out security-audit` - Save results to security-audit directory
- `--har` - Capture HTTP Archive file for detailed network analysis

### Step 2: Review Security Findings

```bash
# View findings summary
cat security-audit/cortexdx-findings.json | jq '.findings[] | select(.area == "security") | {severity, title}'
```

**Example Output:**

```json
{
  "severity": "blocker",
  "title": "No authentication required for sensitive endpoints"
}
{
  "severity": "major",
  "title": "CORS wildcard origin allows any domain"
}
{
  "severity": "major",
  "title": "No rate limiting on API endpoints"
}
{
  "severity": "minor",
  "title": "Missing security headers (HSTS, CSP)"
}
```

### Step 3: Prioritize Fixes

**Exit code 1 (Blocker)** - Fix immediately:
- Authentication issues
- Exposed credentials
- SQL injection vulnerabilities

**Exit code 2 (Major)** - Fix before production:
- CORS misconfigurations
- Missing rate limiting
- Weak session management

**Exit code 0 (Minor)** - Fix when time permits:
- Missing security headers
- Incomplete input validation
- Documentation gaps

### Step 4: Fix Blocker Issue - Add Authentication

**Before (vulnerable):**

```javascript
app.post('/tools/execute', (req, res) => {
  // Anyone can execute tools!
  const result = executeTool(req.body);
  res.json(result);
});
```

**After (secure):**

```javascript
// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

// Protected endpoint
app.post('/tools/execute', authenticate, (req, res) => {
  const result = executeTool(req.body);
  res.json(result);
});
```

### Step 5: Fix Major Issue - Restrict CORS

**Before (allows any origin):**

```javascript
app.use(cors({
  origin: '*',
  credentials: true
}));
```

**After (whitelist specific origins):**

```javascript
const allowedOrigins = [
  'https://app.yourcompany.com',
  'https://dashboard.yourcompany.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false  // Safer with restricted origins
}));
```

### Step 6: Fix Major Issue - Add Rate Limiting

```bash
# Install rate limiting package
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

// Create limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false
});

// Apply to all routes
app.use('/api/', limiter);

// Stricter limit for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10
});

app.post('/tools/execute', strictLimiter, authenticate, (req, res) => {
  // ...
});
```

### Step 7: Verify All Fixes

```bash
# Run security audit again
cortexdx diagnose https://staging.yourapp.com \
  --suites security,cors,auth,ratelimit \
  --out security-audit-after

# Compare before and after
cortexdx compare \
  security-audit/cortexdx-findings.json \
  security-audit-after/cortexdx-findings.json
```

**Expected Output:**

```
Comparison Results:
  Fixed issues: 3
  New issues: 0
  Remaining issues: 1 (minor)

🎉 All blocker and major security issues resolved!
```

### Step 8: Generate Security Report for Compliance

```bash
# Generate SARIF (Static Analysis Results Interchange Format) report
cat security-audit-after/cortexdx-findings.json | \
  jq '{
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "CortexDx",
          version: "1.0.0"
        }
      },
      results: [.findings[] | select(.area == "security")]
    }]
  }' > security-report.sarif

# Upload to security dashboard or include in compliance docs
```

### What You Learned

- ✅ How to run comprehensive security audits
- ✅ How to prioritize security fixes by severity
- ✅ How to implement authentication, CORS, and rate limiting
- ✅ How to compare before/after diagnostics
- ✅ How to generate compliance reports

### Production Checklist

Before deploying, ensure:

- [ ] All blocker issues resolved (exit code 0 or 2, not 1)
- [ ] Authentication implemented on sensitive endpoints
- [ ] CORS configured with specific allowed origins
- [ ] Rate limiting active on all API routes
- [ ] Security headers configured (HSTS, CSP, X-Frame-Options)
- [ ] HTTPS enforced (no HTTP in production)
- [ ] Secrets stored in environment variables, not code
- [ ] Security audit report archived for compliance

---

## Example 4: Setting Up Continuous Monitoring

**⏱️ Time:** 20 minutes
**📊 Level:** 🔴 Advanced
**💡 Goal:** Set up automated MCP health monitoring with alerts

### The Scenario

Your MCP server is in production. You want to catch issues before users report them.

### Prerequisites

- Production MCP server
- Access to CI/CD system (GitHub Actions, GitLab CI, or cron jobs)
- Slack or email for notifications (optional)
- Understanding of bash scripts

### Architecture

```
┌─────────────────┐
│  Cron Job       │
│  (every 5 min)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CortexDx       │
│  Diagnostic     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Results        │─────▶│  Alert if    │
│  JSON + Report  │      │  Issues Found│
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  Slack/Email │
                         └──────────────┘
```

### Step 1: Create Monitoring Script

Create `monitor-mcp.sh`:

```bash
#!/bin/bash
set -e

# Configuration
MCP_ENDPOINT="https://api.yourapp.com"
REPORT_DIR="/var/log/cortexdx"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Create report directory
mkdir -p "$REPORT_DIR"

# Run diagnostic with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_DIR="$REPORT_DIR/$TIMESTAMP"

echo "Running MCP diagnostic at $(date)"
cortexdx diagnose "$MCP_ENDPOINT" \
  --suites protocol,streaming,security \
  --out "$OUTPUT_DIR" \
  --deterministic \
  --no-color

# Capture exit code
EXIT_CODE=$?

# Parse results
FINDINGS_FILE="$OUTPUT_DIR/cortexdx-findings.json"
BLOCKER_COUNT=$(jq '[.findings[] | select(.severity == "blocker")] | length' "$FINDINGS_FILE")
MAJOR_COUNT=$(jq '[.findings[] | select(.severity == "major")] | length' "$FINDINGS_FILE")

# Determine alert level
if [ "$EXIT_CODE" -eq 1 ]; then
  ALERT_LEVEL="🚨 CRITICAL"
  ALERT_COLOR="danger"
  MESSAGE="MCP Server has $BLOCKER_COUNT blocker issue(s)"
elif [ "$EXIT_CODE" -eq 2 ]; then
  ALERT_LEVEL="⚠️  WARNING"
  ALERT_COLOR="warning"
  MESSAGE="MCP Server has $MAJOR_COUNT major issue(s)"
else
  ALERT_LEVEL="✅ HEALTHY"
  ALERT_COLOR="good"
  MESSAGE="MCP Server passing all checks"
fi

# Send Slack notification
if [ "$EXIT_CODE" -ne 0 ] || [ "$SEND_ALL_ALERTS" = "true" ]; then
  curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-Type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"$ALERT_COLOR\",
        \"title\": \"MCP Health Check\",
        \"text\": \"$ALERT_LEVEL - $MESSAGE\",
        \"fields\": [
          {\"title\": \"Endpoint\", \"value\": \"$MCP_ENDPOINT\", \"short\": true},
          {\"title\": \"Blockers\", \"value\": \"$BLOCKER_COUNT\", \"short\": true},
          {\"title\": \"Majors\", \"value\": \"$MAJOR_COUNT\", \"short\": true},
          {\"title\": \"Time\", \"value\": \"$(date)\", \"short\": true}
        ],
        \"footer\": \"CortexDx Monitoring\"
      }]
    }"
fi

# Keep only last 7 days of reports
find "$REPORT_DIR" -type d -mtime +7 -exec rm -rf {} +

echo "Monitoring check complete. Exit code: $EXIT_CODE"
exit $EXIT_CODE
```

### Step 2: Make Script Executable

```bash
chmod +x monitor-mcp.sh

# Test it
./monitor-mcp.sh
```

### Step 3: Set Up Cron Job

```bash
# Edit crontab
crontab -e

# Add monitoring job (runs every 5 minutes)
*/5 * * * * /path/to/monitor-mcp.sh >> /var/log/cortexdx/monitor.log 2>&1

# Or for hourly checks
0 * * * * /path/to/monitor-mcp.sh >> /var/log/cortexdx/monitor.log 2>&1
```

### Step 4: Set Up GitHub Actions Monitoring

Create `.github/workflows/mcp-health-check.yml`:

```yaml
name: MCP Health Check

on:
  schedule:
    # Run every 15 minutes
    - cron: '*/15 * * * *'
  workflow_dispatch:  # Allow manual triggering

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run MCP Diagnostic
        run: |
          npx @brainwav/cortexdx diagnose ${{ secrets.MCP_ENDPOINT }} \
            --suites protocol,streaming,security \
            --out reports \
            --deterministic \
            --no-color
        continue-on-error: true
        id: diagnostic

      - name: Parse Results
        id: parse
        run: |
          BLOCKER_COUNT=$(jq '.findings[] | select(.severity == "blocker") | length' reports/cortexdx-findings.json)
          MAJOR_COUNT=$(jq '.findings[] | select(.severity == "major") | length' reports/cortexdx-findings.json)
          echo "blockers=$BLOCKER_COUNT" >> $GITHUB_OUTPUT
          echo "majors=$MAJOR_COUNT" >> $GITHUB_OUTPUT

      - name: Create Issue if Problems Found
        if: steps.diagnostic.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            const blockers = '${{ steps.parse.outputs.blockers }}';
            const majors = '${{ steps.parse.outputs.majors }}';

            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `🚨 MCP Health Check Failed - ${blockers} blockers, ${majors} majors`,
              body: `MCP health check detected issues:\n\n- Blockers: ${blockers}\n- Majors: ${majors}\n\nSee workflow run for details.`,
              labels: ['mcp-health', 'urgent']
            });

      - name: Upload Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mcp-health-reports-${{ github.run_number }}
          path: reports/
          retention-days: 7
```

### Step 5: Set Up Grafana Dashboard

**Export metrics to Prometheus:**

Modify monitoring script to export metrics:

```bash
# Add to monitor-mcp.sh
cat > /var/lib/node_exporter/textfile_collector/mcp_health.prom <<EOF
# HELP mcp_blocker_count Number of blocker issues
# TYPE mcp_blocker_count gauge
mcp_blocker_count $BLOCKER_COUNT

# HELP mcp_major_count Number of major issues
# TYPE mcp_major_count gauge
mcp_major_count $MAJOR_COUNT

# HELP mcp_health_check_status Health check status (0=healthy, 1=blocker, 2=major)
# TYPE mcp_health_check_status gauge
mcp_health_check_status $EXIT_CODE
EOF
```

**Create Grafana dashboard:**

1. Add Prometheus data source
2. Create new dashboard
3. Add panels with these queries:

```promql
# MCP Health Status
mcp_health_check_status

# Blocker Issues Over Time
rate(mcp_blocker_count[5m])

# Major Issues Over Time
rate(mcp_major_count[5m])
```

### Step 6: Test Alert System

```bash
# Temporarily break your MCP server to trigger alert
# For example, stop the SSE endpoint

# Wait for next monitoring run (up to 5 minutes)

# Check Slack for alert
# Check GitHub issues for created issue
```

### Step 7: View Monitoring History

```bash
# View recent checks
tail -f /var/log/cortexdx/monitor.log

# Count failures in last 24 hours
grep "Exit code: [12]" /var/log/cortexdx/monitor.log | \
  grep "$(date +%Y-%m-%d)" | wc -l

# Generate weekly summary
for day in {0..6}; do
  DATE=$(date -d "$day days ago" +%Y-%m-%d)
  COUNT=$(grep "Exit code: 0" /var/log/cortexdx/monitor.log | grep "$DATE" | wc -l)
  TOTAL=$(grep "Exit code:" /var/log/cortexdx/monitor.log | grep "$DATE" | wc -l)
  echo "$DATE: $COUNT/$TOTAL checks passed"
done
```

### What You Learned

- ✅ How to create automated monitoring scripts
- ✅ How to set up cron jobs for periodic checks
- ✅ How to integrate with GitHub Actions
- ✅ How to send alerts to Slack
- ✅ How to export metrics to Grafana
- ✅ How to track health over time

### Best Practices

1. **Start with longer intervals** (15-30 minutes) and adjust based on needs
2. **Alert on sustained issues**, not transient blips (e.g., 2+ failures in a row)
3. **Keep historical data** for trend analysis (7-30 days)
4. **Test your alerts** monthly to ensure they work
5. **Document escalation procedures** for different severity levels

---

## Example 5: Researching MCP Best Practices

**⏱️ Time:** 10 minutes
**📊 Level:** 🟡 Intermediate
**💡 Goal:** Use academic research to validate your MCP implementation

### The Scenario

You're implementing WebSocket reconnection logic but aren't sure about the best approach. You want to see what academic research says about connection resilience.

### Prerequisites

- 1Password CLI installed (`brew install 1password-cli`)
- `.env` file with research provider API keys
- Basic understanding of academic research

### Step 1: Set Up Research Environment

Create `.env` file:

```bash
# Required for some providers
OPENALEX_CONTACT_EMAIL=your.email@company.com
EXA_API_KEY=your-exa-api-key

# Optional providers
CONTEXT7_API_KEY=your-context7-key
VIBE_CHECK_HTTP_URL=https://vibe-check.example.com
```

### Step 2: Run Research Query

```bash
op run --env-file=.env -- cortexdx research "WebSocket reconnection strategies" \
  --question "What are best practices for handling WebSocket disconnections in real-time systems?" \
  --providers openalex,arxiv,wikidata \
  --limit 10 \
  --out reports/research
```

**Command Breakdown:**

- `op run --env-file=.env` - Load secrets from 1Password-managed `.env`
- `cortexdx research` - Research CLI command
- `"WebSocket reconnection strategies"` - Main search topic
- `--question` - Specific question to answer
- `--providers openalex,arxiv,wikidata` - Free providers (no API keys needed except email)
- `--limit 10` - Get top 10 results
- `--out reports/research` - Save results here

### Step 3: Review Research Results

```bash
# View research summary
cat reports/research/research-summary.md
```

**Example Output:**

```markdown
# Research Summary: WebSocket Reconnection Strategies

## Key Findings

### 1. Exponential Backoff (OpenAlex - Cited 234 times)

**Source:** "Resilient WebSocket Connections in Distributed Systems"
**Authors:** Zhang et al. (2023)
**Key Points:**
- Use exponential backoff with jitter: delay = baseDelay * (2^attemptNumber) + randomJitter
- Prevents thundering herd problem when many clients reconnect simultaneously
- Typical baseDelay: 1000ms, maxDelay: 30000ms

### 2. Connection State Management (arXiv preprint)

**Source:** "State Synchronization in Real-Time WebSocket Applications"
**Authors:** Kumar & Patel (2024)
**Key Points:**
- Maintain connection state machine: CONNECTING → OPEN → CLOSING → CLOSED
- Buffer messages during reconnection
- Replay missed messages after reconnection

### 3. Heartbeat Mechanisms (Wikidata)

**Concept:** WebSocket ping/pong frames
**Purpose:** Detect dead connections before timeout
**Implementation:**
- Client sends ping every 30-60 seconds
- Server responds with pong
- Close connection if no pong received after 2 consecutive pings
```

### Step 4: Apply Research to Your Code

**Based on the research, implement reconnection logic:**

```javascript
class ResilientWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.attemptNumber = 0;
    this.messageBuffer = [];
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Connected');
      this.attemptNumber = 0;  // Reset on successful connection
      this.flushMessageBuffer();
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      console.log('Disconnected');
      this.stopHeartbeat();
      this.scheduleReconnection();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  // Exponential backoff with jitter (from research)
  scheduleReconnection() {
    this.attemptNumber++;
    const exponentialDelay = this.baseDelay * Math.pow(2, this.attemptNumber);
    const jitter = Math.random() * 1000;  // 0-1000ms jitter
    const delay = Math.min(exponentialDelay + jitter, this.maxDelay);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.attemptNumber})`);
    setTimeout(() => this.connect(), delay);
  }

  // Heartbeat mechanism (from research)
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);  // Every 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  // Buffer messages during disconnection (from research)
  send(message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      console.log('Connection not open, buffering message');
      this.messageBuffer.push(message);
    }
  }

  flushMessageBuffer() {
    while (this.messageBuffer.length > 0) {
      const message = this.messageBuffer.shift();
      this.ws.send(message);
    }
  }
}
```

### Step 5: Validate Implementation

```bash
# Test reconnection logic
cortexdx diagnose http://localhost:3000 --suites streaming

# Verify WebSocket behavior
cortexdx debug "WebSocket reconnection not working" \
  --code ./resilient-websocket.js \
  --expertise expert
```

### Step 6: Create Research Report for Team

```bash
# Generate team-friendly research summary
cat > WEBSOCKET_RESEARCH.md <<EOF
# WebSocket Reconnection Research Summary

## Question
How should we handle WebSocket disconnections in our MCP server?

## Research Findings

### Recommended Approach
Use exponential backoff with jitter + heartbeat mechanism

### Implementation
See \`resilient-websocket.js\` for complete implementation

### Academic Sources
- Zhang et al. (2023): "Resilient WebSocket Connections" - 234 citations
- Kumar & Patel (2024): "State Synchronization" - arXiv preprint

### Why This Matters
- Prevents server overload during mass reconnections
- Detects dead connections quickly
- Ensures message delivery reliability

## Testing Checklist
- [ ] Exponential backoff delays increase correctly
- [ ] Jitter prevents thundering herd
- [ ] Messages buffered during disconnection
- [ ] Heartbeats sent every 30 seconds
- [ ] Dead connections detected within 60 seconds

Generated: $(date)
Source: CortexDx Academic Research CLI
EOF

# Share with team
git add WEBSOCKET_RESEARCH.md
git commit -m "Add WebSocket reconnection research"
```

### What You Learned

- ✅ How to search academic literature for MCP best practices
- ✅ How to use free research providers (OpenAlex, arXiv, Wikidata)
- ✅ How to translate research into working code
- ✅ How to document research for your team
- ✅ How to validate implementations against research

### Research Tips

1. **Start broad, then narrow:** Search general topic, then add specific questions
2. **Use free providers first:** OpenAlex, arXiv, and Wikidata don't require API keys
3. **Check citation counts:** Higher citations = more validated research
4. **Read preprints carefully:** arXiv papers may not be peer-reviewed yet
5. **Combine multiple sources:** Cross-reference findings across providers

---

## Example 6: Fixing Protocol Compliance Issues

**⏱️ Time:** 15 minutes
**📊 Level:** 🟡 Intermediate
**💡 Goal:** Ensure your MCP server fully complies with the protocol specification

### The Problem

You received a report that your MCP server isn't working with certain clients. A diagnostic shows:

```
🚨 [BLOCKER] Initialize method returns invalid response
⚠️  [MAJOR] Missing required protocol version field
⚠️  [MAJOR] Tool list method not implemented correctly
```

### Prerequisites

- MCP server source code access
- Understanding of JSON-RPC 2.0
- MCP protocol specification knowledge ([spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io/))

### Step 1: Run Full Protocol Compliance Check

```bash
cortexdx diagnose http://localhost:3000 \
  --suites protocol,jsonrpc,discovery \
  --full \
  --out protocol-audit
```

### Step 2: Review ArcTDD Implementation Plan

```bash
cat protocol-audit/cortexdx-arctdd.md
```

**You'll see test-first guidance:**

```markdown
### BLOCKER: Initialize Method Returns Invalid Response

**Current Behavior:**
\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "version": "1.0.0"  // Wrong field name!
  }
}
\`\`\`

**Expected Behavior (MCP Spec):**
\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",  // Correct field
    "capabilities": {},
    "serverInfo": {
      "name": "my-mcp-server",
      "version": "1.0.0"
    }
  }
}
\`\`\`

**Test First:**
[implementation tests provided]
```

### Step 3: Fix Initialize Method

**Before (non-compliant):**

```javascript
app.post('/jsonrpc', (req, res) => {
  if (req.body.method === 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        version: '1.0.0'  // Wrong!
      }
    });
  }
});
```

**After (MCP compliant):**

```javascript
app.post('/jsonrpc', (req, res) => {
  if (req.body.method === 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      result: {
        protocolVersion: '2024-11-05',  // Required by MCP spec
        capabilities: {
          tools: {},      // We support tools
          resources: {}   // We support resources
        },
        serverInfo: {
          name: 'my-mcp-server',
          version: '1.0.0'
        }
      }
    });
  }
});
```

### Step 4: Fix Tools/List Method

**Before (incorrect structure):**

```javascript
if (req.body.method === 'tools') {
  res.json({
    jsonrpc: '2.0',
    id: req.body.id,
    result: [
      { name: 'search', description: 'Search tool' }
    ]
  });
}
```

**After (correct structure per MCP spec):**

```javascript
if (req.body.method === 'tools/list') {  // Note: 'tools/list', not 'tools'
  res.json({
    jsonrpc: '2.0',
    id: req.body.id,
    result: {
      tools: [  // Wrapped in 'tools' object
        {
          name: 'search',
          description: 'Search tool',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              }
            },
            required: ['query']
          }
        }
      ]
    }
  });
}
```

### Step 5: Add Protocol Version Validation

```javascript
app.post('/jsonrpc', (req, res) => {
  // Validate MCP protocol version on initialize
  if (req.body.method === 'initialize') {
    const clientVersion = req.body.params?.protocolVersion;
    const supportedVersions = ['2024-11-05'];

    if (!clientVersion || !supportedVersions.includes(clientVersion)) {
      return res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        error: {
          code: -32602,  // Invalid params
          message: `Unsupported protocol version: ${clientVersion}. Supported: ${supportedVersions.join(', ')}`
        }
      });
    }

    // ... rest of initialize logic
  }
});
```

### Step 6: Verify All Fixes

```bash
# Run compliance check again
cortexdx diagnose http://localhost:3000 \
  --suites protocol,jsonrpc,discovery \
  --out protocol-audit-after

# Compare results
cortexdx compare \
  protocol-audit/cortexdx-findings.json \
  protocol-audit-after/cortexdx-findings.json
```

**Expected Output:**

```
✅ Fixed: 3 issues resolved
  - Initialize method now returns correct structure
  - Protocol version field present
  - Tools list method properly implemented

🎉 MCP Protocol Compliance: 100%
```

### Step 7: Test with Real MCP Clients

```bash
# Test with MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:3000

# Or test with curl
curl -X POST http://localhost:3000/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' | jq '.'
```

**Expected Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {}
    },
    "serverInfo": {
      "name": "my-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

### What You Learned

- ✅ How to diagnose MCP protocol compliance issues
- ✅ How to fix `initialize` method to match MCP spec
- ✅ How to implement `tools/list` correctly
- ✅ How to validate protocol versions
- ✅ How to test with real MCP clients

### Protocol Compliance Checklist

Before considering your server "MCP compliant":

- [ ] `initialize` method returns `protocolVersion` (not `version`)
- [ ] `initialize` includes `capabilities` object
- [ ] `initialize` includes `serverInfo` with `name` and `version`
- [ ] `tools/list` (not `tools`) returns `{ tools: [...] }`
- [ ] All tools have `name`, `description`, and `inputSchema`
- [ ] `inputSchema` follows JSON Schema format
- [ ] Protocol version validation on `initialize`
- [ ] Proper JSON-RPC 2.0 error responses
- [ ] SSE endpoint at `/events` or `/sse` (if streaming)
- [ ] Session ID handling (if using FastMCP)

---

## Additional Resources

### Documentation

- [Getting Started Guide](GETTING_STARTED.md) - Installation and first steps
- [User Guide](USER_GUIDE.md) - Comprehensive usage documentation
- [API Reference](API_REFERENCE.md) - Complete API documentation
- [Glossary](GLOSSARY.md) - Definitions of all abbreviations and terms
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

### External Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/) - Official spec
- [MCP GitHub Repository](https://github.com/modelcontextprotocol) - Reference implementations
- [MCP Community Discord](https://discord.gg/mcp) - Get help from the community

### Getting Help

If you're stuck:

1. **Check the glossary** - [GLOSSARY.md](GLOSSARY.md) explains all technical terms
2. **Search existing examples** - The examples above cover most common scenarios
3. **Run interactive debug** - `cortexdx debug "your problem here"`
4. **Check troubleshooting** - [TROUBLESHOOTING.md](TROUBLESHOOTING.md) has solutions
5. **Ask the community** - GitHub Discussions or Discord

---

*Last updated: 2025-11-17*
