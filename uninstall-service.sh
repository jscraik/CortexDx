#!/bin/bash

# Insula MCP Service Uninstallation Script
# This script removes the Insula MCP launchd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="com.brainwav.insula-mcp"
PLIST_FILE="${SERVICE_NAME}.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

echo -e "${BLUE}🗑️  Uninstalling Insula MCP Service${NC}"
echo "===================================="

# Check if service is installed
if [ ! -f "$LAUNCH_AGENTS_DIR/$PLIST_FILE" ]; then
    echo -e "${YELLOW}⚠️  Service is not installed${NC}"
    exit 0
fi

# Stop and unload the service
echo -e "${YELLOW}🛑 Stopping service...${NC}"
launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_FILE" 2>/dev/null || true

# Remove plist file
echo -e "${BLUE}📋 Removing service configuration...${NC}"
rm -f "$LAUNCH_AGENTS_DIR/$PLIST_FILE"

# Check if service is removed
if ! launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service uninstalled successfully!${NC}"
    echo ""
    echo -e "${BLUE}Note:${NC} Log files are preserved at:"
    echo "  /var/log/insula-mcp.log"
    echo "  /var/log/insula-mcp.error.log"
    echo ""
    echo "To remove log files, run:"
    echo "  sudo rm /var/log/insula-mcp.log /var/log/insula-mcp.error.log"
else
    echo -e "${RED}❌ Service uninstallation failed${NC}"
    echo "The service may still be running. Try:"
    echo "  launchctl unload $LAUNCH_AGENTS_DIR/$PLIST_FILE"
    exit 1
fi