# Troubleshooting Guide

Common issues and solutions when using Insula MCP.

## Connection Issues

### Server Not Responding

**Symptom**: `Connection refused` or `ECONNREFUSED` errors

**Solutions**:

1. **Check if server is running**:

   ```bash
   # Test with curl
   curl http://localhost:3000
   
   # Or use Insula MCP
   insula-mcp diagnose http://localhost:3000 --verbose
   ```

2. **Verify port number**:

   ```bash
   # Check what's running on the port
   lsof -i :3000
   ```

3. **Check firewall settings**:

   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   
   # Linux
   sudo ufw status
   ```

4. **Use interactive debugger**:

   ```bash
   insula-mcp interactive
   # Then: "Help me debug connection to localhost:3000"
   ```

### SSL/TLS Errors

**Symptom**: `CERT_HAS_EXPIRED` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

**Solutions**:

1. **Use HTTP for local development**:

   ```bash
   insula-mcp diagnose http://localhost:3000
   ```

2. **Skip certificate validation** (development only):

   ```bash
   NODE_TLS_REJECT_UNAUTHORIZED=0 insula-mcp diagnose https://localhost:3000
   ```

3. **Install proper certificates**:

   ```bash
   # Generate self-signed cert
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365
   ```

### Timeout Errors

**Symptom**: `Request timeout` or operations taking too long

**Solutions**:

1. **Increase timeout**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --timeout 60000
   ```

2. **Check server performance**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --suite performance
   ```

3. **Use performance profiler**:

   ```bash
   insula-mcp profile http://localhost:3000
   ```

## Protocol Compliance Issues

### Invalid JSON-RPC Messages

**Symptom**: `Invalid JSON-RPC 2.0 message` errors

**Solutions**:

1. **Validate message structure**:

   ```bash
   insula-mcp validate http://localhost:3000 --verbose
   ```

2. **Check for required fields**:
   - Request must have: `jsonrpc`, `method`, `id`
   - Response must have: `jsonrpc`, `result` or `error`, `id`

3. **Example valid request**:

   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/list",
     "id": 1
   }
   ```

### Protocol Version Mismatch

**Symptom**: `Unsupported protocol version` warnings

**Solutions**:

1. **Check supported versions**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --suite protocol
   ```

2. **Update server to latest protocol**:

   ```bash
   insula-mcp migrate http://localhost:3000 --to 2024-11-05
   ```

3. **Test compatibility**:

   ```bash
   insula-mcp compatibility http://localhost:3000
   ```

## LLM Integration Issues

### LLM Not Available

**Symptom**: `LLM not available` or `No LLM backend detected`

**Solutions**:

1. **Install Ollama** (recommended):

   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull llama3
   ```

2. **Install MLX** (Apple Silicon):

   ```bash
   pip install mlx-lm
   ```

3. **Verify installation**:

   ```bash
   insula-mcp doctor
   ```

4. **Configure backend manually**:

   ```json
   {
     "llm": {
       "backend": "ollama",
       "model": "llama3",
       "endpoint": "http://localhost:11434"
     }
   }
   ```

### Slow LLM Responses

**Symptom**: LLM operations taking longer than 2 seconds

**Solutions**:

1. **Use smaller model**:

   ```bash
   ollama pull llama3:8b
   ```

2. **Enable quantization**:

   ```json
   {
     "llm": {
       "quantization": "q4_0"
     }
   }
   ```

3. **Check system resources**:

   ```bash
   # Monitor CPU/Memory
   top
   
   # Check GPU usage (if applicable)
   nvidia-smi
   ```

### Model Loading Errors

**Symptom**: `Failed to load model` errors

**Solutions**:

1. **Check available models**:

   ```bash
   ollama list
   ```

2. **Pull model explicitly**:

   ```bash
   ollama pull llama3
   ```

3. **Verify disk space**:

   ```bash
   df -h
   ```

## Plugin Issues

### Plugin Not Found

**Symptom**: `Plugin 'xyz' not found` errors

**Solutions**:

1. **List available plugins**:

   ```bash
   insula-mcp plugins list
   ```

2. **Install plugin**:

   ```bash
   npm install @myorg/insula-plugin-xyz
   ```

