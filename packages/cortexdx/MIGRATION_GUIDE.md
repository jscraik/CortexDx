# Migration Guide to CortexDx v1.0.0

This guide helps you migrate from pre-1.0 versions of CortexDx to the stable v1.0.0 release.

## Overview

CortexDx v1.0.0 introduces significant enhancements including local LLM integration, academic research validation, commercial licensing tiers, and improved diagnostic capabilities. This guide covers breaking changes, new features, and step-by-step migration instructions.

## Breaking Changes

### 1. Package Name and Versioning

**Before (v0.x):**

```bash
npm install cortexdx
```

**After (v1.0.0):**

```bash
npm install @brainwav/cortexdx
```

**Migration Steps:**

1. Uninstall old package: `npm uninstall cortexdx`
2. Install new package: `npm install -g @brainwav/cortexdx@1.0.0`
3. Update any scripts or CI/CD configurations to use `@brainwav/cortexdx`

### 2. CLI Command Structure

**Before (v0.x):**

```bash
cortexdx diagnose <endpoint>
```

**After (v1.0.0):**

```bash
cortexdx diagnose <endpoint>
```

**Migration Steps:**

1. Update all CLI commands to use `cortexdx` instead of `cortexdx`
2. Update shell scripts and automation tools
3. Update CI/CD pipeline configurations

### 3. Configuration File Format

**Before (v0.x):**

```json
{
  "endpoint": "https://mcp.example.com",
  "suites": ["discovery", "protocol"]
}
```

**After (v1.0.0):**

```json
{
  "endpoint": "https://mcp.example.com",
  "suites": ["discovery", "protocol"],
  "tier": "community",
  "llm": {
    "backend": "ollama",
    "model": "llama3:8b"
  }
}
```

**Migration Steps:**

1. Add `tier` field to specify licensing tier (community/professional/enterprise)
2. Add `llm` configuration if using Professional or Enterprise tier
3. Update any custom configuration files

### 4. Docker Image Names

**Before (v0.x):**

```bash
docker pull brainwav/cortexdx:latest
```

**After (v1.0.0):**

```bash
# Choose tier-specific image
docker pull brainwav/cortexdx:1.0.0-community
docker pull brainwav/cortexdx:1.0.0-professional
docker pull brainwav/cortexdx:1.0.0-enterprise
```

**Migration Steps:**

1. Update docker-compose.yml to use tier-specific images
2. Update Kubernetes manifests if applicable
3. Update CI/CD deployment scripts

### 5. Environment Variables

**New Required Variables (Professional/Enterprise):**

```bash
# Professional Tier
CORTEXDX_MCP_TIER=professional
CORTEXDX_LICENSE_KEY=your-license-key
OLLAMA_HOST=ollama:11434

# Enterprise Tier (additional)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-secret
POSTGRES_PASSWORD=your-db-password
```

**Migration Steps:**

1. Set `CORTEXDX_MCP_TIER` environment variable
2. Obtain and set license key for Professional/Enterprise tiers
3. Configure Auth0 credentials for Enterprise tier
4. Update deployment configurations with new variables

## New Features

### 1. Local LLM Integration (Professional/Enterprise)

**Setup:**

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended models
ollama pull llama3:8b
ollama pull codellama:7b

# Configure CortexDx
export CORTEXDX_MCP_LLM_BACKEND=ollama
export OLLAMA_HOST=localhost:11434
```

**Usage:**

```bash
# Interactive development assistance
cortexdx interactive

# Debug with AI assistance
cortexdx debug "SSE connection timeout"

# Generate code from description
cortexdx generate
```

### 2. Academic Research Integration (Professional/Enterprise)

**Configuration:**

```bash
# Enable academic providers
export CORTEXDX_ACADEMIC_PROVIDERS=context7,vibe-check,semantic-scholar

# Configure license validation
export CORTEXDX_LICENSE_VALIDATION=strict
```

**Usage:**

```bash
# Get research-backed recommendations
cortexdx diagnose https://mcp.example.com --academic

# Validate license compliance
cortexdx validate-licenses --report
```

### 3. Commercial Licensing

**Obtaining a License:**

1. Visit https://brainwav.io/cortexdx/pricing
2. Choose Professional or Enterprise tier
3. Complete purchase and receive license key
4. Set `CORTEXDX_LICENSE_KEY` environment variable

**Activating License:**

```bash
# Set license key
export CORTEXDX_LICENSE_KEY=your-license-key

# Verify activation
cortexdx license verify

# Check feature access
cortexdx license features
```

### 4. Pattern Storage and Learning

**Configuration:**

```bash
# Enable pattern storage
export CORTEXDX_PATTERN_STORAGE=enabled
export CORTEXDX_PATTERN_DB=/app/data/patterns.db

# Configure RAG system
export CORTEXDX_RAG_ENABLED=true
export CORTEXDX_EMBEDDING_MODEL=nomic-embed-text
```

**Usage:**

```bash
# View learned patterns
cortexdx patterns list

