#!/bin/bash

# CortexDx LaunchAgent installer (macOS)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="com.brainwav.cortexdx"
PLIST_FILE="${SERVICE_NAME}.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$REPO_ROOT/packages/insula-mcp"
PLIST_TEMPLATE="$REPO_ROOT/$PLIST_FILE"
LOG_DIR="/var/log"
STDOUT_LOG="$LOG_DIR/cortexdx.log"
STDERR_LOG="$LOG_DIR/cortexdx.error.log"
PORT="${PORT:-5001}"
HOST="${HOST:-127.0.0.1}"
USER_ID="$(id -u)"
SERVICE_TARGET="gui/${USER_ID}/${SERVICE_NAME}"

echo -e "${BLUE}🚀 Installing CortexDx LaunchAgent${NC}"
echo "===================================="

if ! command -v pnpm >/dev/null 2>&1; then
    echo -e "${RED}❌ pnpm is not installed or not on PATH${NC}"
    exit 1
fi

if [ ! -d "$PACKAGE_DIR" ]; then
    echo -e "${RED}❌ Package directory missing: $PACKAGE_DIR${NC}"
    exit 1
fi

if [ ! -f "$PLIST_TEMPLATE" ]; then
    echo -e "${RED}❌ Plist template missing: $PLIST_TEMPLATE${NC}"
    exit 1
fi

PNPM_BIN="$(command -v pnpm)"
NODE_BIN="$(command -v node)"
PNPM_BIN_DIR="$(dirname "$PNPM_BIN")"
NODE_BIN_DIR="$(dirname "$NODE_BIN")"
PATH_VALUE="$PNPM_BIN_DIR:$NODE_BIN_DIR:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
USER_NAME="$(whoami)"
GROUP_NAME="$(id -gn)"

mkdir -p "$LAUNCH_AGENTS_DIR"

RENDERED_PLIST="$(mktemp)"
cleanup() { rm -f "$RENDERED_PLIST"; }
trap cleanup EXIT

export PLIST_TEMPLATE PNPM_BIN PACKAGE_DIR REPO_ROOT PORT HOST PATH_VALUE USER_NAME GROUP_NAME
python3 - <<'PY' > "$RENDERED_PLIST"
import os
from pathlib import Path

template = Path(os.environ["PLIST_TEMPLATE"]).read_text()
mapping = {
    "PNPM_BIN": os.environ["PNPM_BIN"],
    "PACKAGE_DIR": os.environ["PACKAGE_DIR"],
    "PROJECT_DIR": os.environ["REPO_ROOT"],
    "PORT": os.environ["PORT"],
    "HOST": os.environ["HOST"],
    "PATH": os.environ["PATH_VALUE"],
    "USER_NAME": os.environ["USER_NAME"],
    "GROUP_NAME": os.environ["GROUP_NAME"],
}

for key, value in mapping.items():
    template = template.replace(f"__{key}__", value)

print(template, end="")
PY

plutil -lint "$RENDERED_PLIST" >/dev/null

PLIST_DEST="$LAUNCH_AGENTS_DIR/$PLIST_FILE"
cp "$RENDERED_PLIST" "$PLIST_DEST"
chmod 644 "$PLIST_DEST"

sudo mkdir -p "$LOG_DIR"
sudo touch "$STDOUT_LOG" "$STDERR_LOG"
sudo chown "$USER_NAME":"$GROUP_NAME" "$STDOUT_LOG" "$STDERR_LOG"

if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    echo -e "${YELLOW}🛑 Stopping existing CortexDx LaunchAgent...${NC}"
    launchctl bootout "$SERVICE_TARGET" >/dev/null 2>&1 || true
fi

echo -e "${BLUE}📋 Loading CortexDx LaunchAgent...${NC}"
launchctl bootstrap "gui/$USER_ID" "$PLIST_DEST"
launchctl enable "$SERVICE_TARGET"
launchctl kickstart -k "$SERVICE_TARGET"

sleep 3

if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ CortexDx is running under $SERVICE_NAME on http://$HOST:$PORT${NC}"
    echo "Logs: $STDOUT_LOG"
    echo "Errors: $STDERR_LOG"
else
    echo -e "${RED}❌ Failed to start CortexDx. Check $STDERR_LOG for details${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Tip:${NC} This LaunchAgent label is ${SERVICE_NAME}, so it will not conflict with .Cortex-OS profiles (com.brainwav.insula-local-memory)."
