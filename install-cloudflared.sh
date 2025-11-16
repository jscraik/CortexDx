#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVICE_NAME="com.brainwav.cortexdx-cloudflared"
PLIST_FILE="${SERVICE_NAME}.plist"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_TEMPLATE="$REPO_ROOT/$PLIST_FILE"
LOG_DIR="$HOME/Library/Logs/cortexdx-cloudflared"
USER_ID="$(id -u)"
SERVICE_TARGET="gui/${USER_ID}/${SERVICE_NAME}"
CLOUDFLARED_CONFIG="${CORTEXDX_CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"

parse_tunnel() {
    python3 - "$CLOUDFLARED_CONFIG" <<'PY'
import sys
from pathlib import Path
config = Path(sys.argv[1])
if not config.exists():
    sys.exit(1)
for line in config.read_text().splitlines():
    stripped = line.strip()
    if stripped.startswith('tunnel:'):
        print(stripped.split(':', 1)[1].strip())
        break
PY
}

CLOUDFLARED_TOKEN="${CORTEXDX_CLOUDFLARED_TOKEN:-${CLOUDFLARE_TUNNEL_TOKEN:-}}"
TUNNEL_NAME="${CORTEXDX_CLOUDFLARED_TUNNEL:-}"

# Token-based authentication doesn't require a tunnel name
if [ -z "$CLOUDFLARED_TOKEN" ]; then
    if [ -z "$TUNNEL_NAME" ]; then
        TUNNEL_NAME="$(parse_tunnel 2>/dev/null || true)"
    fi

    if [ -z "$TUNNEL_NAME" ]; then
        echo -e "${RED}❌ Unable to determine tunnel name. Either:${NC}"
        echo -e "${RED}   - Set CLOUDFLARE_TUNNEL_TOKEN or CORTEXDX_CLOUDFLARED_TOKEN for token-based auth, or${NC}"
        echo -e "${RED}   - Set CORTEXDX_CLOUDFLARED_TUNNEL or add 'tunnel:' to $CLOUDFLARED_CONFIG${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}Using token-based authentication (tunnel name not required)${NC}"
    TUNNEL_NAME=""
fi

echo -e "${BLUE}🚀 Installing CortexDx Cloudflare Tunnel LaunchAgent${NC}"
echo "==============================================="

if ! command -v cloudflared >/dev/null 2>&1; then
    echo -e "${RED}❌ cloudflared is not installed${NC}"
    exit 1
fi

if [ -z "$CLOUDFLARED_TOKEN" ] && [ ! -f "$CLOUDFLARED_CONFIG" ]; then
    echo -e "${RED}❌ Tunnel config not found: $CLOUDFLARED_CONFIG${NC}"
    echo -e "${RED}   Set CLOUDFLARE_TUNNEL_TOKEN or CORTEXDX_CLOUDFLARED_TOKEN for token-based auth${NC}"
    exit 1
fi

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

PATH_VALUE="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

RENDERED_PLIST="$(mktemp)"
cleanup() { rm -f "$RENDERED_PLIST"; }
trap cleanup EXIT

export PLIST_TEMPLATE REPO_ROOT PATH_VALUE LOG_DIR CLOUDFLARED_CONFIG TUNNEL_NAME CLOUDFLARED_TOKEN
python3 - <<'PY' > "$RENDERED_PLIST"
import os
from pathlib import Path

template = Path(os.environ['PLIST_TEMPLATE']).read_text()
mapping = {
    'PROJECT_DIR': os.environ['REPO_ROOT'],
    'PATH': os.environ['PATH_VALUE'],
    'LOG_DIR': os.environ['LOG_DIR'],
    'CLOUDFLARED_CONFIG': os.environ['CLOUDFLARED_CONFIG'],
    'CLOUDFLARED_TUNNEL': os.environ['TUNNEL_NAME'],
    'CLOUDFLARED_TOKEN': os.environ.get('CLOUDFLARED_TOKEN', ''),
}

for key, value in mapping.items():
    template = template.replace(f"__{key}__", value)

print(template, end='')
PY

plutil -lint "$RENDERED_PLIST" >/dev/null

PLIST_DEST="$LAUNCH_AGENTS_DIR/$PLIST_FILE"
cp "$RENDERED_PLIST" "$PLIST_DEST"
chmod 644 "$PLIST_DEST"

if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    echo -e "${BLUE}Reloading existing tunnel LaunchAgent...${NC}"
    launchctl bootout "$SERVICE_TARGET" >/dev/null 2>&1 || true
fi

launchctl bootstrap "gui/$USER_ID" "$PLIST_DEST"
launchctl enable "$SERVICE_TARGET"
launchctl kickstart -k "$SERVICE_TARGET"

sleep 2

if launchctl print "$SERVICE_TARGET" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ cloudflared tunnel managed by $SERVICE_NAME${NC}"
    echo "Logs live in $LOG_DIR"
else
    echo -e "${RED}❌ Failed to start cloudflared via LaunchAgent${NC}"
    exit 1
fi
