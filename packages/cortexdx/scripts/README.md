# CortexDx Release Scripts

This directory contains scripts for building, publishing, deploying, and experimentally researching CortexDx v1.0.0. Production-ready utilities are documented below; anything marked as **experimental** must never be bundled with release artifacts.

> **Experimental tooling:** `scripts/research-improvements.js` runs academic MCP providers to prototype debugging/codegen ideas. It is for internal research only and should not be invoked in production pipelines.

## Scripts Overview

### build-docker-images.sh

Builds Docker images for all three licensing tiers.

**Usage:**

```bash
# Build all images with default version (1.0.0)
./scripts/build-docker-images.sh

# Build with specific version
./scripts/build-docker-images.sh 1.0.1

# Build and push to registry
PUSH=true ./scripts/build-docker-images.sh 1.0.0

# Use custom registry
DOCKER_REGISTRY=myregistry ./scripts/build-docker-images.sh 1.0.0
```

**Environment Variables:**

- `VERSION`: Version tag for images (default: 1.0.0)
- `DOCKER_REGISTRY`: Docker registry name (default: brainwav)
- `PUSH`: Push images to registry (default: false)

**Output:**

- `brainwav/cortexdx:1.0.0-community`
- `brainwav/cortexdx:1.0.0-professional`
- `brainwav/cortexdx:1.0.0-enterprise`
- `brainwav/cortexdx:latest` (points to community)

### publish-npm.sh

Publishes the package to npm registry.

**Usage:**

```bash
# Dry run (recommended first)
DRY_RUN=true ./scripts/publish-npm.sh 1.0.0

# Actual publish
./scripts/publish-npm.sh 1.0.0

# Publish with specific tag
NPM_TAG=beta ./scripts/publish-npm.sh 1.0.0-beta
```

**Environment Variables:**

- `DRY_RUN`: Test publish without actually publishing (default: false)
- `NPM_TAG`: npm dist-tag (default: latest)

**Prerequisites:**

- Logged in to npm: `npm login`
- Proper permissions for @brainwav organization
- All tests passing
- Clean working directory

**Pre-publish Checks:**

- Verifies version in package.json
- Runs clean build
- Executes test suite
- Runs linter
- Validates dist directory

### quick-deploy.sh

Quick deployment script for testing and development.

**Usage:**

```bash
# Deploy Community Edition
./scripts/quick-deploy.sh community

# Deploy Professional Edition
CORTEXDX_LICENSE_KEY=your-key ./scripts/quick-deploy.sh professional

# Deploy Enterprise Edition
CORTEXDX_LICENSE_KEY=your-key \
AUTH0_DOMAIN=your-domain.auth0.com \
AUTH0_CLIENT_ID=your-client-id \
AUTH0_CLIENT_SECRET=your-secret \
./scripts/quick-deploy.sh enterprise

# Custom port
PORT=8080 ./scripts/quick-deploy.sh community

# Specific version
VERSION=1.0.1 ./scripts/quick-deploy.sh community
```

**Environment Variables:**

- `VERSION`: Docker image version (default: 1.0.0)
- `PORT`: Host port to bind (default: 3000)
- `CORTEXDX_LICENSE_KEY`: License key (required for professional/enterprise)
- `AUTH0_DOMAIN`: Auth0 domain (required for enterprise)
- `AUTH0_CLIENT_ID`: Auth0 client ID (required for enterprise)
- `AUTH0_CLIENT_SECRET`: Auth0 client secret (required for enterprise)
- `OLLAMA_HOST`: Ollama backend host (optional for professional/enterprise)

**Features:**

- Interactive prompts for required credentials
- Automatic volume creation
- Health check verification
- Helpful post-deployment information

## Release Workflow

### 1. Pre-Release Preparation

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Update version in package.json
# Update CHANGELOG.md
# Update RELEASE_NOTES.md

# Run all checks
pnpm lint
pnpm test
pnpm build

# Commit version bump
git add .
git commit -m "chore: bump version to 1.0.0"
git push origin main
```

### 2. Build Docker Images

```bash
# Build all tier images
./scripts/build-docker-images.sh 1.0.0

