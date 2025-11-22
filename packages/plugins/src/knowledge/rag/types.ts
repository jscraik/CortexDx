import type { SpecContent } from "@brainwav/cortexdx-core";

export interface SpecChunk {
    id: string;
    section: string;
    version: string;
    content: string;
    metadata: {
        startIndex: number;
        endIndex: number;
        header?: string;
        level?: number;
    };
}

export interface SearchResult {
    chunk: SpecChunk;
    similarity: number;
    rank: number;
}

export interface SpecChunker {
    chunk(spec: SpecContent): SpecChunk[];
}

export interface SpecIndexer {
    index(spec: SpecContent): Promise<void>;
    search(query: string, limit?: number): Promise<SearchResult[]>;
}

export interface KnowledgeRAG {
    indexSpec(spec: SpecContent): Promise<void>;
    search(query: string, options?: { limit?: number; minSimilarity?: number }): Promise<SearchResult[]>;
}
