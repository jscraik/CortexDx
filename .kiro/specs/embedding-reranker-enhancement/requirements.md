# Requirements Document

## Introduction

This specification defines the integration of advanced embedding and reranker models into CortexDx to enhance diagnostic accuracy, reduce noise in findings, and improve the efficiency of pattern recognition, academic research aggregation, and plugin orchestration. The enhancement leverages the existing RAG infrastructure and extends it across multiple diagnostic workflows.

## Glossary

- **CortexDx**: The stateless, read-only Model Context Protocol (MCP) Meta-Inspector diagnostic system
- **RAG System**: Retrieval-Augmented Generation system using embeddings for semantic search
- **Reranker**: A model that reorders search results based on relevance to a specific query context
- **Embedding Model**: A neural network that converts text into dense vector representations for semantic similarity
- **Finding**: A diagnostic result produced by a CortexDx plugin with severity, evidence, and recommendations
- **Pattern Storage**: Persistent storage for resolution patterns learned from successful diagnostic sessions
- **Vector Storage**: In-memory or persistent storage for embedding vectors with semantic search capabilities
- **Academic Provider**: External research APIs (Context7, Exa, OpenAlex, arXiv, etc.) that supply research findings
- **Plugin**: A sandboxed diagnostic module that probes specific MCP capabilities (auth, streaming, CORS, etc.)
- **DeepContext**: A semantic code search system that indexes and queries codebases
- **Ollama**: Local LLM inference runtime supporting embedding and chat models

## Requirements

### Requirement 1: Embedding Model Infrastructure

**User Story:** As a CortexDx developer, I want a unified embedding model management system so that all diagnostic workflows can leverage consistent semantic representations.

#### Acceptance Criteria

1. WHEN the system initializes, THE Embedding Registry SHALL load available embedding models from config/ollama-models.json
2. WHEN an embedding request is made, THE Embedding Router SHALL select the appropriate model based on task type and context length requirements
3. WHEN qwen3-embed is available, THE system SHALL use it as the default for high-accuracy semantic search tasks
4. WHEN nomic-embed is available, THE system SHALL use it as the fallback for general embedding tasks
5. WHERE memory constraints exist, THE system SHALL use granite-embed for lightweight embedding tasks

### Requirement 2: Reranker Model Integration

**User Story:** As a CortexDx operator, I want reranker models to improve result relevance so that diagnostic findings and research results prioritize the most actionable information.

#### Acceptance Criteria

1. THE system SHALL support cross-encoder reranker models via Ollama
2. WHEN multiple search results exist, THE Reranker SHALL reorder them by semantic relevance to the query context
3. WHEN a reranker model is unavailable, THE system SHALL fall back to cosine similarity ranking
4. THE Reranker SHALL accept a query context and a list of candidate documents as input
5. THE Reranker SHALL return a ranked list with confidence scores between 0.0 and 1.0

### Requirement 3: Academic Research Deduplication and Reranking

**User Story:** As a researcher using CortexDx, I want academic findings from multiple providers to be deduplicated and ranked by relevance so that I can quickly identify the most pertinent research.

#### Acceptance Criteria

1. WHEN academic research results are collected from multiple providers, THE system SHALL compute embeddings for each finding
2. WHEN two findings have cosine similarity > 0.85, THE system SHALL mark them as potential duplicates
3. WHEN duplicate findings are detected, THE system SHALL merge them and preserve all unique evidence pointers
4. WHEN all findings are collected, THE Reranker SHALL reorder them based on relevance to the research query
5. THE system SHALL preserve provider attribution in merged findings

### Requirement 4: Enhanced Pattern Recognition with Hybrid Reranking

**User Story:** As a diagnostic user, I want the RAG system to suggest the most relevant solutions based on both semantic similarity and historical success patterns so that resolution time is minimized.

#### Acceptance Criteria

