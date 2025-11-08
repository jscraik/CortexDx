#!/usr/bin/env bash
# Build Docker images for all Insula MCP tiers
# Usage: ./scripts/build-docker-images.sh [version]

set -euo pipefail

VERSION="${1:-1.0.0}"
REGISTRY="${DOCKER_REGISTRY:-brainwav}"
PUSH="${PUSH:-false}"

echo "🐳 Building Insula MCP Docker images v${VERSION}"
echo "Registry: ${REGISTRY}"
echo ""

# Build context is the workspace root
BUILD_CONTEXT="../.."

# Build Community Edition
echo "📦 Building Community Edition..."
docker build \
  -f Dockerfile.community \
  -t "${REGISTRY}/insula-mcp:${VERSION}-community" \
  -t "${REGISTRY}/insula-mcp:latest-community" \
  --build-arg VERSION="${VERSION}" \
  "${BUILD_CONTEXT}"
echo "✅ Community Edition built"
echo ""

# Build Professional Edition
echo "📦 Building Professional Edition..."
docker build \
  -f Dockerfile.professional \
  -t "${REGISTRY}/insula-mcp:${VERSION}-professional" \
  -t "${REGISTRY}/insula-mcp:latest-professional" \
  --build-arg VERSION="${VERSION}" \
  "${BUILD_CONTEXT}"
echo "✅ Professional Edition built"
echo ""

# Build Enterprise Edition
echo "📦 Building Enterprise Edition..."
docker build \
  -f Dockerfile.enterprise \
  -t "${REGISTRY}/insula-mcp:${VERSION}-enterprise" \
  -t "${REGISTRY}/insula-mcp:latest-enterprise" \
  --build-arg VERSION="${VERSION}" \
  "${BUILD_CONTEXT}"
echo "✅ Enterprise Edition built"
echo ""

# Tag latest
echo "🏷️  Tagging latest..."
docker tag "${REGISTRY}/insula-mcp:${VERSION}-community" "${REGISTRY}/insula-mcp:latest"
echo "✅ Latest tag created"
echo ""

# List built images
echo "📋 Built images:"
docker images "${REGISTRY}/insula-mcp" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# Push images if requested
if [ "${PUSH}" = "true" ]; then
  echo "🚀 Pushing images to registry..."
  
  docker push "${REGISTRY}/insula-mcp:${VERSION}-community"
  docker push "${REGISTRY}/insula-mcp:latest-community"
  
  docker push "${REGISTRY}/insula-mcp:${VERSION}-professional"
  docker push "${REGISTRY}/insula-mcp:latest-professional"
  
  docker push "${REGISTRY}/insula-mcp:${VERSION}-enterprise"
  docker push "${REGISTRY}/insula-mcp:latest-enterprise"
  
  docker push "${REGISTRY}/insula-mcp:latest"
  
  echo "✅ All images pushed"
else
  echo "ℹ️  Images built locally. Set PUSH=true to push to registry."
fi

echo ""
echo "🎉 Build complete!"
echo ""
echo "To run locally:"
echo "  docker run -p 3000:3000 ${REGISTRY}/insula-mcp:${VERSION}-community"
echo ""
echo "To push to registry:"
echo "  PUSH=true ./scripts/build-docker-images.sh ${VERSION}"
