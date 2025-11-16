#!/usr/bin/env bash
#
# Evidence Collection Script
# Collects and organizes evidence for governance compliance
#
# Usage: ./scripts/governance/collect-evidence.sh --slug <task-slug> [--output <dir>]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SLUG=""
OUTPUT_DIR="evidence"
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --slug)
      SLUG="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 --slug <task-slug> [--output <dir>] [--verbose]"
      echo ""
      echo "Collects governance evidence for a task into organized directory."
      echo ""
      echo "Options:"
      echo "  --slug <slug>     Task slug (required)"
      echo "  --output <dir>    Output directory (default: evidence)"
      echo "  --verbose         Verbose output"
      echo "  --help            Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$SLUG" ]]; then
  echo -e "${RED}Error: --slug is required${NC}"
  echo "Use --help for usage information"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}📦 CortexDx Evidence Collector${NC}"
echo -e "${BLUE}================================${NC}\n"
echo "Task slug: $SLUG"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Function to log info
log_info() {
  echo -e "${BLUE}ℹ${NC}  $1"
}

# Function to log success
log_success() {
  echo -e "${GREEN}✓${NC}  $1"
}

# Function to log warning
log_warn() {
  echo -e "${YELLOW}⚠${NC}  $1"
}

# Function to log error
log_error() {
  echo -e "${RED}✗${NC}  $1"
}

# Function to collect file if exists
collect_file() {
  local source="$1"
  local dest="$2"
  local description="$3"
  
  if [[ -f "$source" ]]; then
    mkdir -p "$(dirname "$OUTPUT_DIR/$dest")"
    cp "$source" "$OUTPUT_DIR/$dest"
    log_success "$description: $source → $OUTPUT_DIR/$dest"
    return 0
  else
    log_warn "$description not found: $source"
    return 1
  fi
}

# Function to run command and capture output
collect_command() {
  local command="$1"
  local dest="$2"
  local description="$3"
  
  log_info "Running: $command"
  if eval "$command" > "$OUTPUT_DIR/$dest" 2>&1; then
    log_success "$description: saved to $OUTPUT_DIR/$dest"
    return 0
  else
    log_error "$description: command failed"
    return 1
  fi
}

# Create evidence manifest
MANIFEST="$OUTPUT_DIR/evidence-manifest.json"
cat > "$MANIFEST" << JSON
{
  "task_slug": "$SLUG",
  "collected_at": "$(date -Iseconds)",
  "collected_by": "$(whoami)@$(hostname)",
  "evidence_items": []
}
JSON

log_info "Created evidence manifest: $MANIFEST"
echo ""

# 1. Test Results
echo -e "${BLUE}📋 Collecting Test Results...${NC}"
collect_command "pnpm test 2>&1 || true" "test-results.txt" "Test output"
collect_file "coverage/coverage-summary.json" "coverage-summary.json" "Coverage summary"
collect_file "coverage/index.html" "coverage-report.html" "Coverage HTML report"
echo ""

# 2. Lint Results
echo -e "${BLUE}🔍 Collecting Lint Results...${NC}"
collect_command "pnpm lint 2>&1 || true" "lint-results.txt" "Lint output"
echo ""

# 3. Build Results
echo -e "${BLUE}🔨 Collecting Build Results...${NC}"
collect_command "pnpm build 2>&1 || true" "build-results.txt" "Build output"
echo ""

# 4. Security Scan Results
echo -e "${BLUE}🔒 Collecting Security Scans...${NC}"
if command -v semgrep &> /dev/null; then
  collect_command "pnpm security:semgrep 2>&1 || true" "security-semgrep.txt" "Semgrep scan"
else
  log_warn "Semgrep not available"
fi

if command -v gitleaks &> /dev/null; then
  collect_command "pnpm security:gitleaks 2>&1 || true" "security-gitleaks.txt" "Gitleaks scan"
else
  log_warn "Gitleaks not available"
fi
echo ""

