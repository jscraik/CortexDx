#!/bin/bash

# Insula MCP Service Installation Script
# This script sets up the Insula MCP server as a macOS launchd service

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
PROJECT_DIR="/Volumes/ExternalSSD/dev/insula-mcp"

echo -e "${BLUE}🚀 Installing Insula MCP Service${NC}"
echo "=================================="

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ Error: pnpm is not installed or not in PATH${NC}"
    echo "Please install pnpm first: npm install -g pnpm"
    exit 1
fi

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Error: Project directory not found: $PROJECT_DIR${NC}"
    echo "Please update the PROJECT_DIR in this script to match your installation path"
    exit 1
fi

# Check if plist file exists
if [ ! -f "$PLIST_FILE" ]; then
    echo -e "${RED}❌ Error: Plist file not found: $PLIST_FILE${NC}"
    echo "Please ensure the plist file is in the current directory"
    exit 1
fi

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"

# Stop existing service if running
echo -e "${YELLOW}🛑 Stopping existing service (if running)...${NC}"
launchctl unload "$LAUNCH_AGENTS_DIR/$PLIST_FILE" 2>/dev/null || true

# Copy plist file to LaunchAgents
echo -e "${BLUE}📋 Installing service configuration...${NC}"
cp "$PLIST_FILE" "$LAUNCH_AGENTS_DIR/"

# Set proper permissions
chmod 644 "$LAUNCH_AGENTS_DIR/$PLIST_FILE"

# Create log directory
sudo mkdir -p /var/log
sudo touch /var/log/insula-mcp.log
sudo touch /var/log/insula-mcp.error.log
sudo chown $(whoami):staff /var/log/insula-mcp.log
sudo chown $(whoami):staff /var/log/insula-mcp.error.log

# Load and start the service
echo -e "${BLUE}🔄 Loading and starting service...${NC}"
launchctl load "$LAUNCH_AGENTS_DIR/$PLIST_FILE"

# Wait a moment for service to start
sleep 3

# Check if service is running
if launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${GREEN}✅ Service installed and started successfully!${NC}"
    echo ""
    echo -e "${BLUE}Service Information:${NC}"
    echo "  Name: $SERVICE_NAME"
    echo "  Port: 5001"
    echo "  URL:  http://127.0.0.1:5001"
    echo "  Logs: /var/log/insula-mcp.log"
    echo "  Errors: /var/log/insula-mcp.error.log"
    echo ""
    echo -e "${BLUE}Service Management Commands:${NC}"
    echo "  Start:   launchctl load $LAUNCH_AGENTS_DIR/$PLIST_FILE"
    echo "  Stop:    launchctl unload $LAUNCH_AGENTS_DIR/$PLIST_FILE"
    echo "  Status:  launchctl list | grep $SERVICE_NAME"
    echo "  Logs:    tail -f /var/log/insula-mcp.log"
    echo ""
    echo -e "${GREEN}🎉 The Insula MCP server will now start automatically on boot!${NC}"
else
    echo -e "${RED}❌ Service installation failed${NC}"
    echo "Check the logs for more information:"
    echo "  tail -f /var/log/insula-mcp.error.log"
    exit 1
fi