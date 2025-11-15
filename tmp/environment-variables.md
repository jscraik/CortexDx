# CortexDx Environment Variables

This document lists all environment variables identified in the CortexDx codebase.

## Core Environment Variables for `.env`

### **CortexDx Server Configuration**
```bash
# Server configuration
PORT=5001
HOST=127.0.0.1
CORTEXDX_SERVER_PORT=5001
CORTEXDX_ADMIN_TOKEN=your-admin-token-here
CORTEXDX_INTERNAL_ENDPOINT=http://127.0.0.1:5001

# TLS (optional)
CORTEXDX_TLS_CERT_PATH=/path/to/cert.pem
CORTEXDX_TLS_KEY_PATH=/path/to/key.pem

# Authentication
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_AUDIENCE=your-api-identifier
REQUIRE_AUTH=false
REQUIRE_LICENSE=false
DEFAULT_TIER=community
```

### **Academic Research Providers**
```bash
# Context7
CONTEXT7_API_KEY=your-context7-api-key
CONTEXT7_API_BASE_URL=https://api.context7.com
CONTEXT7_PROFILE=default

# Exa
EXA_API_KEY=your-exa-api-key

# Semantic Scholar
SEMANTIC_SCHOLAR_API_KEY=your-semantic-scholar-key

# OpenAlex
OPENALEX_CONTACT_EMAIL=your-email@domain.com
OPENALEX_API_KEY=your-openalex-key

# Vibe Check
VIBE_CHECK_API_KEY=your-vibe-check-key

# Research Quality
RESEARCH_QUALITY_API_KEY=your-research-quality-key
RESEARCH_QUALITY_HTTP_URL=your-service-url

# Cortex Vibe
CORTEX_VIBE_HTTP_URL=your-cortex-vibe-url
```

### **Deep Context Integration**
```bash
# Jina AI
JINA_API_KEY=your-jina-api-key

# TurboPuffer
TURBOPUFFER_API_KEY=your-turbopuffer-key

# Wildcard (for DeepContext)
WILDCARD_API_KEY=your-wildcard-key

# DeepContext configuration
CORTEXDX_DISABLE_DEEPCONTEXT=0
CORTEXDX_DEEPCONTEXT_STATE=/path/to/deepcontext-state
CORTEXDX_PROJECT_ROOT=/path/to/your/project
CODEX_CONTEXT_DIR=/path/to/context/dir
CORTEXDX_CODEX_CONTEXT_DIR=/path/to/cortexdx/context
```

### **Storage & State**
```bash
# Pattern storage
CORTEXDX_PATTERN_KEY=your-32-char-hex-encryption-key
CORTEXDX_PATTERN_DB=.cortexdx/patterns.db

# State management
CORTEXDX_STATE_DB=.cortexdx/workflow-state.db
CORTEXDX_STATE_DIR=.cortexdx
CORTEXDX_MONITOR_STATE=.cortexdx/monitor-state.json
```

### **LLM Configuration**
```bash
# LLM Provider
LLM_PROVIDER=ollama
CORTEXDX_LLM_PRIORITY=local,cloud,api

# Local Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Disable LLM for air-gapped workflows
CORTEXDX_DISABLE_LLM=0
```

### **Monitoring & Observability**
```bash
# Monitoring
ENABLE_MONITORING=true
MONITORING_INTERVAL_MS=30000

# Logging
CORTEXDX_LOG_LEVEL=info
NODE_ENV=development

# Inspector
CORTEXDX_INSPECTOR_VERBOSE=0
CORTEXDX_INSPECTOR_PROXY_PORT=6277
CORTEXDX_INSPECTOR_MAX_RUNTIME_MS=300000
```

### **Security & SBOM**
```bash
# Dependency Track integration
CORTEXDX_DT_API_URL=https://your-dt-instance.com
CORTEXDX_DT_API_KEY=your-dt-api-key
CORTEXDX_DT_PROJECT=your-project-name
CORTEXDX_DT_PROJECT_VERSION=1.0.0
```

### **MCP Evaluation**
```bash
# MCP Eval configuration
MCP_EVAL_ENDPOINT=http://127.0.0.1:5001/mcp
MCP_EVAL_AUTH_HEADER=your-auth-header
MCP_EVAL_BEARER_TOKEN=your-bearer-token
MCP_EVAL_AUTH0_DOMAIN=your-domain.auth0.com
MCP_EVAL_AUTH0_CLIENT_ID=your-client-id
MCP_EVAL_AUTH0_CLIENT_SECRET=your-client-secret
MCP_EVAL_AUTH0_AUDIENCE=your-audience

# Evaluation settings
CORTEXDX_EVAL_ENDPOINT=http://127.0.0.1:5001/mcp
CORTEXDX_EVAL_STDIO=packages/cortexdx/src/adapters/stdio-wrapper.ts
CORTEXDX_EVAL_MODEL=gpt-4o-mini
```

### **SSE & WebSocket Configuration**
```bash
# SSE configuration
CORTEXDX_DISABLE_SSE=0
CORTEXDX_SSE_ENDPOINT=your-sse-endpoint

# CORS & Origins
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Cloud Environment Variables for `.env.cloud`

```bash
# Cloud LLM Provider
LLM_PROVIDER=ollama
CLOUD_ENV_FILE=.env.cloud

# Ollama Cloud
CLOUD_OLLAMA_BASE_URL=https://ollama.com
CLOUD_LLM_MODEL=kimi-k2:1t
CLOUD_OLLAMA_API_KEY=your-ollama-cloud-key

# Alternative cloud configurations
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=your-ollama-cloud-key
ALTERNATIVE_CLOUD_LLM_MODE=glm-4.6-cloud
```

## Environment Variable Categories

### **Required for Basic Operation**
- `PORT` / `CORTEXDX_SERVER_PORT`
- `CORTEXDX_ADMIN_TOKEN`

### **Required for Academic Research**
- `CONTEXT7_API_KEY` + `CONTEXT7_API_BASE_URL`
- `EXA_API_KEY`
- `OPENALEX_CONTACT_EMAIL`

### **Optional but Recommended**
- `CORTEXDX_PATTERN_KEY` (for encrypted storage)
- `JINA_API_KEY` / `TURBOPUFFER_API_KEY` (for DeepContext)
- `WILDCARD_API_KEY` (for advanced features)

### **Development & Testing**
- `NODE_ENV` (development/production/test)
- `VITEST` (testing flag)
- `CORTEXDX_EVAL_*` (evaluation settings)

### **Security & Compliance**
- `CORTEXDX_DT_*` (Dependency Track integration)
- `AUTH0_*` (authentication)
- `REQUIRE_AUTH` / `REQUIRE_LICENSE`

## Usage Examples

### Local Development
```bash
# Copy and customize
cp .env.self.example .env
# Edit values in .env
```

### Cloud Deployment
```bash
# Use 1Password for sensitive values
op run --env-file=.env.cloud -- pnpm start
```

### Air-gapped Environment
```bash
# Disable external dependencies
export CORTEXDX_DISABLE_LLM=1
export CORTEXDX_DISABLE_DEEPCONTEXT=1
```

## Notes

- **Total Variables Identified**: 70+
- **Critical for Operation**: ~8 variables
- **Academic Features**: ~12 variables  
- **Cloud/LLM Features**: ~10 variables
- **Monitoring/Debug**: ~15 variables

## File Locations

- **Main Config**: `.env` (local development)
- **Cloud Config**: `.env.cloud` (cloud deployments)
- **Port Config**: `config/port.env` (service ports)
- **Example**: `.env.self.example` (template)

---
*Generated from CortexDx codebase analysis on November 15, 2025*
