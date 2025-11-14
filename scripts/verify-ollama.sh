#!/usr/bin/env bash
#
# Verify Ollama is running and the required model is available
#

set -euo pipefail

OLLAMA_ENDPOINT="${OLLAMA_URL:-http://127.0.0.1:11434}"
REQUIRED_MODEL="${1:-gpt-oss-safeguard:20b}"

echo "🔍 Verifying Ollama setup..."
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed or not in PATH"
    echo ""
    echo "Install Ollama:"
    echo "  macOS:   brew install ollama"
    echo "  Linux:   curl -fsSL https://ollama.com/install.sh | sh"
    echo "  Manual:  https://ollama.com/download"
    exit 1
fi

echo "✅ Ollama CLI found: $(which ollama)"

# Check if Ollama server is running
if ! curl -s --max-time 2 "${OLLAMA_ENDPOINT}/api/tags" &> /dev/null; then
    echo "❌ Ollama server is not running at ${OLLAMA_ENDPOINT}"
    echo ""
    echo "Start Ollama:"
    echo "  macOS:   brew services start ollama"
    echo "  Linux:   systemctl start ollama"
    echo "  Manual:  ollama serve &"
    exit 1
fi

echo "✅ Ollama server is running at ${OLLAMA_ENDPOINT}"

# Check if the required model is available
if ! ollama list | awk '{print $1}' | grep -q "^${REQUIRED_MODEL}$"; then
    echo "❌ Model '${REQUIRED_MODEL}' is not installed"
    echo ""
    echo "Available models:"
    ollama list
    echo ""
    echo "Pull the required model:"
    echo "  ollama pull ${REQUIRED_MODEL}"
    exit 1
fi

echo "✅ Model '${REQUIRED_MODEL}' is installed"

# Test the model with a quick generation
echo ""
echo "🧪 Testing model with quick generation..."
RESPONSE=$(curl -s --max-time 30 -X POST "${OLLAMA_ENDPOINT}/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${REQUIRED_MODEL}\",\"prompt\":\"Say OK\",\"stream\":false}" \
  | jq -r '.response // .error // "No response"')

if [ "$RESPONSE" = "No response" ] || [ -z "$RESPONSE" ]; then
    echo "❌ Model test failed - no response received"
    echo "   This may indicate the model is still loading. Try again in a moment."
    exit 1
fi

echo "✅ Model test successful"
echo "   Response: ${RESPONSE:0:100}..."
echo ""
echo "🎉 Ollama is ready for CortexDx!"