# Test images locally
docker run -p 3000:3000 brainwav/cortexdx:1.0.0-community
docker run -p 3001:3000 brainwav/cortexdx:1.0.0-professional
docker run -p 3002:3000 brainwav/cortexdx:1.0.0-enterprise

# Push to registry
PUSH=true ./scripts/build-docker-images.sh 1.0.0
```

### 3. Publish to NPM

```bash
# Dry run first
DRY_RUN=true ./scripts/publish-npm.sh 1.0.0

# Review output, then publish
./scripts/publish-npm.sh 1.0.0

# Verify publication
npm view @brainwav/cortexdx
npm install -g @brainwav/cortexdx@1.0.0
cortexdx --version
```

### 4. Create GitHub Release

```bash
# Create and push tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Create GitHub release (manual or via gh CLI)
gh release create v1.0.0 \
  --title "CortexDx v1.0.0" \
  --notes-file RELEASE_NOTES.md \
  --latest
```

### 5. Verify Deployment

```bash
# Test npm package
npx @brainwav/cortexdx@1.0.0 --version
npx @brainwav/cortexdx@1.0.0 diagnose https://example.com

# Test Docker images
./scripts/quick-deploy.sh community
curl http://localhost:3000/health

# Test Professional tier
CORTEXDX_LICENSE_KEY=test-key ./scripts/quick-deploy.sh professional
```

## Troubleshooting

### Docker Build Fails

**Issue:** Build context too large or missing files

**Solution:**

```bash
# Ensure you're in the correct directory
cd packages/cortexdx

# Check .dockerignore is present
cat ../../.dockerignore

# Build from workspace root
cd ../..
docker build -f packages/cortexdx/Dockerfile.community .
```

### NPM Publish Fails

**Issue:** Not logged in or insufficient permissions

**Solution:**

```bash
# Login to npm
npm login

# Verify login
npm whoami

# Check organization membership
npm org ls brainwav

# Request access if needed
```

### Version Mismatch

**Issue:** package.json version doesn't match release version

**Solution:**

```bash
# Update package.json version
npm version 1.0.0 --no-git-tag-version

# Or manually edit package.json
# Then commit changes
git add package.json
git commit -m "chore: bump version to 1.0.0"
```

### Docker Push Fails

**Issue:** Not logged in to Docker Hub

**Solution:**

```bash
# Login to Docker Hub
docker login

# Verify login
docker info | grep Username

# Push specific image
docker push brainwav/cortexdx:1.0.0-community
```

## CI/CD Integration

These scripts are designed to work with CI/CD pipelines:

### GitHub Actions

```yaml
- name: Build Docker Images
  run: |
    cd packages/cortexdx
    ./scripts/build-docker-images.sh ${{ github.ref_name }}
  env:
    PUSH: true
    DOCKER_REGISTRY: brainwav

- name: Publish to NPM
  run: |
    cd packages/cortexdx
    ./scripts/publish-npm.sh ${{ github.ref_name }}
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### GitLab CI

```yaml
build-docker:
  script:
    - cd packages/cortexdx
    - ./scripts/build-docker-images.sh $CI_COMMIT_TAG
  variables:
    PUSH: "true"
    DOCKER_REGISTRY: brainwav

publish-npm:
  script:
    - cd packages/cortexdx
    - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
    - ./scripts/publish-npm.sh $CI_COMMIT_TAG
```

## Security Considerations

### Credentials

- Never commit credentials to version control
- Use environment variables for sensitive data
- Use CI/CD secrets for automated deployments
- Rotate credentials regularly

### Docker Images

- Images are scanned for vulnerabilities
- Base images are regularly updated
- Non-root user for container execution
- Minimal attack surface

### NPM Package

- Two-factor authentication required
- Package signing enabled
- Automated security scanning
- Dependency vulnerability checks

## Support

For issues with release scripts:

- GitHub Issues: https://github.com/brainwav/cortexdx/issues
- Email: support@brainwav.io
- Documentation: https://docs.brainwav.io/cortexdx
