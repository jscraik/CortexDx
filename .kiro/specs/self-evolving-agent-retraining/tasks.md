# Implementation Plan

This plan converts the self-evolving agent retraining design into discrete, actionable coding tasks. Each task builds incrementally on previous work, with all code integrated (no orphaned implementations). Tasks focus exclusively on writing, modifying, or testing code.

## Task Structure

- Top-level tasks represent major implementation phases
- Sub-tasks are numbered with decimal notation (e.g., 1.1, 1.2)
- Tasks marked with `*` are optional (primarily testing-related)
- Each task references specific requirements from requirements.md

---

- [ ] 1. Set up package scaffold and observability infrastructure
  - Create `packages/agent-retraining-cxdx/` with ESM package.json (type: "module", no default exports)
  - Create tsconfig.json with strict TypeScript options and NodeNext module resolution
  - Implement parametric logger in `src/lib/logger.ts` that accepts brand, trace_id, and traceparent
  - Implement OTel tracer helper in `src/lib/otel.ts` with `withSpan` function for instrumentation
  - Wire logger and tracer to use existing CortexDx pino and @opentelemetry/api dependencies
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2_

- [ ] 2. Implement grading modules and aggregation
  - [ ] 2.1 Implement length grader
    - Create `src/graders/length-score.ts` with pure function (≤40 lines)
    - Implement word count calculation and deviation penalty
    - Return normalized score [0, 1]
    - _Requirements: 2.1, 2.5, 13.2_
  
  - [ ] 2.2 Implement similarity grader
    - Create `src/graders/similarity.ts` that reuses `packages/cortexdx/src/adapters/ollama-embedding.ts`
    - Implement embedding generation for expected and actual outputs
    - Use `cosineSimilarity` helper from existing embedding adapter
    - Support Ollama embedding models (nomic-embed-text, mxbai-embed-large)
    - _Requirements: 2.2, 2.5, 14.3_
  
  - [ ] 2.3 Implement entity grader
    - Create `src/graders/entities.ts` with exact-match entity checker
    - Accept list of required entities and output text
    - Return fraction of required entities found
    - _Requirements: 2.3, 2.5, 13.2_
  
  - [ ] 2.4 Implement LLM judge grader
    - Create `src/graders/llm-judge.ts` that reuses `packages/cortexdx/src/adapters/ollama.ts`
    - Implement rubric-based evaluation using Ollama (llama3.2, mistral)
    - Parse LLM response to extract normalized score
    - Handle LLM failures gracefully (return 0 on error)
    - _Requirements: 2.4, 2.5, 14.3_
  
  - [ ] 2.5 Implement weighted aggregation
    - Create `src/loop/aggregate.ts` with configurable weights
    - Implement weighted average calculation with 3 decimal precision
    - Compare aggregated score against threshold for pass/fail determination
    - Return structured result with individual grader scores for transparency
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 13.2_
  
  - [ ] 2.6 Write property-based tests for graders
    - Use fast-check to test grader monotonicity and bounds
    - Test aggregation weight application and threshold boundaries
    - Test edge cases (empty strings, very long inputs, exact targets)
    - _Requirements: 9.4_

- [ ] 3. Implement prompt management and meta-optimization
  - [ ] 3.1 Implement prompt registry
    - Create `src/prompt/prompt-registry.ts` with versioned storage
    - Implement version increment logic (monotonic, starting at 0)
    - Add ISO 8601 timestamp recording for each version
    - Implement current(), push(), get(v), and history() methods
    - _Requirements: 5.1, 5.2, 5.5, 13.2_
  
  - [ ] 3.2 Implement meta-optimizer
    - Create `src/loop/meta-optimize.ts` that reuses Ollama adapter
    - Build improvement prompt from grader feedback and dataset examples
    - Call Ollama LLM (llama3.2, mistral) to generate improved system prompt
    - Keep function ≤40 lines by delegating prompt construction to helpers
    - Support AbortSignal for cancellation
    - _Requirements: 5.3, 5.4, 8.3, 13.2, 14.3_
  
  - [ ] 3.3 Implement experience record storage
    - Create `src/experience/experience.ts` with ExperienceRecord interface
    - Implement storeExperience() function that writes to JSON or SQLite
    - Exclude sensitive data (API keys, user IDs, proprietary content)
    - Include problem signature, scores, prompt versions, optimization strategy, parameters, elapsed time
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 4. Implement orchestration loop and integrations
  - [ ] 4.1 Implement self-evolving loop orchestrator
    - Create `src/loop/self-evolving-loop.ts` with main retraining logic
    - Implement evaluate→optimize→promote cycle with retry limits
    - Support configurable threshold and maxRetries parameters
    - Propagate AbortSignal to all graders and optimizers
    - Emit OTel spans for evaluate, optimize, and promote operations
    - Return promotion result with score and version number
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [ ] 4.2 Implement MCP audit integration
    - Create `src/integrations/mcp-audit.ts` that reuses existing MCP audit infrastructure
    - Emit events: retraining.evaluation.started, retraining.promotion.success, retraining.promotion.failed
    - Include trace context, scores, and version information in events
    - _Requirements: 6.4, 14.4_
  
  - [ ] 4.3 Implement A2A promotion integration
    - Create `src/integrations/a2a-events.ts` that reuses existing A2A protocol handlers
    - Send promotion envelope with prompt version, aggregated score, timestamp
    - Include brand and trace context in messages
    - _Requirements: 6.5, 14.5_
  
  - [ ] 4.4 Wire experience records to loop
    - Integrate experience record creation in selfEvolvingLoop after successful promotion
    - Capture initial score, final score, prompt versions, optimization strategy, elapsed time
    - Store experience asynchronously to avoid blocking promotion
    - _Requirements: 7.1, 7.2, 7.5_

