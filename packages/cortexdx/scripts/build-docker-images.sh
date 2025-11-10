#!/usr/bin/env bash
# Build Docker images for all CortexDx tiers
# Usage: ./scripts/build-docker-images.sh [version]

set -euo pipefail

VERSION="${1:-1.0.0}"
REGISTRY="${DOCKER_REGISTRY:-brainwav}"
PUSH="${PUSH:-false}"

echo "🐳 Building CortexDx Docker images v${VERSION}"
echo "Registry: ${REGISTRY}"
echo ""

# Build context is the workspace root
BUILD_CONTEXT="../.."

# Build Community Edition
echo "📦 Building Community Edition..."
docker build \
  -f Dockerfile.community \
  -t "${REGISTRY}/cortexdx:${VERSION}-community" \
  -t "${REGISTRY}/cortexdx:latest-community" \
  --build-arg VERSION="${VERSION}" \
  "${BUILD_CONTEXT}"
echo "✅ Community Edition built"
echo ""

# Build Professional Edition
echo "📦 Building Professional Edition..."
docker build \
  -f Dockerfile.professional \
  -t "${REGISTRY}/cortexdx:${VERSION}-professional" \
  -t "${REGISTRY}/cortexdx:latest-professional" \
  --build-arg VERSION="${VERSION}" \
  "${BUILD_CONTEXT}"
echo "✅ Professional Edition built"
echo ""

# Build Enterprise Edition
echo "📦 Building Enterprise Edition..."
docker build \
  -f Dockerfile.enterprise \
  -t "${REGISTRY}/cortexdx:${VERSION}-enterprise" \
  -t "${REGISTRY}/cortexdx:latest-enterprise" \
  --build-arg VERSION="${VERSION}" \
  "${BUILD_CONTEXT}"
echo "✅ Enterprise Edition built"
echo ""

# Tag latest
echo "🏷️  Tagging latest..."
docker tag "${REGISTRY}/cortexdx:${VERSION}-community" "${REGISTRY}/cortexdx:latest"
echo "✅ Latest tag created"
echo ""

# List built images
echo "📋 Built images:"
docker images "${REGISTRY}/cortexdx" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# Push images if requested
if [ "${PUSH}" = "true" ]; then
  echo "🚀 Pushing images to registry..."
  
  docker push "${REGISTRY}/cortexdx:${VERSION}-community"
  docker push "${REGISTRY}/cortexdx:latest-community"
  
  docker push "${REGISTRY}/cortexdx:${VERSION}-professional"
  docker push "${REGISTRY}/cortexdx:latest-professional"
  
  docker push "${REGISTRY}/cortexdx:${VERSION}-enterprise"
  docker push "${REGISTRY}/cortexdx:latest-enterprise"
  
  docker push "${REGISTRY}/cortexdx:latest"
  
  echo "✅ All images pushed"
else
  echo "ℹ️  Images built locally. Set PUSH=true to push to registry."
fi

echo ""
echo "🎉 Build complete!"
echo ""
echo "To run locally:"
echo "  docker run -p 3000:3000 ${REGISTRY}/cortexdx:${VERSION}-community"
echo ""
echo "To push to registry:"
echo "  PUSH=true ./scripts/build-docker-images.sh ${VERSION}"
