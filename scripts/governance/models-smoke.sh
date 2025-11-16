#!/usr/bin/env bash
#
# Model Smoke Test Tool
# Runs simple inference tests to verify models are functional
#
# Usage: ./scripts/governance/models-smoke.sh [--output <file>]

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default output
OUTPUT_FILE=""
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--output <file>] [--verbose]"
      echo ""
      echo "Runs smoke tests on live model endpoints"
      echo ""
      echo "Options:"
      echo "  --output <file>   Save results to file"
      echo "  --verbose         Verbose output"
      echo "  --help            Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}🔬 Model Smoke Test${NC}\n"

# Results array
declare -a results=()
declare -A model_info=()

# Function to test Ollama model
test_ollama() {
  local model="${1:-llama2}"
  echo -en "Testing Ollama (${model})... "
  
  OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
  
  start_time=$(date +%s%N)
  if response=$(curl -s -X POST "${OLLAMA_HOST}/api/generate" \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"${model}\", \"prompt\": \"Say 'test'\", \"stream\": false}" \
    --connect-timeout 5 --max-time 30 2>&1); then
    end_time=$(date +%s%N)
    latency_ms=$(( (end_time - start_time) / 1000000 ))
    
    if echo "$response" | grep -q "\"response\""; then
      echo -e "${GREEN}✓ OK${NC} (${latency_ms}ms)"
      results+=("PASS:Ollama:${model}")
      model_info["Ollama"]="model=${model} latency_ms=${latency_ms}"
      
      if [[ "$VERBOSE" == "true" ]]; then
        echo "  Response: $(echo "$response" | jq -r '.response' 2>/dev/null || echo "unknown")"
      fi
    else
      echo -e "${RED}✗ FAIL${NC} (invalid response)"
      results+=("FAIL:Ollama:invalid_response")
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (connection error)"
    results+=("FAIL:Ollama:connection_error")
  fi
}

# Function to test embedding dimensions
test_embeddings() {
  echo -en "Testing embeddings... "
  
  # This is a placeholder - actual implementation would depend on the embedding service
  echo -e "${YELLOW}ℹ${NC}  Skipped (not configured)"
  results+=("SKIP:Embeddings:not_configured")
}

# Run tests
test_ollama "${OLLAMA_MODEL:-llama2}"
test_embeddings

echo ""

# Summary
passed=$(printf '%s\n' "${results[@]}" | grep -c "^PASS:" || true)
failed=$(printf '%s\n' "${results[@]}" | grep -c "^FAIL:" || true)
skipped=$(printf '%s\n' "${results[@]}" | grep -c "^SKIP:" || true)
total=${#results[@]}

echo "Summary:"
echo -e "  ${GREEN}Passed:${NC}  $passed/$total"
echo -e "  ${RED}Failed:${NC}  $failed/$total"
echo -e "  ${YELLOW}Skipped:${NC} $skipped/$total"
echo ""

# Generate evidence token
timestamp=$(date -Iseconds)
if [[ $failed -eq 0 && $passed -gt 0 ]]; then
  # Get model info
  model_details="${model_info[Ollama]:-model=unknown}"
  
  echo -e "${GREEN}✓ MODELS:LIVE:OK${NC} engine=ollama ${model_details} timestamp=${timestamp}"
  echo "MODELS:LIVE:OK engine=ollama ${model_details} timestamp=${timestamp}"
  
  # Save to file if requested
  if [[ -n "$OUTPUT_FILE" ]]; then
    {
      echo "# Model Smoke Test Results"
      echo "Timestamp: ${timestamp}"
      echo "Status: PASS"
      echo ""
      echo "## Model Information"
      for key in "${!model_info[@]}"; do
        echo "- ${key}: ${model_info[$key]}"
      done
      echo ""
      echo "## Test Results"
      for result in "${results[@]}"; do
        echo "- $result"
      done
      echo ""
      echo "Evidence Token: MODELS:LIVE:OK engine=ollama ${model_details} timestamp=${timestamp}"
    } > "$OUTPUT_FILE"
    echo "Results saved to: $OUTPUT_FILE"
  fi
  
  exit 0
else
  echo -e "${RED}✗ Model smoke test failed${NC}"
  
  # Save to file if requested
  if [[ -n "$OUTPUT_FILE" ]]; then
    {
      echo "# Model Smoke Test Results"
      echo "Timestamp: ${timestamp}"
      echo "Status: FAIL"
      echo ""
      echo "## Results"
      for result in "${results[@]}"; do
        echo "- $result"
      done
    } > "$OUTPUT_FILE"
    echo "Results saved to: $OUTPUT_FILE"
  fi
  
  exit 1
fi