- [ ] 5. Implement comprehensive test suite
  - [ ] 5.1 Write unit tests for graders
    - Test lengthScore with boundary inputs (empty, very short, very long, exact target)
    - Test similarityScore with identical and completely different texts
    - Test entities grader with all found, none found, partial found scenarios
    - Test llmJudge with mocked Ollama responses
    - _Requirements: 9.4, 9.5_
  
  - [ ] 5.2 Write unit tests for aggregation
    - Test weight application with known grader scores
    - Test threshold boundaries (exactly at threshold, just below, just above)
    - Test edge cases (all zeros, all ones, mixed scores)
    - _Requirements: 9.4, 9.5_
  
  - [ ] 5.3 Write unit tests for prompt registry
    - Test version increment logic (monotonic, no gaps)
    - Test retrieval of current, historical, and non-existent versions
    - Test timestamp recording
    - _Requirements: 9.4, 9.5_
  
  - [ ] 5.4 Write North-Star integration test
    - Implement end-to-end test that validates retraining loop reaches ≥0.80 threshold within ≤3 retries
    - Use mock agent and graders with deterministic behavior
    - Verify promotion event emission and experience record creation
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 5.5 Write cancellation and error handling tests
    - Test graceful shutdown on AbortSignal trigger
    - Test grader failure scenarios (return 0, continue with remaining graders)
    - Test LLM failure scenarios (no prompt update, continue with current prompt)
    - Test timeout handling
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.4, 9.5_
  
  - [ ] 5.6 Configure and run mutation testing
    - Update `tools/ci/stryker.conf.js` to include agent-retraining-cxdx package
    - Set mutation thresholds (high: 80, low: 75, break: 75)
    - Run Stryker and verify ≥75% mutation score
    - Fix any surviving mutants in critical paths (aggregation, threshold checks, retry limits)
    - _Requirements: 9.1, 9.2_
  
  - [ ] 5.7 Verify coverage gates
    - Run Vitest with coverage reporting
    - Verify package-level coverage ≥90%
    - Identify and cover any missing branches or error paths
    - _Requirements: 9.1, 9.2_

- [ ] 6. Implement CLI and configuration
  - [ ] 6.1 Create CLI entry point
    - Create `apps/self-evolving-evals-cxdx/cli.ts` with command-line interface
    - Implement --json flag for machine-readable output
    - Implement --stream-json flag for line-delimited JSON progress updates
    - Implement --threshold, --retries, --traceparent flags
    - Wire CLI to selfEvolvingLoop orchestrator
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 6.2 Implement feature flags and environment configuration
    - Support CXDX_RETRAIN_ENABLED environment variable (default: false)
    - Support BRAND environment variable (default: "CortexDx")
    - Support LOG_LEVEL environment variable (default: "info")
    - Support OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_EMBEDDING_MODEL
    - Log feature flag status at startup
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [ ] 6.3 Wire CLI to package.json scripts
    - Add bin entry in package.json for cortexdx-retrain command
    - Add pnpm scripts for common operations (train, evaluate, rollback)
    - Ensure CLI respects Nx workspace conventions
    - _Requirements: 10.1, 10.5_

- [ ] 7. Create documentation and governance artifacts
  - [ ] 7.1 Write runbook
    - Create `docs/agent-retraining-cxdx.md` with operational procedures
    - Document threshold tuning guidelines
    - Document rollback procedures (disable flag, revert prompt version)
    - Document monitoring and alerting recommendations
    - _Requirements: 11.1_
  
  - [ ] 7.2 Write Architecture Decision Record
    - Create `docs/adr/ADR-self-evolving-cxdx.md` explaining design choices
    - Document rationale for Ollama vs OpenAI
    - Document rationale for weighted aggregation approach
    - Document rationale for versioned prompt registry
    - Document trade-offs and alternatives considered
    - _Requirements: 11.2_
  
  - [ ] 7.3 Write evaluation report (model card)
    - Create `model-cards/evals/self-evolving-cxdx.md` with evaluation metrics
    - Document grader descriptions and weights
    - Document quality thresholds and non-regression criteria
    - Document validation procedures and test results
    - _Requirements: 11.3, 11.4_
  
  - [ ] 7.4 Update main README
    - Add section on self-evolving agent retraining
    - Link to runbook, ADR, and model card
    - Document CLI usage examples
    - _Requirements: 11.5_

- [ ] 8. Configure CI gates and supply chain security
  - [ ] 8.1 Wire package to CI pipeline
    - Update CI configuration to run pnpm lint, pnpm test, pnpm build for agent-retraining-cxdx
    - Ensure tests run with CORTEXDX_RUN_INTEGRATION=1 for integration tests
    - Configure test timeout for Ollama-dependent tests
    - _Requirements: 9.1, 9.2_
  
  - [ ] 8.2 Generate SBOM and provenance
    - Add CycloneDX SBOM generation to CI build step
    - Add SLSA provenance attestation to package release workflow
    - Store SBOM and attestations in `.plan/self-evolving-agent-retraining/sbom/` and `attestations/`
    - _Requirements: 12.1, 12.2, 12.5_
  
  - [ ] 8.3 Configure security scans
    - Add Semgrep scan for agent-retraining-cxdx package
    - Add gitleaks scan for secrets detection
    - Configure CI to fail on high-severity vulnerabilities
    - _Requirements: 12.3, 12.4_
  
  - [ ] 8.4 Create concurrency report
    - Write `.plan/self-evolving-agent-retraining/json/concurrency-report.json`
    - Document parallelizable tasks (Task 2 graders, Task 7 docs)
    - Document serial dependencies (Task 1 → Task 2 → Task 3 → Task 4)
    - Suggest execution order for optimal development flow
    - _Requirements: N/A (process artifact)_