1. WHEN a problem is submitted to the RAG system, THE system SHALL retrieve candidate solutions using vector search
2. WHEN candidate solutions are retrieved, THE Pattern Matcher SHALL score them based on historical success rates
3. WHEN both vector and pattern scores exist, THE Hybrid Reranker SHALL combine them with configurable weights
4. THE Hybrid Reranker SHALL apply a weight of 0.6 for semantic similarity and 0.4 for pattern confidence by default
5. WHERE user feedback exists, THE system SHALL adjust reranking weights based on feedback quality scores

### Requirement 5: Context-Aware Plugin Selection

**User Story:** As a CortexDx operator, I want the system to intelligently recommend relevant plugins based on endpoint characteristics so that diagnostic runtime is reduced without sacrificing coverage.

#### Acceptance Criteria

1. THE system SHALL maintain embeddings for each plugin's description and capabilities
2. WHEN a diagnostic session starts, THE system SHALL embed the endpoint URL, headers, and initial probe results
3. WHEN plugin selection is requested, THE system SHALL compute semantic similarity between context and plugin embeddings
4. THE system SHALL recommend plugins with similarity scores > 0.65 for targeted diagnostics
5. WHERE --full mode is enabled, THE system SHALL run all plugins regardless of similarity scores

### Requirement 6: DeepContext Query Enhancement

**User Story:** As a developer debugging MCP issues, I want DeepContext queries to be generated from conversation context so that code search results are more relevant to the current diagnostic focus.

#### Acceptance Criteria

1. WHEN a DeepContext search is triggered, THE system SHALL embed the last 5 conversation messages
2. WHEN conversation embeddings are computed, THE Query Generator SHALL extract semantic themes using clustering
3. THE Query Generator SHALL construct a search query combining extracted themes with diagnostic keywords
4. WHEN DeepContext returns results, THE Reranker SHALL reorder code matches by relevance to current findings
5. THE system SHALL limit DeepContext results to the top 10 reranked matches to reduce noise

### Requirement 7: Finding Correlation and Root Cause Analysis

**User Story:** As a diagnostic analyst, I want related findings to be clustered together so that I can identify root causes rather than treating symptoms individually.

#### Acceptance Criteria

1. WHEN multiple findings are collected, THE system SHALL compute embeddings for each finding's description
2. WHEN finding embeddings are computed, THE Clustering Engine SHALL group findings with similarity > 0.75
3. WHEN findings are clustered, THE Root Cause Analyzer SHALL identify the most severe finding in each cluster as a potential root cause
4. THE system SHALL annotate related findings with references to their cluster root cause
5. WHERE a cluster contains findings from multiple plugins, THE system SHALL create a cross-plugin correlation finding

### Requirement 8: Evidence Prioritization

**User Story:** As a report reviewer, I want evidence items to be ranked by relevance and information density so that I can focus on the most diagnostic evidence first.

#### Acceptance Criteria

1. WHEN a finding contains multiple evidence pointers, THE system SHALL embed the text content of each evidence item
2. WHEN evidence embeddings are computed, THE Evidence Ranker SHALL score each item by semantic relevance to the finding description
3. THE Evidence Ranker SHALL apply a recency boost of 0.1 to evidence items from the last 24 hours
4. THE system SHALL reorder evidence items by combined relevance and recency scores
5. WHERE evidence items are semantically similar (> 0.9), THE system SHALL deduplicate and keep the most recent

### Requirement 9: LLM Conversation Context Optimization

**User Story:** As a CortexDx operator, I want LLM conversation history to be pruned intelligently so that token usage is minimized while maintaining context coherence.

#### Acceptance Criteria

1. WHEN an LLM conversation exceeds 8000 tokens, THE Context Pruner SHALL embed all conversation messages
2. WHEN message embeddings are computed, THE Context Pruner SHALL identify the 5 most relevant messages to the current query
3. THE Context Pruner SHALL always retain the system prompt and the last 2 user messages
4. THE system SHALL construct a pruned context from retained messages in chronological order
5. WHERE pruning reduces context by > 50%, THE system SHALL log a context compression metric

