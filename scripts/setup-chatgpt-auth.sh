#!/bin/bash
# Simple setup for CortexDx ChatGPT connection with Auth0

set -e

echo "🚀 CortexDx ChatGPT Connection Setup"
echo "===================================="
echo ""

TENANT="brainwav.uk.auth0.com"
API_IDENTIFIER="https://api.cortexdx.dev"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Auth0 Dashboard Setup (Manual)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://manage.auth0.com/dashboard/us/brainwav/"
echo ""
echo "2. Create an API (Applications > APIs > Create API):"
echo "   • Name: CortexDx MCP Server"
echo "   • Identifier: $API_IDENTIFIER"
echo "   • Signing Algorithm: RS256"
echo "   • Enable 'Allow Offline Access': YES"
echo ""
echo "3. Add Permissions (API > Permissions tab):"
echo "   • execute:tools - Execute MCP tools"
echo "   • read:diagnostics - Read diagnostic information"
echo "   • read:health - Read health status"
echo ""
echo "4. Create Application (Applications > Create Application):"
echo "   • Name: ChatGPT CortexDx"
echo "   • Type: Regular Web Application"
echo ""
echo "5. Configure Application (Settings tab):"
echo "   • Allowed Callback URLs: https://chat.openai.com/aip/plugin-callback"
echo "   • Allowed Web Origins: https://chat.openai.com"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Press Enter when you've completed the Auth0 setup..."
echo ""

# Prompt for credentials
read -p "Enter your Auth0 Client ID: " CLIENT_ID
read -sp "Enter your Auth0 Client Secret: " CLIENT_SECRET
echo ""

echo ""
echo "📝 Updating .env file..."
ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
    cp .env.example "$ENV_FILE"
    echo "✅ Created .env from .env.example"
fi

# Create backup
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%s)"

# Update configuration using a more reliable method
{
    grep -v "^AUTH0_DOMAIN=" "$ENV_FILE" || true
    echo "AUTH0_DOMAIN=$TENANT"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^AUTH0_CLIENT_ID=" "$ENV_FILE" || true
    echo "AUTH0_CLIENT_ID=$CLIENT_ID"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^AUTH0_AUDIENCE=" "$ENV_FILE" || true
    echo "AUTH0_AUDIENCE=$API_IDENTIFIER"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^CORTEXDX_AUTH0_DOMAIN=" "$ENV_FILE" || true
    echo "CORTEXDX_AUTH0_DOMAIN=$TENANT"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^CORTEXDX_AUTH0_CLIENT_ID=" "$ENV_FILE" || true
    echo "CORTEXDX_AUTH0_CLIENT_ID=$CLIENT_ID"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^CORTEXDX_AUTH0_CLIENT_SECRET=" "$ENV_FILE" || true
    echo "CORTEXDX_AUTH0_CLIENT_SECRET=$CLIENT_SECRET"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^CORTEXDX_AUTH0_AUDIENCE=" "$ENV_FILE" || true
    echo "CORTEXDX_AUTH0_AUDIENCE=$API_IDENTIFIER"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^CORTEXDX_AUTH0_SCOPE=" "$ENV_FILE" || true
    echo "CORTEXDX_AUTH0_SCOPE=openid profile email execute:tools read:diagnostics read:health"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

{
    grep -v "^REQUIRE_AUTH=" "$ENV_FILE" || true
    echo "REQUIRE_AUTH=true"
} > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"

echo "✅ Updated $ENV_FILE"
echo ""

# Test Auth0 connection
echo "🧪 Testing Auth0 connection..."
TOKEN_RESPONSE=$(curl -s -X POST "https://$TENANT/oauth/token" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\",
    \"audience\": \"$API_IDENTIFIER\",
    \"grant_type\": \"client_credentials\"
  }")

if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Auth0 connection successful!"
else
    echo "❌ Auth0 connection failed!"
    echo "   Response: $TOKEN_RESPONSE"
    echo ""
    echo "Please verify your credentials and try again."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Configuration Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo "   Auth0 Domain: $TENANT"
echo "   Client ID: $CLIENT_ID"
echo "   API Identifier: $API_IDENTIFIER"
echo ""
echo "🔗 Next Steps:"
echo ""
echo "1. Start Cloudflare Tunnel (in a new terminal):"
echo "   cloudflared tunnel --url http://localhost:5001"
echo ""
echo "2. Start CortexDx server (in another terminal):"
echo "   pnpm --filter @brainwav/cortexdx-server start"
echo ""
echo "3. Configure ChatGPT GPT:"
echo "   • Go to https://chat.openai.com"
echo "   • Create a GPT > Configure > Actions"
echo "   • Authentication: OAuth"
echo "   • Client ID: $CLIENT_ID"
echo "   • Client Secret: $CLIENT_SECRET"
echo "   • Authorization URL: https://$TENANT/authorize"
echo "   • Token URL: https://$TENANT/oauth/token"
echo "   • Scope: openid profile email execute:tools read:diagnostics read:health"
echo ""
echo "📚 Full guide: docs/CHATGPT_CONNECTION_GUIDE.md"
echo ""
