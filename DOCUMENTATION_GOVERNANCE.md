# Documentation Governance & Automated Enforcement

**Purpose:** Ensure consistent, high-quality documentation across the CortexDx project through automated validation and enforcement.

**Based on:** [OpenAI Documentation Best Practices](https://cookbook.openai.com/articles/what_makes_documentation_good)

---

## Table of Contents

- [Overview](#overview) - Governance system explanation
- [Automated Checks](#automated-checks) - What gets validated
- [Enforcement Points](#enforcement-points) - When validation runs
- [For Contributors](#for-contributors) - How to comply
- [For Maintainers](#for-maintainers) - Managing the system
- [Appendix](#appendix) - Technical details

---

## Overview

### Goals

1. **Consistency**: All documentation follows the same style guide
2. **Quality**: Documentation meets accessibility and skimmability standards
3. **Maintenance**: Automated checks prevent quality drift
4. **Onboarding**: New contributors understand documentation standards

### Principles

- **Automated First**: Checks run automatically, not manually
- **Fast Feedback**: Contributors know about issues immediately
- **Actionable**: Errors include specific fix instructions
- **Non-Blocking** (for warnings): Warnings don't block commits
- **Evolving**: Standards improve based on feedback

---

## Automated Checks

### 1. Style Guide Compliance

**Script:** `scripts/validate-docs.sh`
**Runs:** On every commit, PR, and push to main
**Purpose:** Enforce OpenAI documentation best practices

**Checks performed:**

#### ✅ Glossary Link Presence
- **What**: Every user-facing doc must link to GLOSSARY.md
- **Why**: Provides quick access to term definitions
- **Pattern**: `📖 **[View Glossary](GLOSSARY.md)**`
- **Error message**: "Missing glossary link"
- **How to fix**:
  ```markdown
  📖 **[View Glossary](GLOSSARY.md)** for definitions of abbreviations and technical terms.
  ```

#### ✅ Table of Contents
- **What**: Docs >100 lines should have TOC
- **Why**: Enables <30 second navigation to any section
- **Pattern**: `## Table of Contents`
- **Error message**: "Missing table of contents"
- **How to fix**:
  ```markdown
  ## Table of Contents

  - [Section 1](#section-1) - Brief description
  - [Section 2](#section-2) - Brief description
  ```

#### ✅ Abbreviation Expansion
- **What**: Abbreviations must be expanded on first use
- **Why**: Accessibility for non-experts and non-native speakers
- **Checked abbreviations**:
  - MCP → Model Context Protocol (MCP)
  - SSE → SSE (Server-Sent Events)
  - CORS → CORS (Cross-Origin Resource Sharing)
  - JSON-RPC → JSON-RPC (Remote Procedure Call)
  - CI/CD → CI/CD (Continuous Integration/Continuous Deployment)
  - [See full list in script]
- **Error message**: "Unexpanded abbreviations in: [file]"
- **How to fix**: Expand on first use, abbreviation only afterwards

#### ⚠️ Paragraph Length
- **What**: Paragraphs should be ≤5 lines
- **Why**: Improves skimmability by 80%
- **Severity**: Warning (doesn't block)
- **Error message**: "Found X long paragraphs (>5 lines)"
- **How to fix**:
  - Break into multiple paragraphs
  - Use bullet lists
  - Add subheadings

#### ⚠️ Bold Text Usage
- **What**: Documents should bold key concepts
- **Why**: Makes important info stand out when scanning
- **Minimum**: 5 instances of bold text
- **Severity**: Warning (doesn't block)
- **Error message**: "Limited bold text usage"
- **How to fix**: Bold commands, requirements, exit codes, critical info

#### ⚠️ Code Block Tags
- **What**: Code blocks must have language tags
- **Why**: Enables syntax highlighting, better rendering
- **Severity**: Warning (doesn't block)
- **Error message**: "Found X untagged code blocks"
- **How to fix**:
  ```markdown
  \`\`\`bash  # Not \`\`\`
  command here
  \`\`\`
  ```

### 2. Markdown Linting

**Tool:** `markdownlint-cli2`
**Config:** `.markdownlint.json`
**Runs:** On every commit, PR, and push
**Purpose:** Enforce markdown formatting standards

**Rules enforced:**
- **MD003**: ATX-style headers (`#` not underlines)
- **MD004**: Consistent unordered list style (dashes)
- **MD007**: Proper list indentation (2 spaces)
- **MD013**: Line length ≤120 characters (flexible for tables/code)
- **MD024**: No duplicate headings (within same hierarchy)
- **MD025**: Single H1 per document
- **MD033**: Limited HTML (only specific tags allowed)
- **MD041**: First line must be H1

### 3. Link Validation

**Tool:** `markdown-link-check`
**Runs:** On PR and scheduled weekly
**Purpose:** Prevent broken links

**Checks:**
- Internal links to other docs
- External links to websites
- Anchor links within documents

**Failures:**
- 404 Not Found
- Timeouts
- Invalid URLs

### 4. Spell Checking

**Tool:** `cspell`
**Runs:** On every commit and PR
**Purpose:** Catch typos and misspellings

**Custom dictionary:**
- Technical terms (CortexDx, Ollama, etc.)
- Abbreviations
- Project-specific terms

### 5. Structure Validation

**Type:** Custom script in CI workflow
**Runs:** On every PR
**Purpose:** Ensure required documentation exists

**Required files:**
- README.md (root)
- CONTRIBUTING.md
- packages/cortexdx/README.md
- packages/cortexdx/docs/GETTING_STARTED.md
- packages/cortexdx/docs/USER_GUIDE.md
- packages/cortexdx/docs/API_REFERENCE.md
- packages/cortexdx/docs/GLOSSARY.md
- packages/cortexdx/docs/EXAMPLES.md
- packages/cortexdx/docs/TROUBLESHOOTING.md

### 6. Glossary Completeness

**Type:** Custom check in CI
**Runs:** On every PR
**Purpose:** Ensure glossary stays current

**Checks:**
- Finds all-caps abbreviations in docs
- Checks if they're defined in GLOSSARY.md
- Reports potentially missing entries

---

## Enforcement Points

### 1. Pre-Commit (Local)

**Status:** ⚠️ Recommended but not enforced
**How to enable:**

```bash
# Install pre-commit hooks
npm install -D husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run docs:validate"
```

**What it checks:**
- Markdown linting
- Style guide compliance (fast checks only)

**Benefit:** Catch issues before committing

### 2. GitHub Actions (CI)

**Status:** ✅ Enforced automatically
**Workflow:** `.github/workflows/docs-validation.yml`
**Triggers:**
- Every push to main
- Every PR
- Manual workflow dispatch
- Scheduled weekly

**What it checks:**
- All automated checks (full suite)
- Link validation
- Spell checking
- Structure validation
- Glossary completeness

**On failure:**
- PR gets a comment with fix instructions
- CI status shows red X
- Merge is blocked (for errors, not warnings)

### 3. Pull Request Reviews

**Status:** ✅ Manual review layer
**Who:** Project maintainers
**When:** After automated checks pass

**Review for:**
- Clarity and readability
- Technical accuracy
- Appropriate detail level
- Good examples

### 4. Scheduled Audits

**Status:** ✅ Automated weekly
**Workflow:** Docs freshness check
**Purpose:** Identify stale documentation

**Checks:**
- Last update dates
- Flags docs >6 months old
- Creates issue for review

---

## For Contributors

### Quick Compliance Checklist

Before submitting documentation changes:

- [ ] Added glossary link at top (user-facing docs only)
- [ ] Expanded abbreviations on first use
- [ ] Added/updated table of contents (if >100 lines)
- [ ] Broke up paragraphs >5 lines
- [ ] Bolded key concepts (commands, requirements, etc.)
- [ ] Tagged all code blocks with language
- [ ] Tested links work
- [ ] Spell checked content

### Running Checks Locally

**Full validation:**
```bash
./scripts/validate-docs.sh
```

**Markdown linting:**
```bash
npx markdownlint-cli2 "**/*.md" "#node_modules" "#.nx"
```

**Link checking:**
```bash
find . -name "*.md" -not -path "./node_modules/*" | \
  xargs markdown-link-check
```

**Spell checking:**
```bash
npx cspell "**/*.md" --exclude "node_modules/**"
```

### Using Templates

Start with a template for consistency:

```bash
# Copy template
cp .cortexdx/templates/docs/USER_GUIDE_TEMPLATE.md \
   packages/cortexdx/docs/MY_NEW_GUIDE.md

# Edit and fill in
code packages/cortexdx/docs/MY_NEW_GUIDE.md
```

**Available templates:**
- `USER_GUIDE_TEMPLATE.md` - For user guides
- `API_REFERENCE_TEMPLATE.md` - For API documentation
- `TUTORIAL_TEMPLATE.md` - For step-by-step tutorials

### Common Fixes

#### Fix: Missing glossary link
```markdown
# My Document Title

Brief description.

📖 **[View Glossary](GLOSSARY.md)** for definitions of abbreviations and technical terms.

---
```

#### Fix: Unexpanded abbreviation
```markdown
<!-- Before -->
The MCP server uses SSE for streaming.

<!-- After -->
The Model Context Protocol (MCP) server uses SSE (Server-Sent Events) for streaming.
```

#### Fix: Long paragraph
```markdown
<!-- Before -->
This is a very long paragraph that contains multiple ideas. It talks about feature A and how it works. Then it discusses feature B and its benefits. It also mentions feature C and when to use it. Finally, it covers feature D and common pitfalls. This makes it hard to scan quickly.

<!-- After -->
This document covers four key features:

**Feature A**: How it works and when to use it

**Feature B**: Benefits and implementation details

**Feature C**: Use cases and examples

**Feature D**: Common pitfalls and how to avoid them
```

#### Fix: Untagged code block
```markdown
<!-- Before -->
\`\`\`
npm install cortexdx
\`\`\`

<!-- After -->
\`\`\`bash
npm install cortexdx
\`\`\`
```

---

## For Maintainers

### Updating Validation Rules

#### Add new abbreviation to check

Edit `scripts/validate-docs.sh`:

```bash
ABBREVIATIONS=(
  # ... existing ...
  "NEWABBR:Full Expansion Here"
)
```

#### Modify severity levels

Change error to warning:
```bash
# Before
echo -e "${RED}✗${NC} Missing glossary link: $file"
((ERRORS++))

# After
echo -e "${YELLOW}⚠${NC} Missing glossary link: $file"
((WARNINGS++))
```

#### Disable a check temporarily

Comment out in script:
```bash
# check_glossary_link "$doc_path"
```

### Managing Exceptions

#### Exclude specific files

Edit `scripts/validate-docs.sh`:

```bash
# Skip autogenerated or special files
if [[ "$doc" == *"CHANGELOG.md"* ]]; then
  echo "Skipping autogenerated file: $doc"
  continue
fi
```

#### Allow HTML in specific docs

Edit `.markdownlint.json`:

```json
{
  "MD033": {
    "allowed_elements": ["details", "summary", "table", "tr", "td"]
  }
}
```

### Monitoring Compliance

#### View CI results

1. Go to GitHub Actions
2. Click "Documentation Validation"
3. Review check results

#### Generate compliance report

```bash
# Run full validation
./scripts/validate-docs.sh > compliance-report.txt 2>&1

# Check compliance rate
grep "✓" compliance-report.txt | wc -l  # Passed checks
grep "✗" compliance-report.txt | wc -l  # Failed checks
```

#### Track improvements over time

```bash
# Add to CI workflow to track metrics
echo "::set-output name=checks_passed::$(grep '✓' report.txt | wc -l)"
echo "::set-output name=checks_failed::$(grep '✗' report.txt | wc -l)"
```

### Handling Failures

#### PR blocked by validation

1. Review failure logs in CI
2. If legitimate issue: Request contributor fix
3. If false positive: Update validation rules
4. If urgent: Can override with maintainer review

#### Weekly audit identifies stale docs

1. Issue created automatically
2. Assign to doc owner or team
3. Review doc for accuracy
4. Update or archive as needed

---

## Appendix

### Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Git Commit/Push                      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions Workflow                     │
│           (.github/workflows/docs-validation.yml)       │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        v                     v
┌───────────────────┐ ┌──────────────────────┐
│  Markdown Lint    │ │  Style Validation    │
│  (markdownlint)   │ │  (validate-docs.sh)  │
└─────────┬─────────┘ └──────────┬───────────┘
          │                      │
          v                      v
┌───────────────────┐ ┌──────────────────────┐
│  Link Check       │ │  Spell Check         │
│  (markdown-link)  │ │  (cspell)            │
└─────────┬─────────┘ └──────────┬───────────┘
          │                      │
          └──────────┬───────────┘
                     │
                     v
          ┌──────────────────────┐
          │  Validation Report   │
          │  (Pass/Fail + Details)│
          └──────────────────────┘
                     │
          ┌──────────┴───────────┐
          v                      v
    [Pass: Merge OK]      [Fail: Block PR]
                               │
                               v
                      [Comment on PR with fixes]
```

### File Structure

```
CortexDx/
├── .markdownlint.json          # Markdown linting rules
├── .cspell.json                # Spell check dictionary
├── scripts/
│   └── validate-docs.sh        # Main validation script
├── .github/
│   └── workflows/
│       ├── docs-validation.yml # CI workflow
│       └── docs-maintenance.yml# Scheduled audits
├── .cortexdx/
│   ├── templates/
│   │   └── docs/              # Documentation templates
│   └── rules/
│       └── documentation.md   # Style guide rules
├── docs/
│   └── GLOSSARY.md           # Central glossary
├── packages/cortexdx/
│   └── docs/
│       ├── GLOSSARY.md       # Package glossary
│       ├── GETTING_STARTED.md
│       ├── USER_GUIDE.md
│       ├── API_REFERENCE.md
│       └── ... (other docs)
└── DOCUMENTATION_GOVERNANCE.md # This file
```

### Metrics Collected

| Metric | Description | Target |
|--------|-------------|--------|
| Glossary Link Compliance | % of docs with glossary links | 100% |
| Abbreviation Expansion | % of abbreviations expanded | 100% |
| TOC Presence | % of long docs with TOC | 90% |
| Paragraph Length | % of paragraphs ≤5 lines | 95% |
| Bold Usage | Avg bold instances per doc | 10+ |
| Broken Links | Number of broken links | 0 |
| Spelling Errors | Number of typos | 0 |
| Validation Pass Rate | % of commits passing | 95% |

### Performance Targets

- **Local validation**: <10 seconds
- **CI validation (full)**: <2 minutes
- **Link checking**: <3 minutes
- **Spell checking**: <1 minute

### Related Documents

- [DOCUMENTATION_REVIEW.md](DOCUMENTATION_REVIEW.md) - Original review and analysis
- [DOCUMENTATION_STYLE_APPLIED.md](DOCUMENTATION_STYLE_APPLIED.md) - Implementation summary
- [docs/GLOSSARY.md](docs/GLOSSARY.md) - Central glossary
- [packages/cortexdx/docs/GLOSSARY.md](packages/cortexdx/docs/GLOSSARY.md) - Package glossary
- [CONTRIBUTING.md](CONTRIBUTING.md) - General contribution guidelines

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-17 | Initial governance document created | Claude |
| 2025-11-17 | Added automated validation script | Claude |
| 2025-11-17 | Integrated with CI/CD workflow | Claude |

---

*This document is automatically validated by the system it describes.*
*Last updated: 2025-11-17*
*Review cycle: Quarterly*
