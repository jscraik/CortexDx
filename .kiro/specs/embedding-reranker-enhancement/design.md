# Design Document: Embedding and Reranker Enhancement

## Overview

This design extends CortexDx's existing RAG infrastructure with advanced embedding model management and
cross-encoder reranking capabilities. The enhancement integrates seamlessly with the current `learning/`,
`adapters/`, and `storage/` modules to improve diagnostic accuracy, reduce noise, and optimize pattern
recognition across multiple workflows including academic research, plugin selection, finding correlation,
and DeepContext queries.

### Goals

- Unified embedding model registry with automatic fallback
- Cross-encoder reranker integration via Ollama
- Hybrid ranking combining semantic similarity and historical patterns
- Academic research deduplication and relevance ranking
- Context-aware plugin selection based on endpoint characteristics
- Finding correlation and root cause clustering
- Evidence prioritization by relevance and recency
- LLM conversation context pruning
- Cross-session pattern learning with persistent embeddings
- Deterministic operation for CI/CD reproducibility

### Non-Goals

- Training custom embedding or reranker models
- Real-time model fine-tuning
- GPU-accelerated inference (relies on Ollama's capabilities)
- Distributed vector storage (single-node only)

## Architecture

### High-Level Component Diagram

```mermaid
graph TB
    subgraph "Embedding Layer"
        ER[EmbeddingRegistry]
        EM[EmbeddingRouter]
        EC[EmbeddingCache]
    end

    subgraph "Reranking Layer"
        RR[RerankerAdapter]
        HR[HybridReranker]
        PM[PatternMatcher]
    end

    subgraph "Application Layer"
        AR[AcademicResearcher]
        PS[PluginSelector]
        FC[FindingCorrelator]
        DC[DeepContextEnhancer]
        CP[ContextPruner]
    end

    subgraph "Storage Layer"
        VS[VectorStorage]
        PS2[PatternStorage]
        SS[SessionStorage]
    end

    subgraph "External"
        OL[Ollama]
    end

    ER --> EM
    EM --> EC
    EM --> OL
    RR --> OL
    HR --> RR
    HR --> PM
    
    AR --> EM
    AR --> HR
    PS --> EM
    FC --> EM
    FC --> HR
    DC --> EM
    DC --> HR
    CP --> EM

    AR --> VS
    PS --> VS
    FC --> VS
    DC --> VS
    
    PM --> PS2
    HR --> PS2
    
    CP --> SS