### Requirement 10: Cross-Session Pattern Learning

**User Story:** As a CortexDx system administrator, I want diagnostic patterns to be learned across sessions so that the system improves over time based on collective resolution history.

#### Acceptance Criteria

1. WHEN a diagnostic session completes successfully, THE system SHALL embed the problem-solution pair
2. WHEN session embeddings are computed, THE Pattern Storage SHALL persist them to disk with success metadata
3. WHEN a new problem is submitted, THE system SHALL search historical session embeddings for similar cases
4. THE system SHALL retrieve the top 5 most similar historical sessions with similarity > 0.7
5. WHERE historical sessions exist, THE system SHALL suggest solutions that succeeded in similar contexts

### Requirement 11: Performance and Determinism

**User Story:** As a CortexDx contributor, I want embedding and reranking operations to be deterministic and performant so that CI/CD pipelines remain fast and reproducible.

#### Acceptance Criteria

1. WHEN --deterministic mode is enabled, THE system SHALL use fixed random seeds for any stochastic operations
2. THE system SHALL cache embedding results for identical inputs within a session
3. WHEN embedding batch operations are performed, THE system SHALL process them with a concurrency limit of 5
4. THE system SHALL complete embedding operations for typical diagnostic findings in < 500ms
5. WHERE Ollama is unavailable, THE system SHALL fall back to keyword-based similarity without blocking diagnostics

### Requirement 12: Configuration and Model Management

**User Story:** As a CortexDx operator, I want to configure embedding and reranker models via environment variables and config files so that I can optimize for my hardware and use case.

#### Acceptance Criteria

1. THE system SHALL read embedding model preferences from CORTEXDX_EMBEDDING_MODEL environment variable
2. THE system SHALL read reranker model preferences from CORTEXDX_RERANKER_MODEL environment variable
3. WHEN config/ollama-models.json is updated, THE system SHALL reload model configurations without restart
4. THE system SHALL validate that selected models are available in Ollama before attempting to use them
5. WHERE a configured model is unavailable, THE system SHALL log a warning and fall back to the next priority model

### Requirement 13: Observability and Metrics

**User Story:** As a CortexDx developer, I want to monitor embedding and reranking performance so that I can identify bottlenecks and optimize model selection.

#### Acceptance Criteria

1. THE system SHALL emit OTEL spans for embedding operations with model name and duration attributes
2. THE system SHALL emit OTEL spans for reranking operations with candidate count and top-k attributes
3. WHEN embeddings are cached, THE system SHALL track cache hit rate as a metric
4. THE system SHALL log embedding dimension mismatches as warnings
5. WHERE reranking changes result order significantly (> 3 position changes), THE system SHALL log the reranking impact

### Requirement 14: Testing and Validation

**User Story:** As a CortexDx contributor, I want comprehensive tests for embedding and reranking functionality so that regressions are caught early.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests for embedding adapter initialization and model selection
2. THE test suite SHALL include integration tests for reranker model inference with mock Ollama responses
3. THE test suite SHALL validate that deterministic mode produces identical embeddings across runs
4. THE test suite SHALL verify that fallback mechanisms work when models are unavailable
5. THE test suite SHALL include performance benchmarks for embedding and reranking operations

### Requirement 15: Documentation and Migration

**User Story:** As a CortexDx user, I want clear documentation on how to configure and use embedding and reranking features so that I can leverage them effectively.

#### Acceptance Criteria

1. THE README SHALL document the new CORTEXDX_EMBEDDING_MODEL and CORTEXDX_RERANKER_MODEL environment variables
2. THE documentation SHALL include examples of configuring reranker models in config/ollama-models.json
3. THE documentation SHALL explain the performance trade-offs between different embedding models
4. THE migration guide SHALL document how existing RAG system users can enable reranking
5. THE documentation SHALL include troubleshooting steps for common embedding and reranking issues
