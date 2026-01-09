#!/bin/bash

# CortexDx LaunchAgent management

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="com.brainwav.cortexdx"
PLIST_FILE="${SERVICE_NAME}.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_FILE"
USER_ID="$(id -u)"
SERVICE_TARGET="gui/${USER_ID}/${SERVICE_NAME}"

show_usage() {
    echo -e "${BLUE}CortexDx LaunchAgent Manager${NC}"
    echo "========================="
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs|install|uninstall}"
    echo ""
    echo "Commands:"
    echo "  start     - Start the service"
    echo "  stop      - Stop the service"
    echo "  restart   - Restart the service"
    echo "  status    - Show service status"
    echo "  logs      - Show service logs (live tail)"
    echo "  install   - Install the service"
    echo "  uninstall - Uninstall the service"
    echo ""
}

check_service_installed() {
    if [ ! -f "$PLIST_PATH" ]; then
        echo -e "${RED}❌ Service is not installed${NC}"
        echo "Run: $0 install"
        exit 1
    fi
}

bootout_service() {
    launchctl bootout "$SERVICE_TARGET" >/dev/null 2>&1 || true
}

service_start() {
    check_service_installed
    echo -e "${BLUE}🚀 Starting CortexDx service...${NC}"
    bootout_service
    launchctl bootstrap "gui/$USER_ID" "$PLIST_PATH"
    launchctl enable "$SERVICE_TARGET"
    launchctl kickstart -k "$SERVICE_TARGET"
    sleep 2
    service_status
}

service_stop() {
    check_service_installed
    echo -e "${YELLOW}🛑 Stopping CortexDx service...${NC}"
    bootout_service
    echo -e "${GREEN}✅ Service stopped${NC}"
}

service_restart() {
    echo -e "${BLUE}🔄 Restarting CortexDx service...${NC}"
    service_stop
    sleep 2
    service_start
}

service_status() {
    if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Service is running${NC}"
        echo ""
        echo -e "${BLUE}Service Details:${NC}"
        launchctl print "$SERVICE_TARGET" | rg -e "state" -e "pid" || true
        echo ""
        echo -e "${BLUE}Test Connection:${NC}"
        if curl -s http://127.0.0.1:5001/health > /dev/null; then
            echo -e "${GREEN}✅ Server is responding on http://127.0.0.1:5001${NC}"
        else
            echo -e "${RED}❌ Server is not responding on http://127.0.0.1:5001${NC}"
        fi
    else
        echo -e "${RED}❌ Service is not running${NC}"
    fi
}

service_logs() {
    echo -e "${BLUE}📋 Showing CortexDx logs (Ctrl+C to exit)...${NC}"
    echo "=============================================="
    if [ -f "/var/log/cortexdx.log" ]; then
        tail -f /var/log/cortexdx.log
    else
        echo -e "${RED}❌ Log file not found: /var/log/cortexdx.log${NC}"
    fi
}

service_install() {
    if [ -f "./install-service.sh" ]; then
        ./install-service.sh
    else
        echo -e "${RED}❌ install-service.sh not found in current directory${NC}"
        exit 1
    fi
}

service_uninstall() {
    if [ -f "./uninstall-service.sh" ]; then
        ./uninstall-service.sh
    else
        echo -e "${RED}❌ uninstall-service.sh not found in current directory${NC}"
        exit 1
    fi
}

# Main command handling
case "$1" in
    start)
        service_start
        ;;
    stop)
        service_stop
        ;;
    restart)
        service_restart
        ;;
    status)
        service_status
        ;;
    logs)
        service_logs
        ;;
    install)
        service_install
        ;;
    uninstall)
        service_uninstall
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
