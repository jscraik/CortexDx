# Insula MCP v1.0.0 Quick Reference

## Installation

### NPM

```bash
npm install -g @brainwav/insula-mcp@1.0.0
```

### Docker

```bash
# Community (Free)
docker run -p 3000:3000 brainwav/insula-mcp:1.0.0-community

# Professional (License Required)
docker run -p 3000:3000 \
  -e INSULA_LICENSE_KEY=your-key \
  brainwav/insula-mcp:1.0.0-professional

# Enterprise (License + Auth0 Required)
docker run -p 3000:3000 \
  -e INSULA_LICENSE_KEY=your-key \
  -e AUTH0_DOMAIN=your-domain.auth0.com \
  brainwav/insula-mcp:1.0.0-enterprise
```

### Quick Deploy

```bash
curl -fsSL https://raw.githubusercontent.com/brainwav/insula-mcp/main/packages/insula-mcp/scripts/quick-deploy.sh | bash -s community
```

## Essential Commands

### Diagnostics

```bash
# Basic scan
insula-mcp diagnose https://mcp.example.com

# Full analysis
insula-mcp diagnose https://mcp.example.com --full

# With authentication
insula-mcp diagnose https://mcp.example.com --auth bearer:token
```

### Interactive Mode

```bash
# Start interactive session
insula-mcp interactive

# Debug specific issue
insula-mcp debug "connection timeout"

# Generate code
insula-mcp generate
```

### Development

```bash
# Get best practices
insula-mcp best-practices https://mcp.example.com

# Interactive tutorial
insula-mcp tutorial mcp-basics

# Environment check
insula-mcp doctor
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
INSULA_MCP_TIER=community
NODE_ENV=production
```

### Professional

```bash
INSULA_MCP_TIER=professional
INSULA_LICENSE_KEY=your-key
OLLAMA_HOST=localhost:11434
```

### Enterprise

```bash
INSULA_MCP_TIER=enterprise
INSULA_LICENSE_KEY=your-key
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-secret
```

## Common Tasks

### Check Version

```bash
insula-mcp --version
```

### Verify License

```bash
insula-mcp license verify
insula-mcp license features
```

### View Patterns

```bash
insula-mcp patterns list
insula-mcp patterns export --output patterns.json
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Docker Management

### Start Container

```bash
docker start insula-mcp-community
```

### Stop Container

```bash
docker stop insula-mcp-community
```

### View Logs

```bash
docker logs -f insula-mcp-community
```

### Shell Access

```bash
docker exec -it insula-mcp-community sh
```

## Troubleshooting

### Connection Issues

```bash
# Increase timeout
insula-mcp diagnose <endpoint> --budget-time 15000

# Check network
insula-mcp doctor
```

### Memory Issues

```bash
# Increase memory budget
insula-mcp diagnose <endpoint> --budget-mem 256
```

### Authentication Problems

```bash
# Test different auth methods
insula-mcp diagnose <endpoint> --auth bearer:token
insula-mcp diagnose <endpoint> --auth basic:user:pass
```

## Support

- **Documentation**: https://docs.brainwav.io/insula-mcp
- **GitHub Issues**: https://github.com/brainwav/insula-mcp/issues
- **Community**: https://github.com/brainwav/insula-mcp/discussions
- **Email**: support@brainwav.io

## Links

- **NPM**: https://www.npmjs.com/package/@brainwav/insula-mcp
- **Docker Hub**: https://hub.docker.com/r/brainwav/insula-mcp
- **GitHub**: https://github.com/brainwav/insula-mcp
- **Release Notes**: [RELEASE_NOTES.md](RELEASE_NOTES.md)
- **Migration Guide**: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
