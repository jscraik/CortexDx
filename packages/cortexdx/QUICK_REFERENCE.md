# CortexDx v1.0.0 Quick Reference

## Installation

### NPM

```bash
npm install -g @brainwav/cortexdx@1.0.0
```

### Docker

```bash
# Community (Free)
docker run -p 3000:3000 brainwav/cortexdx:1.0.0-community

# Professional (License Required)
docker run -p 3000:3000 \
  -e CORTEXDX_LICENSE_KEY=your-key \
  brainwav/cortexdx:1.0.0-professional

# Enterprise (License + Auth0 Required)
docker run -p 3000:3000 \
  -e CORTEXDX_LICENSE_KEY=your-key \
  -e AUTH0_DOMAIN=your-domain.auth0.com \
  brainwav/cortexdx:1.0.0-enterprise
```

### Quick Deploy

```bash
curl -fsSL https://raw.githubusercontent.com/brainwav/cortexdx/main/packages/cortexdx/scripts/quick-deploy.sh | bash -s community
```

## Essential Commands

### Diagnostics

```bash
# Basic scan
cortexdx diagnose https://mcp.example.com

# Full analysis
cortexdx diagnose https://mcp.example.com --full

# With authentication
cortexdx diagnose https://mcp.example.com --auth bearer:token
```

### Interactive Mode

```bash
# Start interactive session
cortexdx interactive

# Debug specific issue
cortexdx debug "connection timeout"

# Generate code
cortexdx generate
```

### Development

```bash
# Get best practices
cortexdx best-practices https://mcp.example.com

# Interactive tutorial
cortexdx tutorial mcp-basics

# Environment check
cortexdx doctor
```

## Feature Tiers

| Feature | Community | Professional | Enterprise |
|---------|-----------|--------------|------------|
| Core Diagnostics | ✅ | ✅ | ✅ |
| LLM Integration | ❌ | ✅ | ✅ |
| Code Generation | ❌ | ✅ | ✅ |
| Academic Validation | ❌ | ✅ | ✅ |
| Auth0 Integration | ❌ | ❌ | ✅ |
| Usage Analytics | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |

## Environment Variables

### Community

```bash
CORTEXDX_MCP_TIER=community
NODE_ENV=production
```

### Professional

```bash
CORTEXDX_MCP_TIER=professional
CORTEXDX_LICENSE_KEY=your-key
OLLAMA_HOST=localhost:11434
```

### Enterprise

```bash
CORTEXDX_MCP_TIER=enterprise
CORTEXDX_LICENSE_KEY=your-key
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-secret
```

## Common Tasks

### Check Version

```bash
cortexdx --version
```

### Verify License

```bash
cortexdx license verify
cortexdx license features
```

### View Patterns

```bash
cortexdx patterns list
cortexdx patterns export --output patterns.json
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Docker Management

### Start Container

```bash
docker start cortexdx-community
```

### Stop Container

```bash
docker stop cortexdx-community
```

### View Logs

```bash
docker logs -f cortexdx-community
```

### Shell Access

```bash
docker exec -it cortexdx-community sh
```

## Troubleshooting

### Connection Issues

```bash
# Increase timeout
cortexdx diagnose <endpoint> --budget-time 15000

# Check network
cortexdx doctor
```

### Memory Issues

```bash
# Increase memory budget
cortexdx diagnose <endpoint> --budget-mem 256
```

### Authentication Problems

```bash
# Test different auth methods
cortexdx diagnose <endpoint> --auth bearer:token
cortexdx diagnose <endpoint> --auth basic:user:pass
```

## Support

- **Documentation**: https://docs.brainwav.io/cortexdx
- **GitHub Issues**: https://github.com/brainwav/cortexdx/issues
- **Community**: https://github.com/brainwav/cortexdx/discussions
- **Email**: support@brainwav.io

## Links

- **NPM**: https://www.npmjs.com/package/@brainwav/cortexdx
- **Docker Hub**: https://hub.docker.com/r/brainwav/cortexdx
- **GitHub**: https://github.com/brainwav/cortexdx
- **Release Notes**: [RELEASE_NOTES.md](RELEASE_NOTES.md)
- **Migration Guide**: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