# Export patterns
cortexdx patterns export --output patterns.json

# Import patterns
cortexdx patterns import --input patterns.json
```

## Migration Paths

### From v0.1.x to v1.0.0 (Community Tier)

**Step 1: Update Package**

```bash
npm uninstall cortexdx
npm install -g @brainwav/cortexdx@1.0.0
```

**Step 2: Update Scripts**

```bash
# Before
cortexdx diagnose https://mcp.example.com

# After
cortexdx diagnose https://mcp.example.com
```

**Step 3: Update Docker Deployment**

```yaml
# docker-compose.yml
services:
  cortexdx:
    image: brainwav/cortexdx:1.0.0-community
    environment:
      - CORTEXDX_MCP_TIER=community
```

**Step 4: Test Migration**

```bash
# Run diagnostic to verify
cortexdx diagnose https://mcp.example.com --full

# Check version
cortexdx --version
```

### From v0.1.x to v1.0.0 (Professional Tier)

**Step 1: Obtain License**

1. Purchase Professional license at https://brainwav.io/cortexdx/pricing
2. Receive license key via email
3. Store license key securely

**Step 2: Setup LLM Backend**

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
ollama pull llama3:8b
ollama pull codellama:7b
ollama pull nomic-embed-text
```

**Step 3: Update Configuration**

```bash
# Set environment variables
export CORTEXDX_MCP_TIER=professional
export CORTEXDX_LICENSE_KEY=your-license-key
export OLLAMA_HOST=localhost:11434
export CORTEXDX_MCP_LLM_BACKEND=ollama
```

**Step 4: Update Docker Deployment**

```yaml
# docker-compose.yml
services:
  cortexdx:
    image: brainwav/cortexdx:1.0.0-professional
    environment:
      - CORTEXDX_MCP_TIER=professional
      - CORTEXDX_LICENSE_KEY=${CORTEXDX_LICENSE_KEY}
      - OLLAMA_HOST=ollama:11434
    volumes:
      - cortexdx-models:/app/models
      - cortexdx-patterns:/app/patterns
  
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama-models:/root/.ollama
```

**Step 5: Verify Features**

```bash
# Verify license
cortexdx license verify

# Test LLM integration
cortexdx interactive

# Test code generation
cortexdx generate
```

### From v0.1.x to v1.0.0 (Enterprise Tier)

**Step 1: Obtain Enterprise License**

1. Contact enterprise@brainwav.io for Enterprise licensing
2. Complete enterprise agreement
3. Receive license key and Auth0 credentials

**Step 2: Setup Auth0**

1. Create Auth0 account or use existing
2. Configure application in Auth0 dashboard
3. Obtain domain, client ID, and client secret
4. Configure callback URLs and permissions

**Step 3: Setup Infrastructure**

```bash
# Install required services
docker-compose -f docker-compose.enterprise.yml up -d postgres redis ollama
```

**Step 4: Configure Environment**

```bash
# Set all required variables
export CORTEXDX_MCP_TIER=enterprise
export CORTEXDX_LICENSE_KEY=your-license-key
export OLLAMA_HOST=ollama:11434
export AUTH0_DOMAIN=your-domain.auth0.com
export AUTH0_CLIENT_ID=your-client-id
export AUTH0_CLIENT_SECRET=your-secret
export POSTGRES_PASSWORD=your-db-password
export OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector.com
```

**Step 5: Deploy Enterprise Stack**

```yaml
# docker-compose.enterprise.yml
services:
  cortexdx:
    image: brainwav/cortexdx:1.0.0-enterprise
    environment:
      - CORTEXDX_MCP_TIER=enterprise
      - CORTEXDX_LICENSE_KEY=${CORTEXDX_LICENSE_KEY}
      - AUTH0_DOMAIN=${AUTH0_DOMAIN}
      - AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID}
      - AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET}
    volumes:
      - cortexdx-data:/app/data
      - cortexdx-models:/app/models
      - cortexdx-analytics:/app/analytics
    depends_on:
      - postgres
      - redis
      - ollama
```

**Step 6: Verify Enterprise Features**

```bash
# Verify license and features
cortexdx license verify
cortexdx license features

# Test authentication
cortexdx auth login

# Test analytics
cortexdx analytics dashboard
```

## Data Migration

### Conversation History

**Export from v0.x:**

```bash
# Not available in v0.x - no migration needed
```

**Import to v1.0.0:**

```bash
# Start fresh with v1.0.0 conversation storage
# No action required
```

### Diagnostic Reports

**Migrate Reports:**

```bash
# v0.x reports are compatible with v1.0.0
# Copy reports directory
cp -r old-reports/ new-reports/

# Re-run diagnostics to update format
cortexdx diagnose https://mcp.example.com --out new-reports
```

### Pattern Storage

**Initialize Pattern Storage:**

