#!/usr/bin/env tsx
/**
 * Arc Scaffolding Tool
 * Creates new arc with proper structure and templates
 * 
 * Usage: pnpm arc:new --slug <arc-slug> --title "<Arc Title>" [--steps 1-7] [--parent <parent-slug>]
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ArcOptions {
  slug: string;
  title: string;
  steps?: number;
  parent?: string;
  preview?: boolean;
  inheritPlan?: boolean;
}

interface ArcManifest {
  task: string;
  tier: 'fix' | 'feature' | 'refactor';
  north_star: {
    goal: string;
    acceptance_test_path: string;
  };
  arcs: Array<{
    index: number;
    plan_steps: string[];
    contract_snapshot: string;
    evidence_triplet: {
      milestone_test: string;
      contract_snapshot: string;
      review_json: string;
    };
  }>;
  session_resets: string[];
  evidence: {
    vibe_check_log?: string;
    recaps_log?: string;
    tdd_plan_reuse_ledger?: string;
  };
  metadata?: {
    childArcs?: string[];
  };
}

class ArcScaffolder {
  private options: ArcOptions;
  private baseDir: string;
  private arcDir: string;

  constructor(options: ArcOptions) {
    this.options = options;
    this.baseDir = join(process.env.HOME || '~', 'Changelog', options.slug);
    this.arcDir = join(this.baseDir, 'arcs', '001');
  }

  async scaffold(): Promise<void> {
    console.log(`\n🏗️  Scaffolding Arc: ${this.options.title}\n`);

    if (this.options.preview) {
      console.log('📋 Preview Mode - No files will be created\n');
      this.showPreview();
      return;
    }

    // Check if arc already exists
    if (existsSync(this.baseDir)) {
      console.error(`❌ Error: Arc already exists at ${this.baseDir}`);
      console.error('   Use a different slug or delete the existing arc');
      process.exit(1);
    }

    // Create directory structure
    this.createDirectories();
    
    // Create arc files
    this.createManifest();
    this.createNotes();
    this.createImplementationPlan();
    this.createRisks();
    this.createDecisions();
    this.createAcceptanceTest();
    this.createEvidenceStructure();

    // Update parent arc if specified
    if (this.options.parent) {
      this.updateParentArc();
    }

    console.log('\n✅ Arc scaffolding complete!\n');
    this.printNextSteps();
  }

  private createDirectories(): void {
    const dirs = [
      this.baseDir,
      this.arcDir,
      join(this.baseDir, 'evidence'),
      join(this.baseDir, 'logs', 'vibe-check'),
      join(this.baseDir, 'logs', 'models'),
      join(this.baseDir, 'logs', 'trace-context'),
      join(this.baseDir, 'research'),
      join(this.baseDir, 'design', 'contracts'),
      join(this.baseDir, 'verification'),
      join(this.baseDir, 'tests', 'acceptance'),
    ];

    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true });
      console.log(`✓ Created: ${dir}`);
    }
  }

  private createManifest(): void {
    const manifest: ArcManifest = {
      task: this.options.slug,
      tier: 'feature', // Default, user should update
      north_star: {
        goal: this.options.title,
        acceptance_test_path: `tests/acceptance/${this.options.slug}.spec.ts`
      },
      arcs: [
        {
          index: 1,
          plan_steps: this.generatePlanSteps(),
          contract_snapshot: `design/contracts/${this.options.slug}-001.json`,
          evidence_triplet: {
            milestone_test: `evidence/${this.options.slug}-001-milestone.md`,
            contract_snapshot: `design/contracts/${this.options.slug}-001.json`,
            review_json: `evidence/${this.options.slug}-001-review.json`
          }
        }
      ],
      session_resets: [],
      evidence: {
        vibe_check_log: `logs/vibe-check/${this.options.slug}-001.json`,
        recaps_log: 'evidence/recaps.log',
        tdd_plan_reuse_ledger: 'implementation-plan.md#reuse-ledger'
      }
    };

    const manifestPath = join(this.baseDir, 'run-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Created: ${manifestPath}`);
  }

  private generatePlanSteps(): string[] {
    const stepCount = this.options.steps || 7;
    const steps: string[] = [];
    
    for (let i = 1; i <= Math.min(stepCount, 7); i++) {
      steps.push(`Step ${i}: TODO - Define implementation step`);
    }

    return steps;
  }

  private createNotes(): void {
    const content = `# Notes: ${this.options.title}

**Created:** ${new Date().toISOString()}  
**Slug:** ${this.options.slug}  
**Tier:** [fix | feature | refactor] - UPDATE THIS

## Quick Context

Brief description of what this arc accomplishes.

## Key Decisions

- Decision 1
- Decision 2

## Research Findings

- Finding 1
- Finding 2

## Questions

- [ ] Question 1
- [ ] Question 2

## References

- Reference 1
- Reference 2
`;

    const notesPath = join(this.baseDir, 'notes.md');
    writeFileSync(notesPath, content);
    console.log(`✓ Created: ${notesPath}`);
  }

  private createImplementationPlan(): void {
    const steps = this.generatePlanSteps();
    const stepsMarkdown = steps.map((step, i) => `${i + 1}. ${step}`).join('\n');

    const content = `# Implementation Plan: ${this.options.title}

**Slug:** ${this.options.slug}  
**Created:** ${new Date().toISOString()}  
**Step Budget:** ${this.options.steps || 7} (max 7 per arc)

## North Star

**Goal:** ${this.options.title}

**Acceptance Test:** \`tests/acceptance/${this.options.slug}.spec.ts\`

## Plan Steps

${stepsMarkdown}

## Reuse Ledger

> Required by governance - document reused modules and justification for new code

| Module/Function | Path | Reuse Mode | Rationale | Tests Inherited |
|-----------------|------|------------|-----------|-----------------|
| _No reuse identified yet_ | - | - | - | - |

### No Reuse Entry

**Blocker:** Describe why reuse was not possible  
**Risk:** Impact of creating new code  
**Compensating Controls:** How we mitigate the risk  

## Contract

Define the public contract that this arc creates/modifies:

\`\`\`typescript
// Contract definition
// TODO: Add contract
\`\`\`

## Quality Gates

- [ ] Coverage ≥90% global, ≥95% changed lines
- [ ] Mutation ≥90%
- [ ] Security scans clean (Semgrep, gitleaks, OSV)
- [ ] A11y validated (if UI changes)
- [ ] SBOM generated
- [ ] Live model health verified

## Evidence Required

- [ ] Vibe check log: \`logs/vibe-check/${this.options.slug}-001.json\`
- [ ] Test results: \`verification/test-results.txt\`
- [ ] Coverage report: \`verification/coverage.json\`
- [ ] Security scans: \`verification/security-scan.txt\`
- [ ] Evidence triplet complete

## Notes

Additional notes about implementation approach.
`;

    const planPath = join(this.baseDir, 'implementation-plan.md');
    writeFileSync(planPath, content);
    console.log(`✓ Created: ${planPath}`);
  }

  private createRisks(): void {
    const content = `# Risk Analysis: ${this.options.title}

**Created:** ${new Date().toISOString()}

## RAID Analysis

### Risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | TODO | Low/Med/High | Low/Med/High | TODO |

### Assumptions

- A1: TODO

### Issues

- I1: TODO

### Dependencies

- D1: TODO

## Threat Model

### Attack Vectors

- Vector 1: TODO

### Mitigations

- Mitigation 1: TODO

## Performance Risks

- Performance risk 1: TODO

## Compliance Risks

- Compliance risk 1: TODO
`;

    const risksPath = join(this.baseDir, 'risks.md');
    writeFileSync(risksPath, content);
    console.log(`✓ Created: ${risksPath}`);
  }

  private createDecisions(): void {
    const content = `# Decisions: ${this.options.title}

**Created:** ${new Date().toISOString()}

## Architecture Decisions

### Decision 1: TODO

**Status:** Proposed | Accepted | Rejected  
**Date:** ${new Date().toISOString().split('T')[0]}  
**Deciders:** @username

**Context:** What is the issue we're trying to solve?

**Considered Options:**
1. Option 1
2. Option 2

**Decision:** Chosen option

**Rationale:** Why we chose this

**Consequences:**
- Pro: Benefit 1
- Con: Drawback 1

## Trade-offs

### Trade-off 1: TODO vs TODO

**Chosen:** TODO  
**Reason:** TODO

## Reviewer Acknowledgements

> Updated after each review round

| Date | Reviewer | Checklist Version | Artifacts Hash | Status |
|------|----------|-------------------|----------------|--------|
| - | - | - | - | - |
`;

    const decisionsPath = join(this.baseDir, 'decisions.md');
    writeFileSync(decisionsPath, content);
    console.log(`✓ Created: ${decisionsPath}`);
  }

  private createAcceptanceTest(): void {
    const content = `/**
 * Acceptance Test: ${this.options.title}
 * 
 * This test defines the North Star for this arc.
 * It should FAIL first, then PASS when implementation is complete.
 */

