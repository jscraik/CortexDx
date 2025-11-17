#!/bin/bash
set -e

# Documentation Validation Script
# Enforces documentation style guide compliance
# Based on OpenAI documentation best practices

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

echo -e "${BLUE}=== CortexDx Documentation Validation ===${NC}\n"

# List of user-facing documentation files (must meet all criteria)
USER_FACING_DOCS=(
  "README.md"
  "CONTRIBUTING.md"
  "packages/cortexdx/README.md"
  "packages/cortexdx/docs/GETTING_STARTED.md"
  "packages/cortexdx/docs/USER_GUIDE.md"
  "packages/cortexdx/docs/API_REFERENCE.md"
  "packages/cortexdx/docs/EXAMPLES.md"
  "packages/cortexdx/docs/TROUBLESHOOTING.md"
  "packages/cortexdx/docs/DEPLOYMENT.md"
  "packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md"
  "packages/cortexdx/RELEASE_NOTES.md"
  "packages/cortexdx/MIGRATION_GUIDE.md"
)

# Common abbreviations that should be expanded on first use
ABBREVIATIONS=(
  "MCP:Model Context Protocol"
  "SSE:Server-Sent Events"
  "CORS:Cross-Origin Resource Sharing"
  "JSON-RPC:JSON Remote Procedure Call"
  "CI/CD:Continuous Integration/Continuous Deployment"
  "HAR:HTTP Archive"
  "LLM:Large Language Model"
  "API:Application Programming Interface"
  "CLI:Command-Line Interface"
  "NPM:Node Package Manager"
  "AWS:Amazon Web Services"
  "S3:Simple Storage Service"
  "TDD:Test-Driven Development"
  "RAG:Retrieval-Augmented Generation"
)

#######################################
# Check if file has glossary link
#######################################
check_glossary_link() {
  local file="$1"
  ((CHECKS++))

  if grep -q "\*\*\[View Glossary\](GLOSSARY\.md)\*\*" "$file"; then
    echo -e "${GREEN}✓${NC} Glossary link found: $file"
    return 0
  else
    echo -e "${RED}✗${NC} Missing glossary link: $file"
    echo -e "   ${YELLOW}Add: 📖 **[View Glossary](GLOSSARY.md)** for definitions${NC}"
    ((ERRORS++))
    return 1
  fi
}

#######################################
# Check if file has table of contents
#######################################
check_table_of_contents() {
  local file="$1"
  local line_count=$(wc -l < "$file")

  # Only check files with >100 lines
  if [ "$line_count" -lt 100 ]; then
    return 0
  fi

  ((CHECKS++))

  if grep -q "## Table of Contents" "$file"; then
    echo -e "${GREEN}✓${NC} Table of contents found: $file"
    return 0
  else
    echo -e "${YELLOW}⚠${NC} Missing table of contents: $file (${line_count} lines)"
    echo -e "   ${YELLOW}Consider adding TOC for easier navigation${NC}"
    ((WARNINGS++))
    return 1
  fi
}

#######################################
# Check for unexpanded abbreviations
#######################################
check_abbreviations() {
  local file="$1"
  local found_issues=0

  for abbr_pair in "${ABBREVIATIONS[@]}"; do
    IFS=':' read -r abbr expansion <<< "$abbr_pair"

    # Check if abbreviation appears in file
    if grep -qE "(^|[[:space:]])$abbr([[:space:]]|$)" "$file"; then
      # Check if it's expanded on first use
      if ! grep -q "$expansion ($abbr)\|$abbr ($expansion)" "$file"; then
        if [ $found_issues -eq 0 ]; then
          ((CHECKS++))
          echo -e "${RED}✗${NC} Unexpanded abbreviations in: $file"
          found_issues=1
          ((ERRORS++))
        fi
        echo -e "   ${YELLOW}- $abbr should be: $expansion ($abbr)${NC}"
      fi
    fi
  done

  if [ $found_issues -eq 0 ]; then
    ((CHECKS++))
    echo -e "${GREEN}✓${NC} Abbreviations properly expanded: $file"
  fi

  return $found_issues
}

