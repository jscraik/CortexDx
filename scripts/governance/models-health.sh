#!/usr/bin/env bash
#
# Model Health Check Tool
# Verifies live model endpoints are healthy and responsive
#
# Usage: ./scripts/governance/models-health.sh [--output <file>]

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
      echo "Checks health of live model endpoints (MLX, Ollama, Frontier)"
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

echo -e "${BLUE}🏥 Model Health Check${NC}\n"

# Results array
declare -a results=()

# Function to check endpoint
check_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  
  echo -en "Checking ${name}... "
  
  if response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>&1); then
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [[ "$http_code" == "$expected_status" ]]; then
      echo -e "${GREEN}✓ OK${NC} (${http_code})"
      results+=("PASS:${name}:${http_code}")
      
      if [[ "$VERBOSE" == "true" ]]; then
        echo "  Response: ${body:0:100}..."
      fi
    else
      echo -e "${RED}✗ FAIL${NC} (${http_code}, expected ${expected_status})"
      results+=("FAIL:${name}:${http_code}")
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (connection error)"
    results+=("FAIL:${name}:connection_error")
  fi
}

# Check Ollama (if configured)
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
check_endpoint "Ollama" "${OLLAMA_HOST}/api/tags" 200

# Check MLX (via package health endpoint if available)
if [[ -n "${MLX_HEALTH_URL:-}" ]]; then
  check_endpoint "MLX" "${MLX_HEALTH_URL}" 200
else
  echo -e "${YELLOW}ℹ${NC}  MLX health endpoint not configured (set MLX_HEALTH_URL)"
  results+=("SKIP:MLX:not_configured")
fi

# Check Frontier APIs (if configured)
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  check_endpoint "OpenAI" "https://api.openai.com/v1/models" 200
else
  echo -e "${YELLOW}ℹ${NC}  OpenAI not configured (set OPENAI_API_KEY)"
  results+=("SKIP:OpenAI:not_configured")
fi

if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  # Anthropic doesn't have a simple health endpoint, skip for now
  echo -e "${YELLOW}ℹ${NC}  Anthropic configured but no health endpoint available"
  results+=("SKIP:Anthropic:no_health_endpoint")
fi

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
  engine="live"
  if [[ $passed -eq 1 ]]; then
    # Determine which engine passed
    for result in "${results[@]}"; do
      if [[ "$result" =~ ^PASS:([^:]+): ]]; then
        engine_name="${BASH_REMATCH[1]}"
        case "$engine_name" in
          Ollama) engine="ollama" ;;
          MLX) engine="mlx" ;;
          OpenAI|Anthropic) engine="frontier" ;;
        esac
        break
      fi
    done
  fi
  
  echo -e "${GREEN}✓ MODELS:LIVE:OK${NC} engine=${engine} timestamp=${timestamp}"
  echo "MODELS:LIVE:OK engine=${engine} timestamp=${timestamp}"
  
  # Save to file if requested
  if [[ -n "$OUTPUT_FILE" ]]; then
    {
      echo "# Model Health Check Results"
      echo "Timestamp: ${timestamp}"
      echo "Status: PASS"
      echo "Engine: ${engine}"
      echo ""
      echo "## Results"
      for result in "${results[@]}"; do
        echo "- $result"
      done
      echo ""
      echo "Evidence Token: MODELS:LIVE:OK engine=${engine} timestamp=${timestamp}"
    } > "$OUTPUT_FILE"
    echo "Results saved to: $OUTPUT_FILE"
  fi
  
  exit 0
else
  echo -e "${RED}✗ Model health check failed${NC}"
  
  # Save to file if requested
  if [[ -n "$OUTPUT_FILE" ]]; then
    {
      echo "# Model Health Check Results"
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
