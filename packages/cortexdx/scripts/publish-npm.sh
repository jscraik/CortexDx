#!/usr/bin/env bash
# Publish Insula MCP to npm registry
# Usage: ./scripts/publish-npm.sh [version]

set -euo pipefail

VERSION="${1:-1.0.0}"
DRY_RUN="${DRY_RUN:-false}"
NPM_TAG="${NPM_TAG:-latest}"

echo "📦 Publishing Insula MCP v${VERSION} to npm"
echo "Tag: ${NPM_TAG}"
echo "Dry run: ${DRY_RUN}"
echo ""

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found. Run from packages/insula-mcp directory."
  exit 1
fi

# Verify version in package.json matches
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "${PACKAGE_VERSION}" != "${VERSION}" ]; then
  echo "❌ Error: Version mismatch. package.json has ${PACKAGE_VERSION}, expected ${VERSION}"
  exit 1
fi

# Run pre-publish checks
echo "🔍 Running pre-publish checks..."
echo ""

# Check if we're logged in to npm
if ! npm whoami &> /dev/null; then
  echo "❌ Error: Not logged in to npm. Run 'npm login' first."
  exit 1
fi

# Clean and build
echo "🧹 Cleaning..."
pnpm clean
echo ""

echo "🔨 Building..."
pnpm build
echo ""

# Run tests
echo "🧪 Running tests..."
pnpm test
echo ""

# Run linting
echo "🔍 Running linter..."
pnpm lint
echo ""

# Verify dist directory exists and has content
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
  echo "❌ Error: dist directory is empty or doesn't exist"
  exit 1
fi

echo "✅ All pre-publish checks passed"
echo ""

# Show what will be published
echo "📋 Files to be published:"
npm pack --dry-run
echo ""

# Publish or dry run
if [ "${DRY_RUN}" = "true" ]; then
  echo "🔍 Dry run - not publishing"
  npm publish --dry-run --tag "${NPM_TAG}"
  echo ""
  echo "ℹ️  This was a dry run. Set DRY_RUN=false to actually publish."
else
  echo "🚀 Publishing to npm..."
  npm publish --tag "${NPM_TAG}" --access public
  echo ""
  echo "✅ Published @brainwav/insula-mcp@${VERSION}"
  echo ""
  echo "📦 Package available at:"
  echo "   https://www.npmjs.com/package/@brainwav/insula-mcp"
  echo ""
  echo "Install with:"
  echo "   npm install -g @brainwav/insula-mcp@${VERSION}"
fi

echo ""
echo "🎉 Publish process complete!"
