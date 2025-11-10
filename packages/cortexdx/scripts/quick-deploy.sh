#!/usr/bin/env bash
# Quick deployment script for CortexDx
# Usage: ./scripts/quick-deploy.sh [tier] [options]

set -euo pipefail

TIER="${1:-community}"
VERSION="${VERSION:-1.0.0}"
PORT="${PORT:-3000}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CortexDx Quick Deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Validate tier
if [[ ! "$TIER" =~ ^(community|professional|enterprise)$ ]]; then
  echo -e "${RED}❌ Error: Invalid tier '$TIER'${NC}"
  echo "Valid tiers: community, professional, enterprise"
  exit 1
fi

echo -e "${GREEN}Tier:${NC} $TIER"
echo -e "${GREEN}Version:${NC} $VERSION"
echo -e "${GREEN}Port:${NC} $PORT"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Error: Docker is not installed${NC}"
  echo "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

# Check if container is already running
CONTAINER_NAME="cortexdx-${TIER}"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo -e "${YELLOW}⚠️  Container '${CONTAINER_NAME}' already exists${NC}"
  read -p "Remove existing container? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Removing existing container..."
    docker rm -f "${CONTAINER_NAME}"
  else
    echo "Aborted."
    exit 0
  fi
fi

# Pull latest image
echo ""
echo -e "${BLUE}📦 Pulling Docker image...${NC}"
docker pull "brainwav/cortexdx:${VERSION}-${TIER}"

# Prepare environment variables
ENV_VARS="-e NODE_ENV=production -e CORTEXDX_MCP_TIER=${TIER}"

# Tier-specific configuration
case "$TIER" in
  professional)
    echo ""
    echo -e "${YELLOW}Professional tier requires:${NC}"
    echo "  - License key (CORTEXDX_LICENSE_KEY)"
    echo "  - Ollama backend (optional)"
    echo ""
    
    if [ -z "${CORTEXDX_LICENSE_KEY:-}" ]; then
      read -p "Enter license key: " LICENSE_KEY
      ENV_VARS="$ENV_VARS -e CORTEXDX_LICENSE_KEY=${LICENSE_KEY}"
    else
      ENV_VARS="$ENV_VARS -e CORTEXDX_LICENSE_KEY=${CORTEXDX_LICENSE_KEY}"
    fi
    
    if [ -n "${OLLAMA_HOST:-}" ]; then
      ENV_VARS="$ENV_VARS -e OLLAMA_HOST=${OLLAMA_HOST}"
    fi
    ;;
    
  enterprise)
    echo ""
    echo -e "${YELLOW}Enterprise tier requires:${NC}"
    echo "  - License key (CORTEXDX_LICENSE_KEY)"
    echo "  - Auth0 credentials"
    echo "  - Database configuration"
    echo ""
    
    if [ -z "${CORTEXDX_LICENSE_KEY:-}" ]; then
      read -p "Enter license key: " LICENSE_KEY
      ENV_VARS="$ENV_VARS -e CORTEXDX_LICENSE_KEY=${LICENSE_KEY}"
    else
      ENV_VARS="$ENV_VARS -e CORTEXDX_LICENSE_KEY=${CORTEXDX_LICENSE_KEY}"
    fi
    
    if [ -z "${AUTH0_DOMAIN:-}" ]; then
      read -p "Enter Auth0 domain: " AUTH0_DOMAIN
      ENV_VARS="$ENV_VARS -e AUTH0_DOMAIN=${AUTH0_DOMAIN}"
    else
      ENV_VARS="$ENV_VARS -e AUTH0_DOMAIN=${AUTH0_DOMAIN}"
    fi
    
    if [ -z "${AUTH0_CLIENT_ID:-}" ]; then
      read -p "Enter Auth0 client ID: " AUTH0_CLIENT_ID
      ENV_VARS="$ENV_VARS -e AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID}"
    else
      ENV_VARS="$ENV_VARS -e AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID}"
    fi
    
    if [ -z "${AUTH0_CLIENT_SECRET:-}" ]; then
      read -sp "Enter Auth0 client secret: " AUTH0_CLIENT_SECRET
      echo ""
      ENV_VARS="$ENV_VARS -e AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET}"
    else
      ENV_VARS="$ENV_VARS -e AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET}"
    fi
    ;;
esac

# Create volumes
echo ""
echo -e "${BLUE}📁 Creating volumes...${NC}"
docker volume create "cortexdx-data-${TIER}" > /dev/null
docker volume create "cortexdx-logs-${TIER}" > /dev/null

if [[ "$TIER" != "community" ]]; then
  docker volume create "cortexdx-models-${TIER}" > /dev/null
  docker volume create "cortexdx-patterns-${TIER}" > /dev/null
fi

# Run container
echo ""
echo -e "${BLUE}🚀 Starting container...${NC}"

VOLUME_MOUNTS="-v cortexdx-data-${TIER}:/app/data -v cortexdx-logs-${TIER}:/app/logs"
if [[ "$TIER" != "community" ]]; then
  VOLUME_MOUNTS="$VOLUME_MOUNTS -v cortexdx-models-${TIER}:/app/models -v cortexdx-patterns-${TIER}:/app/patterns"
fi

docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT}:3000" \
  $ENV_VARS \
  $VOLUME_MOUNTS \
  --restart unless-stopped \
  "brainwav/cortexdx:${VERSION}-${TIER}"

# Wait for container to be healthy
echo ""
echo -e "${BLUE}⏳ Waiting for container to be healthy...${NC}"
sleep 5

# Check health
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Container is healthy!${NC}"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo -n "."
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo ""
  echo -e "${RED}❌ Container failed to become healthy${NC}"
  echo "Check logs with: docker logs ${CONTAINER_NAME}"
  exit 1
fi

# Success message
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ CortexDx ${TIER} edition deployed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 Container Information:${NC}"
echo "  Name: ${CONTAINER_NAME}"
echo "  Port: ${PORT}"
echo "  URL: http://localhost:${PORT}"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "  View logs:    docker logs -f ${CONTAINER_NAME}"
echo "  Stop:         docker stop ${CONTAINER_NAME}"
echo "  Start:        docker start ${CONTAINER_NAME}"
echo "  Restart:      docker restart ${CONTAINER_NAME}"
echo "  Remove:       docker rm -f ${CONTAINER_NAME}"
echo "  Shell:        docker exec -it ${CONTAINER_NAME} sh"
echo ""
echo -e "${BLUE}🧪 Test the deployment:${NC}"
echo "  curl http://localhost:${PORT}/health"
echo "  docker exec ${CONTAINER_NAME} cortexdx --version"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "  Getting Started: https://docs.brainwav.io/cortexdx/getting-started"
echo "  User Guide:      https://docs.brainwav.io/cortexdx/user-guide"
echo "  API Reference:   https://docs.brainwav.io/cortexdx/api-reference"
echo ""
