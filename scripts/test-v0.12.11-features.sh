#!/bin/bash
# Test script for Ollama v0.12.11 new features
# CortexDx compatibility validation

set -e

echo "🔍 Testing Ollama v0.12.11 Features..."

# Check Ollama version
echo "📋 Checking Ollama version..."
OLLAMA_VERSION=$(ollama --version | grep -o 'v[0-9]*\.[0-9]*\.[0-9]*')
echo "Current version: $OLLAMA_VERSION"

if [[ "$OLLAMA_VERSION" < "v0.12.11" ]]; then
    echo "❌ Ollama v0.12.11 or later required"
    exit 1
fi

# Test logprobs API feature
echo "🧠 Testing logprobs API..."
LOGPROBS_TEST=$(curl -s http://localhost:11434/api/generate -d '{
  "model": "gemma3n:e4b",
  "prompt": "The sky is",
  "logprobs": true,
  "top_logprobs": 2,
  "stream": false
}' | jq -r '.logprobs[0].token // "FAILED"')

if [ "$LOGPROBS_TEST" != "FAILED" ]; then
    echo "✅ Logprobs working - First token: $LOGPROBS_TEST"
else
    echo "❌ Logprobs test failed"
fi

# Test embedding with new Arctic model
echo "🌐 Testing snowflake-arctic-embed2..."
EMBEDDING_TEST=$(ollama run snowflake-arctic-embed2:568m "test embedding" | head -5 | wc -l)
if [ "$EMBEDDING_TEST" -gt 0 ]; then
    echo "✅ Arctic embedding model working"
else
    echo "❌ Arctic embedding model test failed"
fi

# Check available models
echo "📚 Available models:"
ollama list | grep -E "(gemma3n|snowflake|phi4|deepseek|qwen3)" || echo "No test models found"

echo "🎉 Ollama v0.12.11 feature testing complete!"
