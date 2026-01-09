#!/bin/bash

# CortexDx LaunchAgent uninstallation script

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="com.brainwav.cortexdx"
PLIST_FILE="${SERVICE_NAME}.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
USER_ID="$(id -u)"
SERVICE_TARGET="gui/${USER_ID}/${SERVICE_NAME}"
LOG_PATTERN="/var/log/cortexdx*.log"

echo -e "${BLUE}🗑️  Uninstalling CortexDx LaunchAgent${NC}"
echo "======================================="

PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_FILE"

if [ ! -f "$PLIST_PATH" ]; then
    echo -e "${YELLOW}⚠️  $SERVICE_NAME is not installed${NC}"
    exit 0
fi

echo -e "${YELLOW}🛑 Stopping CortexDx service...${NC}"
launchctl bootout "$SERVICE_TARGET" >/dev/null 2>&1 || true

echo -e "${BLUE}📋 Removing $PLIST_PATH...${NC}"
rm -f "$PLIST_PATH"

if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    echo -e "${RED}❌ Service is still registered. Re-run uninstall after confirming no other LaunchAgent reloaded it.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ CortexDx LaunchAgent removed${NC}"
echo ""
echo -e "${BLUE}Log files are preserved at:${NC}"
echo "  $LOG_PATTERN"
echo "Remove them manually if desired: sudo rm $LOG_PATTERN"
