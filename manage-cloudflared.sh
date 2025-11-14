#!/bin/bash

set -euo pipefail

SERVICE_NAME="com.brainwav.cortexdx-cloudflared"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/${SERVICE_NAME}.plist"
SERVICE_TARGET="gui/$(id -u)/${SERVICE_NAME}"
LOG_DIR="$HOME/Library/Logs/cortexdx-cloudflared"

usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|install}"
    exit 1
}

check_installed() {
    if [ ! -f "$PLIST_PATH" ]; then
        echo "LaunchAgent not installed. Run ./install-cloudflared.sh first."
        exit 1
    fi
}

case "${1:-}" in
    start)
        check_installed
        launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
        launchctl enable "$SERVICE_TARGET"
        launchctl kickstart -k "$SERVICE_TARGET"
        ;;
    stop)
        check_installed
        launchctl bootout "$SERVICE_TARGET" >/dev/null 2>&1 || true
        ;;
    restart)
        "${0}" stop
        sleep 1
        "${0}" start
        ;;
    status)
        if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
            echo "✅ $SERVICE_NAME is running"
        else
            echo "❌ $SERVICE_NAME is stopped"
        fi
        ;;
    logs)
        mkdir -p "$LOG_DIR"
        tail -f "$LOG_DIR"/*.log
        ;;
    install)
        ./install-cloudflared.sh
        ;;
    *)
        usage
        ;;
esac
