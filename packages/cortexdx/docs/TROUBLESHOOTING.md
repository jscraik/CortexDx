# Troubleshooting Guide

This comprehensive guide helps you diagnose and resolve common issues when using CortexDx for Model Context Protocol (MCP) server diagnostics. The guide is organized by problem category with platform-specific solutions and debugging techniques.

📖 **[View Glossary](GLOSSARY.md)** for definitions of technical terms (MCP, SSE, CORS, JSON-RPC, etc.).

---

## Table of Contents

- [Quick Diagnostic Commands](#quick-diagnostic-commands)
- [Connection Issues](#connection-issues)
- [Protocol Issues](#protocol-issues)
- [Authentication Issues](#authentication-issues)
- [Performance Issues](#performance-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Getting Help](#getting-help)

---

## Quick Diagnostic Commands

Before diving into specific issues, try these diagnostic commands:

```bash
# Check system health and requirements
cortexdx doctor

# Run basic diagnostics with verbose output
cortexdx diagnose <endpoint> --verbose --debug

# Interactive troubleshooting assistant
cortexdx interactive

# Explain specific error messages
cortexdx explain error "<error-message>"

# Get debugging help for specific problems
cortexdx debug "<problem-description>"
```

## Connection Issues

### Server Not Responding

**Error Messages**:

- `ECONNREFUSED: Connection refused`
- `ENOTFOUND: getaddrinfo ENOTFOUND`
- `ETIMEDOUT: connect ETIMEDOUT`

**Platform-Specific Diagnostics**:

#### macOS Connection Diagnostics

```bash
# Check if server is running
lsof -i :3000
netstat -an | grep 3000

# Check firewall settings
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Test connectivity
nc -zv localhost 3000
```

#### Linux Connection Diagnostics

```bash
# Check if server is running
ss -tlnp | grep :3000
netstat -tlnp | grep :3000

# Check firewall settings
sudo ufw status
sudo iptables -L

# Test connectivity
nc -zv localhost 3000
```

#### Windows Connection Diagnostics

```powershell
# Check if server is running
netstat -an | findstr :3000

# Check firewall settings
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*3000*"}

# Test connectivity
Test-NetConnection -ComputerName localhost -Port 3000
```

**Solutions**:

1. **Verify server is running**:

   ```bash
   # Use CortexDx diagnostics
   cortexdx diagnose http://localhost:3000 --suites discovery --verbose
   
   # Test with curl
   curl -v http://localhost:3000
   ```

2. **Check correct endpoint format**:

   ```bash
   # Correct formats
   cortexdx diagnose http://localhost:3000
   cortexdx diagnose https://api.example.com/mcp
   
   # Common mistakes to avoid
   # ❌ cortexdx diagnose localhost:3000 (missing protocol)
   # ❌ cortexdx diagnose http://localhost:3000/ (trailing slash)
   ```

3. **Use interactive debugger**:

   ```bash
   cortexdx debug "Cannot connect to localhost:3000"
   ```

### SSL/TLS Errors

**Error Messages**:

- `CERT_HAS_EXPIRED: certificate has expired`
- `UNABLE_TO_VERIFY_LEAF_SIGNATURE: unable to verify the first certificate`
- `DEPTH_ZERO_SELF_SIGNED_CERT: self signed certificate`
- `CERT_UNTRUSTED: certificate not trusted`

**Platform-Specific Solutions**:

#### macOS

```bash
# Check certificate details
openssl s_client -connect example.com:443 -servername example.com

# Add certificate to keychain (if self-signed)
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem

# Use system certificate store
export SSL_CERT_FILE=/etc/ssl/cert.pem
```

#### Linux

```bash
# Check certificate details
openssl s_client -connect example.com:443 -servername example.com

# Add certificate to system store (Ubuntu/Debian)
sudo cp cert.pem /usr/local/share/ca-certificates/cert.crt
sudo update-ca-certificates

# Add certificate to system store (RHEL/CentOS)
sudo cp cert.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

#### Windows

```powershell
# Check certificate details
openssl s_client -connect example.com:443 -servername example.com

# Import certificate to trusted root store
Import-Certificate -FilePath "cert.pem" -CertStoreLocation Cert:\LocalMachine\Root
```

**Solutions**:

1. **For development environments**:

   ```bash
   # Use HTTP instead of HTTPS
   cortexdx diagnose http://localhost:3000
   
   # Skip certificate validation (development only)
   NODE_TLS_REJECT_UNAUTHORIZED=0 cortexdx diagnose https://localhost:3000
   ```

2. **Generate proper certificates**:

   ```bash
   # Generate self-signed certificate
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
     -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   
   # Generate certificate with SAN
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
     -config <(printf "[req]\ndistinguished_name=req\n[san]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n[req]\nreq_extensions=san")
   ```

3. **Use custom CA bundle**:

   ```bash
   # Specify custom CA bundle
   export NODE_EXTRA_CA_CERTS=/path/to/ca-bundle.pem
   cortexdx diagnose https://localhost:3000
   ```

### Timeout Errors

**Error Messages**:

- `ETIMEDOUT: connect ETIMEDOUT`
- `Request timeout after 5000ms`
- `Plugin execution timeout`
- `Worker thread timeout`

**Debugging Steps**:

1. **Identify timeout source**:

   ```bash
   # Run with detailed timing
   cortexdx diagnose http://localhost:3000 --verbose --debug
   
   # Check specific performance metrics
   cortexdx diagnose http://localhost:3000 --suites performance
   ```

2. **Adjust timeout settings**:

   ```bash
   # Increase overall timeout (default: 5000ms)
   cortexdx diagnose http://localhost:3000 --budget-time 30000
   
   # Increase memory budget (default: 96MB)
   cortexdx diagnose http://localhost:3000 --budget-mem 256
   ```

3. **Platform-specific network diagnostics**:

   #### macOS/Linux

   ```bash
   # Check network latency
   ping -c 4 example.com
   
   # Trace network path
   traceroute example.com
   
   # Check DNS resolution time
   dig example.com
   ```

   #### Windows

   ```powershell
   # Check network latency
   ping -n 4 example.com
   
   # Trace network path
   tracert example.com
   
   # Check DNS resolution time
   nslookup example.com
   ```

4. **Performance analysis**:

   ```bash
   # Run performance-focused diagnostics
   cortexdx best-practices http://localhost:3000 --focus performance
   
   # Generate performance report
   cortexdx diagnose http://localhost:3000 --suites performance --out performance-report
   ```

## Protocol Compliance Issues

### Invalid JSON-RPC Messages

**Error Messages**:

- `Invalid JSON-RPC 2.0 message format`
- `Missing required field: jsonrpc`
- `Invalid method name format`
- `Malformed JSON in request/response`

**Debugging Protocol Issues**:

1. **Run protocol validation**:

   ```bash
   # Comprehensive protocol compliance check
   cortexdx diagnose http://localhost:3000 --suites protocol
   
   # Check specific JSON-RPC compliance
   cortexdx diagnose http://localhost:3000 --suites jsonrpc-batch
   ```

2. **Validate message structure**:

   ```bash
   # Enable detailed protocol logging
   cortexdx diagnose http://localhost:3000 --verbose --debug --har
   
   # Check HAR file for raw request/response data
   # Output: reports/capture.har (redacted)
   ```

3. **Common JSON-RPC validation rules**:
   - **Request must have**: `jsonrpc: "2.0"`, `method`, `id` (except notifications)
   - **Response must have**: `jsonrpc: "2.0"`, (`result` OR `error`), `id`
   - **Method names**: Must follow MCP convention (e.g., `tools/list`, `resources/read`)

4. **Example valid messages**:

   **Request**:

   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/list",
     "id": 1
   }
   ```

   **Response (Success)**:

   ```json
   {
     "jsonrpc": "2.0",
     "result": {
       "tools": []
     },
     "id": 1
   }
   ```

   **Response (Error)**:

   ```json
   {
     "jsonrpc": "2.0",
     "error": {
       "code": -32601,
       "message": "Method not found"
     },
     "id": 1
   }
   ```

5. **Debug malformed JSON**:

   ```bash
   # Use interactive mode for JSON validation
   cortexdx explain error "Unexpected token } in JSON"
   
   # Validate JSON manually
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | jq .
   ```

### Protocol Version Mismatch

**Error Messages**:

- `Unsupported MCP protocol version`
- `Protocol version negotiation failed`
- `Client requires protocol version X.Y.Z`

**Solutions**:

1. **Check protocol compatibility**:

   ```bash
   # Check MCP protocol compliance
   cortexdx diagnose http://localhost:3000 --suites mcp-compatibility
   
   # Get detailed protocol information
   cortexdx diagnose http://localhost:3000 --suites discovery --verbose
   ```

2. **Supported MCP protocol versions**:
   - **Current**: `2024-11-05` (latest)
   - **Previous**: `2024-06-25`, `2024-04-15`

3. **Update server implementation**:

   ```bash
   # Generate updated server template
   cortexdx generate template my-server --lang typescript
   
   # Get migration guidance
   cortexdx best-practices --focus protocol
   ```

4. **Test version compatibility**:

   ```bash
   # Test against specific protocol version
   cortexdx diagnose http://localhost:3000 --suites protocol --verbose
   ```

## LLM Integration Issues

### LLM Backend Not Available

**Error Messages**:

- `LLM backend not available`
- `No LLM service detected`
- `Failed to connect to Ollama`
- `Model not found or not loaded`

**Platform-Specific Installation**:

#### macOS (Apple Silicon)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
```

#### macOS (Intel - Ollama Recommended)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Or via Homebrew
brew install ollama

# Start Ollama service
ollama serve &
ollama pull llama3.2:3b
```

#### Linux

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start as systemd service
sudo systemctl enable ollama
sudo systemctl start ollama

# Pull model
ollama pull llama3.2:3b
```

#### Windows

```powershell
# Download and install Ollama from https://ollama.com/download
# Or use winget
winget install Ollama.Ollama

# Pull model
ollama pull llama3.2:3b
```

**Verification and Configuration**:

1. **Check LLM availability**:

   ```bash
   # Run system diagnostics
   cortexdx doctor
   
   # Test LLM integration specifically
   cortexdx interactive
   # Then ask: "Test LLM connection"
   ```

2. **Manual configuration**:

   ```json
   // .cortexdx.json
   {
     "llm": {
       "backend": "ollama",
       "model": "llama3.2:3b",
       "endpoint": "http://localhost:11434",
       "timeout": 30000
     }
   }
   ```

   > **Note:** CortexDx now supports the Ollama backend exclusively. Remove any legacy local-backend configuration blocks to avoid startup failures.

### Slow LLM Responses

**Symptoms**:

- LLM operations taking longer than 30 seconds
- Interactive mode responses are slow
- High CPU/memory usage during LLM operations

**Performance Optimization**:

1. **Use appropriate model size**:

   ```bash
   # Lightweight models (faster, less accurate)
   ollama pull llama3.2:1b    # ~1GB RAM
   ollama pull llama3.2:3b    # ~2GB RAM
   
   # Balanced models (good speed/quality)
   ollama pull llama3.1:8b    # ~4.7GB RAM
   
   # High-quality models (slower, more accurate)
   ollama pull llama3.1:70b   # ~40GB RAM
   ```

2. **Platform-specific optimizations**:

   #### Apple Silicon

   ```bash
   # Use quantized Ollama models for better performance
   ollama pull llama3.2:1b
   ollama pull llama3.2:3b
   ```

   #### NVIDIA GPU

   ```bash
   # Check GPU availability
   nvidia-smi
   
   # Use GPU-optimized Ollama
   ollama pull llama3.2:3b
   # Ollama automatically uses GPU if available
   ```

   #### CPU-only systems

   ```bash
   # Use smallest viable model
   ollama pull llama3.2:1b
   
   # Limit concurrent operations
   {
     "llm": {
       "maxConcurrency": 1,
       "timeout": 60000
     }
   }
   ```

3. **Monitor system resources**:

   #### macOS

   ```bash
   # Monitor CPU and memory
   top -o cpu
   
   # Check memory pressure
   memory_pressure
   
   # Monitor GPU usage (Apple Silicon)
   sudo powermetrics -n 1 -i 1000 --samplers gpu_power
   ```

   #### Linux

   ```bash
   # Monitor resources
   htop
   
   # Check GPU usage (NVIDIA)
   nvidia-smi -l 1
   
   # Monitor memory
   free -h
   ```

   #### Windows

   ```powershell
   # Monitor resources
   Get-Process | Sort-Object CPU -Descending | Select-Object -First 10
   
   # Check GPU usage
   nvidia-smi
   ```

4. **Optimize configuration**:

   ```json
   {
     "llm": {
       "backend": "ollama",
       "model": "llama3.2:3b",
       "timeout": 30000,
       "maxTokens": 1024,
       "temperature": 0.1,
       "stream": true
     }
   }
   ```

### Model Loading Errors

**Error Messages**:

- `Failed to load model: model not found`
- `Model download failed`
- `Insufficient disk space for model`
- `Model file corrupted`

**Solutions**:

1. **Check available models**:

   ```bash
   # List installed models
   ollama list
   
   # Check model details
   ollama show llama3.2:3b
   ```

2. **Download models explicitly**:

   ```bash
   # Pull specific model
   ollama pull llama3.2:3b
   
   # Pull with progress
   ollama pull llama3.2:3b --verbose
   ```

3. **Platform-specific disk space checks**:

   #### macOS/Linux

   ```bash
   # Check available disk space
   df -h
   
   # Check Ollama model directory
   du -sh ~/.ollama/models
   
   # Clean up old models
   ollama rm old-model-name
   ```

   #### Windows

   ```powershell
   # Check disk space
   Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, FreeSpace, Size
   
   # Check Ollama directory
   Get-ChildItem -Path "$env:USERPROFILE\.ollama\models" -Recurse | Measure-Object -Property Length -Sum
   ```

4. **Model storage requirements**:
   - `llama3.2:1b` → ~1.3GB
   - `llama3.2:3b` → ~2.0GB  
   - `llama3.1:8b` → ~4.7GB
   - `llama3.1:70b` → ~40GB

5. **Troubleshoot corrupted models**:

   ```bash
   # Remove and re-download corrupted model
   ollama rm llama3.2:3b
   ollama pull llama3.2:3b
   
   # Verify model integrity
   ollama run llama3.2:3b "Hello, world!"
   ```

6. **Alternative model sources**:

   Use `ollama pull <model>` with community catalogs or build custom Modelfiles as described in the Ollama documentation.

## Plugin Issues

### Plugin Not Found

**Symptom**: `Plugin 'xyz' not found` errors

**Solutions**:

1. **List available plugins**:

   ```bash
   cortexdx plugins list
   ```

2. **Install plugin**:

   ```bash
   npm install @myorg/cortexdx-plugin-xyz
   ```

3. **Register plugin**:

   ```typescript
   import { registerPlugin } from '@brainwav/cortexdx';
   import { myPlugin } from './my-plugin.js';
   registerPlugin(myPlugin);
   ```

### Plugin Execution Errors

**Symptom**: Plugin crashes or returns errors

**Solutions**:

1. **Run with verbose logging**:

   ```bash
   cortexdx diagnose http://localhost:3000 --verbose --debug
   ```

2. **Test plugin individually**:

   ```bash
   cortexdx diagnose http://localhost:3000 --plugin security-scanner
   ```

3. **Check plugin logs**:

   ```bash
   tail -f ~/.cortexdx/logs/plugin-errors.log
   ```

## License Validation Issues

### License Check Failures

**Symptom**: `License validation failed` or `Proprietary content detected`

**Solutions**:

1. **Check approved licenses**:

   ```bash
   cortexdx licenses list
   ```

2. **Add license to approved list**:

   ```json
   {
     "licenses": {
       "approved": ["MIT", "Apache-2.0", "BSD-3-Clause"]
     }
   }
   ```

3. **Request approval for proprietary content**:

   ```bash
   cortexdx licenses request-approval --source "research-paper-xyz"
   ```

### Compliance Monitoring Errors

**Symptom**: Compliance reports showing violations

**Solutions**:

1. **Generate compliance report**:

   ```bash
   cortexdx compliance report --period 2024-Q1
   ```

2. **Review flagged usage**:

   ```bash
   cortexdx compliance review --flagged
   ```

3. **Update compliance policies**:

   ```json
   {
     "compliance": {
       "strictMode": false,
       "autoApprove": ["MIT", "Apache-2.0"]
     }
   }
   ```

## Performance Issues

### Slow Diagnostics

**Symptoms**:

- Diagnostic runs taking longer than 2 minutes
- High CPU usage during diagnostics
- Memory usage growing during execution

**Performance Tuning**:

1. **Optimize diagnostic scope**:

   ```bash
   # Run only essential suites
   cortexdx diagnose http://localhost:3000 --suites protocol,cors,auth
   
   # Skip resource-intensive suites
   cortexdx diagnose http://localhost:3000 --suites protocol --budget-time 10000
   
   # Quick health check
   cortexdx diagnose http://localhost:3000 --suites discovery
   ```

2. **Available diagnostic suites** (ordered by performance impact):
   - **Fast**: `discovery`, `protocol`, `cors`
   - **Medium**: `auth`, `jsonrpc-batch`, `permissioning`
   - **Slow**: `performance`, `governance`, `threat-model`
   - **Resource-intensive**: `streaming`, `sse-reconnect`

3. **Adjust resource budgets**:

   ```bash
   # Increase time budget per plugin (default: 5000ms)
   cortexdx diagnose http://localhost:3000 --budget-time 15000
   
   # Increase memory budget per plugin (default: 96MB)
   cortexdx diagnose http://localhost:3000 --budget-mem 256
   
   # Conservative settings for slow systems
   cortexdx diagnose http://localhost:3000 --budget-time 30000 --budget-mem 512
   ```

4. **Platform-specific optimizations**:

   #### macOS

   ```bash
   # Check system load
   sysctl -n vm.loadavg
   
   # Monitor memory pressure
   memory_pressure
   
   # Optimize for Apple Silicon
   cortexdx diagnose http://localhost:3000 --budget-mem 128
   ```

   #### Linux

   ```bash
   # Check system load
   uptime
   
   # Monitor memory
   free -h
   
   # Check for swap usage
   swapon --show
   ```

   #### Windows

   ```powershell
   # Check system performance
   Get-Counter "\Processor(_Total)\% Processor Time"
   
   # Check memory usage
   Get-WmiObject -Class Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
   ```

5. **Configuration for performance**:

   ```json
   // .cortexdx.json
   {
     "diagnostics": {
       "defaultSuites": ["protocol", "cors", "auth"],
       "budgets": {
         "timeMs": 10000,
         "memMb": 128
       },
       "parallel": false,
       "deterministic": true
     }
   }
   ```

### High Memory Usage

**Symptoms**:

- CortexDx consuming >1GB RAM
- System becoming unresponsive during diagnostics
- Out of memory errors

**Memory Optimization**:

1. **Reduce plugin memory budgets**:

   ```bash
   # Limit memory per plugin (default: 96MB)
   cortexdx diagnose http://localhost:3000 --budget-mem 64
   
   # Very conservative settings
   cortexdx diagnose http://localhost:3000 --budget-mem 32
   ```

2. **Optimize LLM memory usage**:

   ```json
   {
     "llm": {
       "maxHistoryLength": 5,
       "maxTokens": 512,
       "model": "llama3.2:1b"
     }
   }
   ```

3. **Platform-specific memory monitoring**:

   #### macOS

   ```bash
   # Monitor CortexDx memory usage
   ps aux | grep cortexdx
   
   # Check memory pressure
   memory_pressure
   
   # Monitor in real-time
   top -pid $(pgrep -f cortexdx)
   ```

   #### Linux

   ```bash
   # Monitor memory usage
   ps aux | grep cortexdx
   
   # Check system memory
   cat /proc/meminfo
   
   # Monitor with htop
   htop -p $(pgrep -f cortexdx)
   ```

   #### Windows

   ```powershell
   # Monitor process memory
   Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Select-Object ProcessName, WorkingSet
   
   # Monitor system memory
   Get-WmiObject -Class Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
   ```

4. **Memory-efficient configuration**:

   ```json
   {
     "diagnostics": {
       "budgets": {
         "memMb": 64
       }
     },
     "llm": {
       "maxHistoryLength": 3,
       "maxTokens": 256
     },
     "cache": {
       "enabled": false
     }
   }
   ```

5. **Garbage collection tuning**:

   ```bash
   # Force garbage collection (Node.js)
   node --expose-gc $(which cortexdx) diagnose http://localhost:3000
   
   # Increase heap size if needed
   node --max-old-space-size=2048 $(which cortexdx) diagnose http://localhost:3000
   ```

## Configuration Issues

### Invalid Configuration

**Symptom**: `Invalid configuration` errors

**Solutions**:

1. **Validate configuration**:

   ```bash
   cortexdx config validate
   ```

2. **Reset to defaults**:

   ```bash
   cortexdx config reset
   ```

3. **Example valid configuration**:

   ```json
   {
     "llm": {
       "backend": "ollama",
       "model": "llama3"
     },
     "diagnostics": {
       "suites": ["protocol", "security"],
       "severity": "medium"
     }
   }
   ```

### Configuration Not Found

**Symptom**: Using default configuration instead of custom

**Solutions**:

1. **Check configuration locations**:

   ```bash
   # Project-level
   ./.cortexdx.json
   
   # User-level
   ~/.cortexdx/config.json
   
   # System-level
   /etc/cortexdx/config.json
   ```

2. **Specify configuration explicitly**:

   ```bash
   cortexdx diagnose http://localhost:3000 --config ./my-config.json
   ```

## Advanced Debugging Techniques

### Verbose Logging and Debugging

1. **Enable comprehensive logging**:

   ```bash
   # Maximum verbosity
   cortexdx diagnose http://localhost:3000 --verbose --debug --har
   
   # Debug specific plugin
   DEBUG=cortexdx:plugin:* cortexdx diagnose http://localhost:3000
   
   # Debug network requests
   DEBUG=cortexdx:http:* cortexdx diagnose http://localhost:3000
   ```

2. **Capture network traffic**:

   ```bash
   # Enable HAR capture (HTTP Archive)
   cortexdx diagnose http://localhost:3000 --har
   
   # Output: reports/capture.har (sensitive data redacted)
   # View with: Chrome DevTools > Network > Import HAR
   ```

3. **Platform-specific debugging**:

   #### macOS

   ```bash
   # Use Console.app to view system logs
   log stream --predicate 'process == "node"'
   
   # Network debugging with tcpdump
   sudo tcpdump -i lo0 port 3000
   ```

   #### Linux

   ```bash
   # View system logs
   journalctl -f -u cortexdx
   
   # Network debugging
   sudo tcpdump -i lo port 3000
   ```

   #### Windows

   ```powershell
   # View Windows Event Log
   Get-WinEvent -LogName Application | Where-Object {$_.ProviderName -like "*Node*"}
   
   # Network debugging with netsh
   netsh trace start capture=yes tracefile=network.etl
   # ... run diagnostics ...
   netsh trace stop
   ```

### Interactive Troubleshooting

```bash
# Start interactive troubleshooting session
cortexdx interactive

# Or get help with specific problems
cortexdx debug "Server returns 500 errors"
cortexdx explain error "ECONNREFUSED"
```

**Interactive commands**:

- `"Help me debug connection issues"`
- `"Explain this error: [paste error message]"`
- `"How do I optimize performance?"`
- `"Generate a test server for debugging"`

### System Health Check

```bash
# Comprehensive system diagnostics
cortexdx doctor
```

**Doctor checks**:

- ✅ Node.js version compatibility
- ✅ LLM backend availability (Ollama)
- ✅ Network connectivity
- ✅ Plugin installation
- ✅ Configuration validity
- ✅ System requirements
- ✅ Platform-specific dependencies

### Bug Reporting

When reporting issues, include:

1. **System information**:

   ```bash
   # Generate system report
   cortexdx doctor > system-info.txt
   
   # Include Node.js and npm versions
   node --version && npm --version
   ```

2. **Reproduction steps**:

   ```bash
   # Run with maximum debugging
   cortexdx diagnose http://localhost:3000 --verbose --debug --har 2>&1 | tee debug.log
   ```

3. **Configuration and logs**:

   ```bash
   # Sanitize and include configuration
   cat .cortexdx.json | jq 'del(.auth, .secrets)'
   
   # Include relevant log files (sanitized)
   tail -100 ~/.cortexdx/logs/error.log
   ```

4. **Create GitHub issue**:
   - Visit: <https://github.com/brainwav/cortexdx/issues/new>
   - Use the bug report template
   - Include system info, logs, and reproduction steps
   - Attach HAR file if network-related (ensure sensitive data is redacted)

### Performance Profiling

```bash
# Generate performance profile
node --prof $(which cortexdx) diagnose http://localhost:3000

# Process profile (generates report)
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect $(which cortexdx) diagnose http://localhost:3000
# Then open Chrome DevTools > Memory tab
```

## Common Error Codes Reference

| Error Code | Category | Meaning | Quick Solution |
|------------|----------|---------|----------------|
| `ECONNREFUSED` | Network | Server not running or wrong port | Check server status: `lsof -i :3000` |
| `ETIMEDOUT` | Network | Request timeout | Increase timeout: `--budget-time 30000` |
| `ENOTFOUND` | Network | DNS resolution failed | Verify endpoint URL format |
| `EADDRINUSE` | Network | Port already in use | Find process: `lsof -i :3000` and kill it |
| `CERT_HAS_EXPIRED` | TLS | SSL certificate expired | Use HTTP or renew certificate |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | TLS | Self-signed certificate | Add to trust store or use `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| `DEPTH_ZERO_SELF_SIGNED_CERT` | TLS | Self-signed certificate | Add certificate to system trust store |
| `ERR_INVALID_PROTOCOL` | MCP | Wrong MCP protocol version | Update server to latest MCP protocol |
| `ERR_LLM_NOT_AVAILABLE` | LLM | No LLM backend detected | Install Ollama: `curl -fsSL https://ollama.com/install.sh \| sh` |
| `ERR_PLUGIN_TIMEOUT` | Plugin | Plugin execution timeout | Increase budget: `--budget-time 15000` |
| `ERR_PLUGIN_MEMORY` | Plugin | Plugin memory limit exceeded | Increase budget: `--budget-mem 256` |
| `ERR_PLUGIN_FAILED` | Plugin | Plugin execution error | Run with `--verbose --debug` for details |
| `ERR_LICENSE_VIOLATION` | Compliance | License compliance issue | Review licenses: `cortexdx best-practices --focus compliance` |
| `ERR_MALFORMED_JSON` | Protocol | Invalid JSON in request/response | Validate JSON: `echo '{}' \| jq .` |
| `ERR_JSONRPC_INVALID` | Protocol | Invalid JSON-RPC message | Check required fields: `jsonrpc`, `method`, `id` |
| `ERR_METHOD_NOT_FOUND` | Protocol | MCP method not implemented | Check server capabilities |
| `ERR_INVALID_PARAMS` | Protocol | Invalid method parameters | Validate parameter format |
| `ERR_INTERNAL_ERROR` | Server | Server internal error | Check server logs |
| `ERR_PARSE_ERROR` | Protocol | JSON parsing failed | Validate JSON syntax |
| `ERR_INVALID_REQUEST` | Protocol | Malformed request | Check JSON-RPC 2.0 format |

### Error Code Debugging Commands

```bash
# Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
cortexdx diagnose http://localhost:3000 --suites discovery --verbose

# TLS/SSL errors (CERT_*, UNABLE_TO_VERIFY_*)
cortexdx diagnose https://localhost:3000 --verbose --debug

# Protocol errors (ERR_INVALID_PROTOCOL, ERR_JSONRPC_*)
cortexdx diagnose http://localhost:3000 --suites protocol,jsonrpc-batch --verbose

# LLM errors (ERR_LLM_*)
cortexdx doctor
cortexdx interactive

# Plugin errors (ERR_PLUGIN_*)
cortexdx diagnose http://localhost:3000 --budget-time 30000 --budget-mem 256 --verbose

# Compliance errors (ERR_LICENSE_*)
cortexdx best-practices http://localhost:3000 --focus compliance
```

## Best Practices for Troubleshooting

### Systematic Debugging Approach

1. **Start with system health check**:

   ```bash
   cortexdx doctor
   ```

2. **Run basic diagnostics**:

   ```bash
   cortexdx diagnose <endpoint> --suites discovery,protocol
   ```

3. **Use interactive mode for complex issues**:

   ```bash
   cortexdx interactive
   # Then describe your problem in natural language
   ```

4. **Enable verbose logging when needed**:

   ```bash
   cortexdx diagnose <endpoint> --verbose --debug --har
   ```

### Development vs Production

#### Development Environment

```bash
# Use local HTTP endpoints
cortexdx diagnose http://localhost:3000

# Enable all debugging features
cortexdx diagnose http://localhost:3000 --verbose --debug --har

# Use smaller, faster models
ollama pull llama3.2:1b
```

#### Production Environment

```bash
# Use HTTPS endpoints
cortexdx diagnose https://api.example.com/mcp

# Focus on essential suites
cortexdx diagnose https://api.example.com/mcp --suites protocol,auth,cors

# Use deterministic mode for consistent results
cortexdx diagnose https://api.example.com/mcp --deterministic
```

### Maintenance and Updates

1. **Keep CortexDx updated**:

   ```bash
   npm update @brainwav/cortexdx
   
   # Check for updates
   npm outdated @brainwav/cortexdx
   ```

2. **Update LLM models regularly**:

   ```bash
   # Update Ollama models
   ollama pull llama3.2:3b --force
   ```

3. **Clean up old data**:

   ```bash
   # Clean old reports
   rm -rf reports/*
   
   # Clean old Ollama models
   ollama rm old-model-name
   ```

### Performance Best Practices

1. **Choose appropriate diagnostic scope**:
   - **Quick health check**: `--suites discovery`
   - **Basic compliance**: `--suites protocol,cors,auth`
   - **Full audit**: `--full` (use sparingly)

2. **Optimize for your platform**:
   - **Apple Silicon / NVIDIA GPU**: Use Ollama with quantized or GPU-accelerated models
   - **CPU-only**: Use smallest viable models (1B-3B parameters)

3. **Monitor resource usage**:

   ```bash
   # Set conservative budgets for slow systems
   cortexdx diagnose <endpoint> --budget-time 30000 --budget-mem 128
   ```

### Security Considerations

1. **Protect sensitive data**:
   - Always use `--har` flag to enable redaction
   - Never share raw logs containing authentication tokens
   - Use environment variables for sensitive configuration

2. **Validate endpoints**:

   ```bash
   # Always test with discovery suite first
   cortexdx diagnose <endpoint> --suites discovery
   ```

3. **Use appropriate authentication**:

   ```bash
   # Bearer token
   cortexdx diagnose <endpoint> --auth bearer:your-token
   
   # Basic auth
   cortexdx diagnose <endpoint> --auth basic:user:pass
   ```

## Platform-Specific Issues

### macOS

#### Common Issues

- **Gatekeeper blocking execution**: `xattr -d com.apple.quarantine /usr/local/bin/cortexdx`
- **Permission denied for network access**: Check System Preferences > Security & Privacy > Privacy > Network
- **Ollama not running**: Ensure the `ollama serve` daemon is listening on 127.0.0.1:11434.

#### Debugging Commands

```bash
# Check system architecture
uname -m

# Check macOS version
sw_vers

# Monitor system resources
sudo fs_usage -w -f network | grep cortexdx
```

### Linux

#### Common Issues

- **Permission denied for ports < 1024**: Use `sudo` or ports > 1024
- **Missing dependencies**: Install build tools: `sudo apt-get install build-essential`
- **SELinux blocking network access**: Check with `sestatus` and adjust policies

#### Debugging Commands

```bash
# Check distribution
cat /etc/os-release

# Check available ports
ss -tlnp

# Monitor network connections
sudo netstat -tulpn | grep cortexdx
```

### Windows

#### Common Issues

- **Windows Defender blocking execution**: Add exception for cortexdx
- **PowerShell execution policy**: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **WSL networking issues**: Use Windows IP instead of localhost in WSL

#### Debugging Commands

```powershell
# Check Windows version
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion

# Check network configuration
Get-NetAdapter | Where-Object {$_.Status -eq "Up"}

# Monitor process
Get-Process | Where-Object {$_.ProcessName -like "*node*"}
```

### Docker/Container Issues

#### Common Problems

- **Network isolation**: Use `--network host` for local testing
- **DNS resolution**: Configure custom DNS or use IP addresses
- **Resource limits**: Increase memory limits for LLM operations

#### Solutions

```bash
# Run with host networking
docker run --network host cortexdx diagnose http://localhost:3000

# Increase memory limit
docker run -m 2g cortexdx diagnose http://localhost:3000

# Debug container networking
docker exec -it container-name ping host.docker.internal
```

## Emergency Recovery

### Complete Reset

```bash
# Reset all configuration
rm -rf ~/.cortexdx/

# Reinstall from scratch
npm uninstall -g @brainwav/cortexdx
npm install -g @brainwav/cortexdx

# Verify installation
cortexdx doctor
```

### Minimal Working Configuration

```json
// .cortexdx.json (minimal)
{
  "llm": {
    "backend": "ollama",
    "model": "llama3.2:1b"
  },
  "diagnostics": {
    "suites": ["discovery", "protocol"]
  }
}
```

## Getting Help

### Self-Service Resources

- **Interactive Help**: `cortexdx interactive`
- **System Diagnostics**: `cortexdx doctor`
- **Error Explanation**: `cortexdx explain error "<message>"`
- **Best Practices**: `cortexdx best-practices <endpoint>`

### Documentation

- [Getting Started Guide](./GETTING_STARTED.md) - Installation and basic usage
- [User Guide](./USER_GUIDE.md) - Comprehensive user documentation
- [API Reference](./API_REFERENCE.md) - Complete command reference
- [Plugin Development](./PLUGIN_DEVELOPMENT.md) - Creating custom plugins
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Contributing Guide](./CONTRIBUTING.md) - Development setup

### Community Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/brainwav/cortexdx/issues)
- **GitHub Discussions**: [Ask questions and share tips](https://github.com/brainwav/cortexdx/discussions)
- **Documentation**: [Official documentation](https://github.com/brainwav/cortexdx/tree/main/docs)

### Professional Support

For enterprise support and consulting services, contact [brAInwav](https://brainwav.dev).

---

**Remember**: When reporting issues, always include the output of `cortexdx doctor` and use `--verbose --debug` flags to capture detailed logs.