import { describe, it, expect } from 'vitest';

describe('${this.options.slug}', () => {
  it('should satisfy the north star goal', () => {
    // TODO: Write acceptance test that proves the feature works
    // This test should fail initially
    expect(true).toBe(false); // Replace with real test
  });

  it('should handle edge cases', () => {
    // TODO: Add edge case tests
    expect(true).toBe(false); // Replace with real test
  });

  it('should maintain backward compatibility', () => {
    // TODO: Add compatibility tests if relevant
    expect(true).toBe(false); // Replace with real test
  });
});
`;

    const testPath = join(this.baseDir, 'tests', 'acceptance', `${this.options.slug}.spec.ts`);
    writeFileSync(testPath, content);
    console.log(`✓ Created: ${testPath}`);
  }

  private createEvidenceStructure(): void {
    // Create recaps log
    const recapsPath = join(this.baseDir, 'evidence', 'recaps.log');
    writeFileSync(recapsPath, `# Recaps Log: ${this.options.slug}\n\nGenerated every 400-700 tokens during implementation.\n\n`);
    console.log(`✓ Created: ${recapsPath}`);

    // Create evidence README
    const evidenceReadme = `# Evidence: ${this.options.slug}

This directory contains evidence artifacts for governance compliance.

## Required Evidence

- [ ] Vibe check log (\`logs/vibe-check/\`)
- [ ] Model health logs (\`logs/models/\`)
- [ ] Trace context logs (\`logs/trace-context/\`)
- [ ] Test results (\`verification/\`)
- [ ] Coverage reports (\`verification/\`)
- [ ] Security scans (\`verification/\`)
- [ ] Evidence triplet (milestone test, contract, review JSON)

## Evidence Triplet

1. **Milestone Test:** Link to test that went red → green
2. **Contract Snapshot:** Link to contract definition
3. **Reviewer JSON:** Link to reviewer feedback

## Recaps

See \`recaps.log\` for implementation recaps (every 400-700 tokens).
`;

    const evidenceReadmePath = join(this.baseDir, 'evidence', 'README.md');
    writeFileSync(evidenceReadmePath, evidenceReadme);
    console.log(`✓ Created: ${evidenceReadmePath}`);
  }

  private updateParentArc(): void {
    const parentManifestPath = join(process.env.HOME || '~', 'Changelog', this.options.parent!, 'run-manifest.json');
    
    if (!existsSync(parentManifestPath)) {
      console.warn(`⚠️  Parent arc manifest not found: ${parentManifestPath}`);
      return;
    }

    const parentManifest: ArcManifest = JSON.parse(readFileSync(parentManifestPath, 'utf-8'));
    
    if (!parentManifest.metadata) {
      parentManifest.metadata = {};
    }
    
    if (!parentManifest.metadata.childArcs) {
      parentManifest.metadata.childArcs = [];
    }

    parentManifest.metadata.childArcs.push(this.options.slug);
    
    writeFileSync(parentManifestPath, JSON.stringify(parentManifest, null, 2));
    console.log(`✓ Updated parent arc: ${parentManifestPath}`);
  }

  private showPreview(): void {
    console.log('Directory Structure:');
    console.log(`  ${this.baseDir}/`);
    console.log(`    ├── run-manifest.json`);
    console.log(`    ├── notes.md`);
    console.log(`    ├── implementation-plan.md`);
    console.log(`    ├── risks.md`);
    console.log(`    ├── decisions.md`);
    console.log(`    ├── arcs/`);
    console.log(`    │   └── 001/`);
    console.log(`    ├── evidence/`);
    console.log(`    │   ├── README.md`);
    console.log(`    │   └── recaps.log`);
    console.log(`    ├── logs/`);
    console.log(`    │   ├── vibe-check/`);
    console.log(`    │   ├── models/`);
    console.log(`    │   └── trace-context/`);
    console.log(`    ├── research/`);
    console.log(`    ├── design/`);
    console.log(`    │   └── contracts/`);
    console.log(`    ├── verification/`);
    console.log(`    └── tests/`);
    console.log(`        └── acceptance/`);
    console.log(`            └── ${this.options.slug}.spec.ts`);
    console.log('');
    console.log('Files to be created:');
    console.log(`  - run-manifest.json (${this.options.steps || 7} steps, max 7)`);
    console.log(`  - implementation-plan.md`);
    console.log(`  - notes.md, risks.md, decisions.md`);
    console.log(`  - Acceptance test (failing initially)`);
    console.log(`  - Evidence structure`);
  }

  private printNextSteps(): void {
    console.log('Next Steps:');
    console.log('');
    console.log(`  1. Update tier in run-manifest.json: fix | feature | refactor`);
    console.log(`  2. Fill in implementation steps in implementation-plan.md`);
    console.log(`  3. Write failing acceptance test in tests/acceptance/${this.options.slug}.spec.ts`);
    console.log(`  4. Review and update notes.md with context`);
    console.log(`  5. Perform research and document in research/`);
    console.log(`  6. Run vibe check: pnpm vibe-check --goal "${this.options.title}"`);
    console.log('');
    console.log('Validation:');
    console.log(`  pnpm arc:lint --manifest ~/Changelog/${this.options.slug}/run-manifest.json`);
    console.log('');
    console.log('Task directory:');
    console.log(`  ${this.baseDir}`);
    console.log('');
  }
}

