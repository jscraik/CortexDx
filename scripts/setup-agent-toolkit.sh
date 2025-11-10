#!/usr/bin/env bash

# Agent Toolkit Package Setup Script
# This script adds just the agent-toolkit package from Cortex-OS using git subtree

set -euo pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Check if git URL is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Git URL required${NC}"
    echo ""
    echo "Usage: $0 <git-url> [package-path]"
    echo ""
    echo "Examples:"
    echo "  $0 https://github.com/jscraik/Cortex-OS.git packages/agent-toolkit"
    echo "  $0 https://github.com/jscraik/Cortex-OS.git agent-toolkit"
    exit 1
fi

readonly GIT_URL="$1"
readonly SOURCE_PACKAGE_PATH="${2:-packages/agent-toolkit}"  # Default path in Cortex-OS
readonly TARGET_PATH="packages/agent-toolkit"

echo -e "${BLUE}🔧 Setting up agent-toolkit package from Cortex-OS...${NC}"
echo -e "${BLUE}Source: $GIT_URL:$SOURCE_PACKAGE_PATH${NC}"
echo -e "${BLUE}Target: $TARGET_PATH${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    echo -e "${RED}Error: Must be run from CortexDx repository root${NC}"
    exit 1
fi

# Check if target directory already exists
if [ -d "$TARGET_PATH" ]; then
    echo -e "${YELLOW}⚠️  Target directory already exists: $TARGET_PATH${NC}"
    read -p "Remove existing directory and continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$TARGET_PATH"
        echo -e "${GREEN}✅ Removed existing directory${NC}"
    else
        echo "Aborted."
        exit 1
    fi
fi

# Step 1: Add the package using git subtree
echo -e "${BLUE}📦 Adding agent-toolkit package via git subtree...${NC}"

# Create a temporary directory to work with the source repo
TEMP_DIR=$(mktemp -d)
echo -e "${BLUE}📁 Using temporary directory: $TEMP_DIR${NC}"

# Clone the source repository
echo -e "${BLUE}📥 Cloning source repository...${NC}"
if git clone "$GIT_URL" "$TEMP_DIR/cortex-os"; then
    echo -e "${GREEN}✅ Repository cloned successfully${NC}"
else
    echo -e "${RED}❌ Failed to clone repository${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Check if the source package path exists
if [ ! -d "$TEMP_DIR/cortex-os/$SOURCE_PACKAGE_PATH" ]; then
    echo -e "${RED}❌ Package path not found: $SOURCE_PACKAGE_PATH${NC}"
    echo "Available directories in repo:"
    ls -la "$TEMP_DIR/cortex-os/"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Copy the package to our target location
echo -e "${BLUE}📋 Copying package to $TARGET_PATH...${NC}"
mkdir -p "$(dirname "$TARGET_PATH")"
cp -r "$TEMP_DIR/cortex-os/$SOURCE_PACKAGE_PATH" "$TARGET_PATH"

# Clean up temp directory
rm -rf "$TEMP_DIR"

if [ -f "$TARGET_PATH/package.json" ]; then
    echo -e "${GREEN}✅ Agent-toolkit package copied successfully${NC}"
else
    echo -e "${RED}❌ Failed to copy package or package.json not found${NC}"
    exit 1
fi

# Step 2: Install dependencies
echo -e "${BLUE}📦 Installing pnpm dependencies...${NC}"
if pnpm install; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  pnpm install failed - you may need to run it manually${NC}"
fi

# Step 3: Commit the changes
echo -e "${BLUE}📝 Committing agent-toolkit package addition...${NC}"
if git add . && git commit -m "feat: add agent-toolkit package from Cortex-OS

- Copied agent-toolkit package from $GIT_URL:$SOURCE_PACKAGE_PATH
- Updated insula-mcp package.json to use file dependency
- Agent-toolkit is now available for import in CortexDx code"; then
    echo -e "${GREEN}✅ Changes committed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Commit failed - you may need to commit manually${NC}"
fi

# Step 4: Verify setup
echo -e "${BLUE}🔍 Verifying setup...${NC}"

if [ -f "$TARGET_PATH/package.json" ]; then
    echo -e "${GREEN}✅ Agent-toolkit package.json found${NC}"
    # Show package info
    PACKAGE_NAME=$(jq -r '.name' "$TARGET_PATH/package.json" 2>/dev/null || echo "unknown")
    PACKAGE_VERSION=$(jq -r '.version' "$TARGET_PATH/package.json" 2>/dev/null || echo "unknown")
    echo -e "${BLUE}📦 Package: $PACKAGE_NAME@$PACKAGE_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Agent-toolkit package.json not found${NC}"
fi

# Check if symlink exists in node_modules
if [ -L "packages/cortexdx/node_modules/agent-toolkit" ]; then
    echo -e "${GREEN}✅ pnpm symlink created${NC}"
else
    echo -e "${YELLOW}⚠️  pnpm symlink not found - run 'pnpm install' if needed${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Agent-toolkit package setup complete!${NC}"
echo ""
echo -e "${BLUE}Usage in code:${NC}"
echo "import { createAgentToolkit } from 'agent-toolkit';"
echo ""
echo -e "${BLUE}To update agent-toolkit in the future:${NC}"
echo "1. Re-run this script with the latest Cortex-OS URL"
echo "2. Or manually copy updated files from Cortex-OS repository"