#######################################
# Check paragraph length (max 5 lines)
#######################################
check_paragraph_length() {
  local file="$1"
  local long_paragraphs=0

  ((CHECKS++))

  # Count paragraphs with more than 5 consecutive non-empty lines
  long_paragraphs=$(awk '
    /^$/ { count=0; next }
    # Exclude markdown list items, numbered lists, and headings
    /^[[:space:]]*([-*+]|[0-9]+\.)[[:space:]]/ { count=0; next }
    /^[[:space:]]*#/ { count=0; next }
    /^[A-Za-z]/ { count++; if(count>5) print NR": Long paragraph" }
  ' "$file" | wc -l)

  if [ "$long_paragraphs" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $long_paragraphs long paragraphs (>5 lines): $file"
    echo -e "   ${YELLOW}Break up for better skimmability${NC}"
    ((WARNINGS++))
    return 1
  else
    echo -e "${GREEN}✓${NC} Paragraph length good: $file"
    return 0
  fi
}

#######################################
# Check for bold text usage
#######################################
check_bold_usage() {
  local file="$1"
  local bold_count

  ((CHECKS++))

  bold_count=$(grep -o "\*\*[^*]\+\*\*" "$file" | wc -l)

  if [ "$bold_count" -lt 5 ]; then
    echo -e "${YELLOW}⚠${NC} Limited bold text usage ($bold_count instances): $file"
    echo -e "   ${YELLOW}Consider bolding key concepts, commands, exit codes${NC}"
    ((WARNINGS++))
    return 1
  else
    echo -e "${GREEN}✓${NC} Bold text usage good ($bold_count instances): $file"
    return 0
  fi
}

#######################################
# Check for code block language tags
#######################################
check_code_blocks() {
  local file="$1"
  local untagged_blocks

  ((CHECKS++))

  # Count code blocks without language tags
  untagged_blocks=$(grep -c '^```$' "$file" || true)

  if [ "$untagged_blocks" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $untagged_blocks untagged code blocks: $file"
    echo -e "   ${YELLOW}Add language tags: \`\`\`bash, \`\`\`typescript, etc.${NC}"
    ((WARNINGS++))
    return 1
  else
    echo -e "${GREEN}✓${NC} Code blocks properly tagged: $file"
    return 0
  fi
}

#######################################
# Main validation logic
#######################################
echo -e "${BLUE}Validating user-facing documentation...${NC}\n"

for doc in "${USER_FACING_DOCS[@]}"; do
  doc_path="$PROJECT_ROOT/$doc"

  if [ ! -f "$doc_path" ]; then
    echo -e "${YELLOW}⚠${NC} File not found (skipping): $doc"
    continue
  fi

  echo -e "\n${BLUE}--- Checking: $doc ---${NC}"

  check_glossary_link "$doc_path"
  check_table_of_contents "$doc_path"
  check_abbreviations "$doc_path"
  check_paragraph_length "$doc_path"
  check_bold_usage "$doc_path"
  check_code_blocks "$doc_path"
done

#######################################
# Check GLOSSARY.md exists
#######################################
echo -e "\n${BLUE}--- Checking glossary file ---${NC}"
((CHECKS++))

GLOSSARY_FILES=(
  "docs/GLOSSARY.md"
  "packages/cortexdx/docs/GLOSSARY.md"
)

glossary_found=0
for glossary in "${GLOSSARY_FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$glossary" ]; then
    echo -e "${GREEN}✓${NC} Glossary found: $glossary"

    # Check glossary has minimum number of entries
    entry_count=$(grep -c "^### " "$PROJECT_ROOT/$glossary" || true)
    if [ "$entry_count" -lt 20 ]; then
      echo -e "${YELLOW}⚠${NC} Glossary has only $entry_count entries (recommend 20+)"
      ((WARNINGS++))
    else
      echo -e "${GREEN}✓${NC} Glossary has $entry_count entries"
    fi

    glossary_found=1
    break
  fi
done

if [ $glossary_found -eq 0 ]; then
  echo -e "${RED}✗${NC} No glossary file found!"
  ((ERRORS++))
fi

#######################################
# Summary
#######################################
echo -e "\n${BLUE}=== Validation Summary ===${NC}"
echo -e "Total checks: $CHECKS"
echo -e "${RED}Errors: $ERRORS${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"

if [ $ERRORS -gt 0 ]; then
  echo -e "\n${RED}❌ Documentation validation FAILED${NC}"
  echo -e "Fix errors above before committing."
  exit 1
elif [ $WARNINGS -gt 5 ]; then
  echo -e "\n${YELLOW}⚠️  Documentation validation passed with warnings${NC}"
  echo -e "Consider addressing warnings to improve documentation quality."
  exit 0
else
  echo -e "\n${GREEN}✅ Documentation validation PASSED${NC}"
  exit 0
fi