```bash
# Enable pattern storage
export CORTEXDX_PATTERN_STORAGE=enabled

# Initialize database
cortexdx patterns init

# System will learn patterns from new interactions
```

## CI/CD Migration

### GitHub Actions

**Before (v0.x):**

```yaml
- name: Run Diagnostics
  run: npx cortexdx diagnose ${{ secrets.MCP_ENDPOINT }}
```

**After (v1.0.0):**

```yaml
- name: Run Diagnostics
  run: npx @brainwav/cortexdx@1.0.0 diagnose ${{ secrets.MCP_ENDPOINT }}
  env:
    CORTEXDX_MCP_TIER: community
```

### GitLab CI

**Before (v0.x):**

```yaml
test:
  script:
    - npm install -g cortexdx
    - cortexdx diagnose $MCP_ENDPOINT
```

**After (v1.0.0):**

```yaml
test:
  script:
    - npm install -g @brainwav/cortexdx@1.0.0
    - cortexdx diagnose $MCP_ENDPOINT
  variables:
    CORTEXDX_MCP_TIER: community
```

### Jenkins

**Before (v0.x):**

```groovy
sh 'npm install -g cortexdx'
sh 'cortexdx diagnose ${MCP_ENDPOINT}'
```

**After (v1.0.0):**

```groovy
sh 'npm install -g @brainwav/cortexdx@1.0.0'
withEnv(['CORTEXDX_MCP_TIER=community']) {
    sh 'cortexdx diagnose ${MCP_ENDPOINT}'
}
```

## Kubernetes Migration

### Deployment Manifest

**Before (v0.x):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cortexdx
spec:
  template:
    spec:
      containers:
      - name: cortexdx
        image: brainwav/cortexdx:latest
```

**After (v1.0.0):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cortexdx
spec:
  template:
    spec:
      containers:
      - name: cortexdx
        image: brainwav/cortexdx:1.0.0-professional
        env:
        - name: CORTEXDX_MCP_TIER
          value: "professional"
        - name: CORTEXDX_LICENSE_KEY
          valueFrom:
            secretKeyRef:
              name: cortexdx-secrets
              key: license-key
        volumeMounts:
        - name: models
          mountPath: /app/models
        - name: patterns
          mountPath: /app/patterns
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: cortexdx-models-pvc
      - name: patterns
        persistentVolumeClaim:
          claimName: cortexdx-patterns-pvc
```

## Troubleshooting

### Common Migration Issues

#### Issue: License Key Not Recognized

**Symptoms:**

```
Error: Invalid license key for tier 'professional'
```

**Solution:**

```bash
# Verify license key format
echo $CORTEXDX_LICENSE_KEY

# Re-verify license
cortexdx license verify

# Contact support if issue persists
```

#### Issue: LLM Backend Connection Failed

**Symptoms:**

```
Error: Failed to connect to Ollama at localhost:11434
```

**Solution:**

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
systemctl restart ollama

# Verify host configuration
export OLLAMA_HOST=localhost:11434
```

#### Issue: Auth0 Authentication Failed

**Symptoms:**

```
Error: Auth0 authentication failed: Invalid credentials
```

**Solution:**

```bash
# Verify Auth0 configuration
echo $AUTH0_DOMAIN
echo $AUTH0_CLIENT_ID

# Check Auth0 application settings
# Verify callback URLs are configured
# Ensure API permissions are granted
```

#### Issue: Docker Container Won't Start

**Symptoms:**

```
Error: Container exits immediately after start
```

**Solution:**

```bash
# Check container logs
docker logs cortexdx

# Verify environment variables
docker inspect cortexdx | grep -A 20 Env

# Check volume permissions
docker exec cortexdx ls -la /app
```

## Rollback Procedure

If you encounter issues with v1.0.0, you can rollback to v0.x:

**Step 1: Uninstall v1.0.0**

```bash
npm uninstall -g @brainwav/cortexdx
```

**Step 2: Reinstall v0.x**

```bash
npm install -g cortexdx@0.1.0
```

**Step 3: Restore Configuration**

```bash
# Restore old configuration files
cp backup/config.json config.json

# Restore old scripts
cp backup/scripts/* scripts/
```

**Step 4: Verify Rollback**

```bash
cortexdx --version
cortexdx diagnose https://mcp.example.com
```

## Support

### Community Support

- GitHub Issues: https://github.com/brainwav/cortexdx/issues
- Discussions: https://github.com/brainwav/cortexdx/discussions
- Documentation: https://docs.brainwav.io/cortexdx

### Commercial Support

- Professional: support@brainwav.io
- Enterprise: enterprise@brainwav.io
- Migration Assistance: migration@brainwav.io

## Additional Resources

- [Release Notes](RELEASE_NOTES.md)
- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Commercial Deployment Guide](docs/COMMERCIAL_DEPLOYMENT.md)
- [API Reference](docs/API_REFERENCE.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

---

**Need Help?** Contact our support team or visit our community forums for assistance with your migration.