3. **Register plugin**:

   ```typescript
   import { registerPlugin } from '@brainwav/insula-mcp';
   import { myPlugin } from './my-plugin.js';
   registerPlugin(myPlugin);
   ```

### Plugin Execution Errors

**Symptom**: Plugin crashes or returns errors

**Solutions**:

1. **Run with verbose logging**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --verbose --debug
   ```

2. **Test plugin individually**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --plugin security-scanner
   ```

3. **Check plugin logs**:

   ```bash
   tail -f ~/.insula-mcp/logs/plugin-errors.log
   ```

## License Validation Issues

### License Check Failures

**Symptom**: `License validation failed` or `Proprietary content detected`

**Solutions**:

1. **Check approved licenses**:

   ```bash
   insula-mcp licenses list
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
   insula-mcp licenses request-approval --source "research-paper-xyz"
   ```

### Compliance Monitoring Errors

**Symptom**: Compliance reports showing violations

**Solutions**:

1. **Generate compliance report**:

   ```bash
   insula-mcp compliance report --period 2024-Q1
   ```

2. **Review flagged usage**:

   ```bash
   insula-mcp compliance review --flagged
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

**Symptom**: Diagnostic runs taking too long

**Solutions**:

1. **Run specific suites only**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --suite protocol,security
   ```

2. **Skip optional checks**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --skip-optional
   ```

3. **Use parallel execution**:

   ```json
   {
     "diagnostics": {
       "parallel": true,
       "maxConcurrency": 4
     }
   }
   ```

### High Memory Usage

**Symptom**: Insula MCP consuming too much memory

**Solutions**:

1. **Limit conversation history**:

   ```json
   {
     "llm": {
       "maxHistoryLength": 10
     }
   }
   ```

2. **Disable caching**:

   ```json
   {
     "cache": {
       "enabled": false
     }
   }
   ```

3. **Use streaming mode**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --stream
   ```

## Configuration Issues

### Invalid Configuration

**Symptom**: `Invalid configuration` errors

**Solutions**:

1. **Validate configuration**:

   ```bash
   insula-mcp config validate
   ```

2. **Reset to defaults**:

   ```bash
   insula-mcp config reset
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
   ./.insula-mcp.json
   
   # User-level
   ~/.insula-mcp/config.json
   
   # System-level
   /etc/insula-mcp/config.json
   ```

2. **Specify configuration explicitly**:

   ```bash
   insula-mcp diagnose http://localhost:3000 --config ./my-config.json
   ```

## Getting More Help

### Interactive Troubleshooting

```bash
insula-mcp interactive
# Then describe your issue in natural language
```

### Diagnostic Doctor

```bash
insula-mcp doctor
```

This will check:

- LLM backend availability
- Plugin installation
- Configuration validity
- Network connectivity
- System requirements

### Verbose Logging

```bash
insula-mcp diagnose http://localhost:3000 --verbose --debug
```

### Report an Issue

```bash
insula-mcp report-issue --include-logs
```

This will:

- Collect relevant logs
- Sanitize sensitive information
- Generate issue template
- Open GitHub issue (if configured)

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `ECONNREFUSED` | Server not running | Start the server |
| `ETIMEDOUT` | Request timeout | Increase timeout or check server |
| `ENOTFOUND` | DNS resolution failed | Check endpoint URL |
| `CERT_HAS_EXPIRED` | SSL certificate expired | Renew certificate |
| `ERR_INVALID_PROTOCOL` | Wrong protocol version | Update server or client |
| `ERR_LLM_NOT_AVAILABLE` | No LLM backend | Install Ollama or MLX |
| `ERR_PLUGIN_FAILED` | Plugin execution error | Check plugin logs |
| `ERR_LICENSE_VIOLATION` | License compliance issue | Review and approve licenses |

## Best Practices

1. **Always run diagnostics first**: `insula-mcp diagnose`
2. **Use interactive mode for complex issues**: `insula-mcp interactive`
3. **Keep logs for debugging**: `--verbose --debug`
4. **Update regularly**: `npm update @brainwav/insula-mcp`
5. **Test in development first**: Use local servers before production

## Resources

- [Getting Started Guide](./GETTING_STARTED.md)
- [API Reference](./API_REFERENCE.md)
- [Plugin Development](./PLUGIN_DEVELOPMENT.md)
- [GitHub Issues](https://github.com/brainwav/insula-mcp/issues)
