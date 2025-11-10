#!/usr/bin/env bash

# CortexDx Auth0 Environment Setup Script
# This script loads Auth0 credentials from 1Password and sets environment variables
# 
# Usage:
#   source scripts/setup-auth0-env.sh
#   ./scripts/setup-auth0-env.sh && source /tmp/cortexdx-auth0.env

set -euo pipefail

readonly VAULT="brAInwav Development"
readonly ITEM="CortexDx • Auth0"
readonly ENV_FILE="/tmp/cortexdx-auth0.env"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    echo -e "${RED}Error: 1Password CLI (op) is not installed${NC}"
    echo "Install it from: https://developer.1password.com/docs/cli/get-started/"
    exit 1
fi

# Check if signed in
if ! op whoami &> /dev/null; then
    echo -e "${YELLOW}1Password CLI is not signed in. Please sign in first:${NC}"
    echo "op signin"
    exit 1
fi

echo -e "${BLUE}🔐 Loading Auth0 credentials from 1Password...${NC}"

# Create temporary environment file
cat > "$ENV_FILE" << EOF
# CortexDx Auth0 Environment Variables
# Generated from 1Password on $(date)
export CORTEXDX_AUTH0_DOMAIN="$(op item get "$ITEM" --vault="$VAULT" --field="Auth0 Domain")"
export CORTEXDX_AUTH0_CLIENT_ID="$(op item get "$ITEM" --vault="$VAULT" --field="username")"
export CORTEXDX_AUTH0_CLIENT_SECRET="$(op item get "$ITEM" --vault="$VAULT" --field="password" --reveal)"
export CORTEXDX_AUTH0_AUDIENCE="$(op item get "$ITEM" --vault="$VAULT" --field="Audience")"
EOF

echo -e "${GREEN}✅ Auth0 environment variables saved to: $ENV_FILE${NC}"
echo ""
echo -e "${YELLOW}To load these variables into your current shell:${NC}"
echo "source $ENV_FILE"
echo ""
echo -e "${YELLOW}To verify the variables are set:${NC}"
echo "env | grep CORTEXDX_AUTH0"
echo ""
echo -e "${YELLOW}To run CortexDx diagnostics:${NC}"
echo "pnpm --dir packages/insula-mcp run build"
echo "node packages/insula-mcp/dist/cli.js diagnose https://cortex-mcp.brainwav.io/mcp --deterministic --full --out reports/auth0-prod"