# 5. Git Information
echo -e "${BLUE}📝 Collecting Git Information...${NC}"
collect_command "git status" "git-status.txt" "Git status"
collect_command "git log -10 --oneline" "git-log.txt" "Recent commits"
collect_command "git diff --stat" "git-diff-stat.txt" "Diff statistics"
echo ""

# 6. Package Information
echo -e "${BLUE}📦 Collecting Package Information...${NC}"
collect_file "package.json" "package.json" "Root package.json"
collect_file "packages/cortexdx/package.json" "cortexdx-package.json" "CortexDx package.json"
collect_command "pnpm list --depth=0" "dependencies.txt" "Dependency list"
echo ""

# 7. Task-specific artifacts
echo -e "${BLUE}📁 Collecting Task Artifacts...${NC}"
TASK_DIR="~/Changelog/$SLUG"
if [[ -d "$TASK_DIR" ]]; then
  collect_file "$TASK_DIR/implementation-plan.md" "task/implementation-plan.md" "Implementation plan"
  collect_file "$TASK_DIR/notes.md" "task/notes.md" "Task notes"
  collect_file "$TASK_DIR/decisions.md" "task/decisions.md" "Decisions"
  collect_file "$TASK_DIR/run-manifest.json" "task/run-manifest.json" "Run manifest"
  collect_file "$TASK_DIR/evidence/recaps.log" "task/recaps.log" "Recap log"
else
  log_warn "Task directory not found: $TASK_DIR"
fi
echo ""

# 8. Governance artifacts
echo -e "${BLUE}📋 Collecting Governance Artifacts...${NC}"
collect_file ".cortexdx/rules/governance-index.json" "governance-index.json" "Governance index"
collect_command "pnpm governance:validate 2>&1 || true" "governance-validation.txt" "Governance validation"
echo ""

# Create summary
SUMMARY="$OUTPUT_DIR/SUMMARY.md"
cat > "$SUMMARY" << MARKDOWN
# Evidence Summary for Task: $SLUG

**Collected:** $(date -Iseconds)  
**Collected by:** $(whoami)@$(hostname)

## Evidence Items

### Test Results
- Test output: test-results.txt
- Coverage summary: coverage-summary.json
- Coverage HTML: coverage-report.html

### Code Quality
- Lint results: lint-results.txt
- Build results: build-results.txt

### Security
- Semgrep scan: security-semgrep.txt
- Gitleaks scan: security-gitleaks.txt

### Git Information
- Status: git-status.txt
- Recent commits: git-log.txt
- Diff stats: git-diff-stat.txt

### Package Information
- Dependencies: dependencies.txt
- Package manifests: package.json, cortexdx-package.json

### Task Artifacts
- Implementation plan: task/implementation-plan.md
- Notes: task/notes.md
- Decisions: task/decisions.md
- Run manifest: task/run-manifest.json
- Recaps: task/recaps.log

### Governance
- Governance index: governance-index.json
- Validation results: governance-validation.txt

## Next Steps

1. Review all evidence for completeness
2. Attach to PR description
3. Link in code review checklist
4. Archive when PR is merged

## Evidence Checklist

- [ ] Tests passing (see test-results.txt)
- [ ] Coverage ≥90% (see coverage-summary.json)
- [ ] Lint clean (see lint-results.txt)
- [ ] Build successful (see build-results.txt)
- [ ] Security scans clean (see security-*.txt)
- [ ] Git state clean (see git-status.txt)
- [ ] Task artifacts present (see task/)
- [ ] Governance validation passing (see governance-validation.txt)

MARKDOWN

log_success "Created summary: $SUMMARY"
echo ""

# Final summary
echo -e "${GREEN}✓${NC} Evidence collection complete!"
echo ""
echo "Evidence directory: $OUTPUT_DIR"
echo "Summary: $OUTPUT_DIR/SUMMARY.md"
echo "Manifest: $OUTPUT_DIR/evidence-manifest.json"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review evidence in $OUTPUT_DIR"
echo "  2. Attach to PR with: tar czf evidence-$SLUG.tar.gz $OUTPUT_DIR"
echo "  3. Link evidence in PR description and checklist"
echo ""