// CLI Entry Point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options: Partial<ArcOptions> = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--slug':
        options.slug = args[++i];
        break;
      case '--title':
        options.title = args[++i];
        break;
      case '--steps':
        options.steps = Number.parseInt(args[++i], 10);
        break;
      case '--parent':
        options.parent = args[++i];
        break;
      case '--preview':
      case '--dry-run':
        options.preview = true;
        break;
      case '--inherit-plan':
        options.inheritPlan = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  // Validate required options
  if (!options.slug || !options.title) {
    console.error('❌ Error: --slug and --title are required\n');
    printHelp();
    process.exit(1);
  }

  // Validate step count
  if (options.steps && (options.steps < 1 || options.steps > 7)) {
    console.error('❌ Error: --steps must be between 1 and 7\n');
    process.exit(1);
  }

  const scaffolder = new ArcScaffolder(options as ArcOptions);
  await scaffolder.scaffold();
}

function printHelp(): void {
  console.log(`
Arc Scaffolding Tool

Usage: pnpm arc:new --slug <slug> --title "<title>" [options]

Required:
  --slug <slug>         Task slug (e.g., fix-auth-bug)
  --title "<title>"     Arc title (e.g., "Fix Authentication Bug")

Options:
  --steps <n>           Number of plan steps (1-7, default: 7)
  --parent <slug>       Parent arc slug (for chained arcs)
  --preview             Preview structure without creating files
  --inherit-plan        Inherit unfinished items from parent
  --help, -h            Show this help

Examples:
  # Create new arc
  pnpm arc:new --slug fix-auth-bug --title "Fix Authentication Bug" --steps 5

  # Create child arc
  pnpm arc:new --slug fix-auth-bug-2 --title "Fix Auth Bug (Arc 2)" --parent fix-auth-bug

  # Preview structure
  pnpm arc:new --slug test-arc --title "Test" --preview

Governance:
  - Arc follows ArcTDD workflow (R→G→F→REVIEW)
  - Max 7 steps per arc (enforced by arc:lint)
  - Creates complete evidence structure
  - Generates acceptance test (failing initially)
  - Sets up vibe-check, models, trace-context logs

See: .cortexdx/rules/agentic-coding-workflow.md
  `);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { ArcScaffolder, ArcOptions, ArcManifest };
