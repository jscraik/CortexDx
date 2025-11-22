import type { SpecContent } from "@brainwav/cortexdx-core";
import type { EmbeddingAdapter } from "../../adapters/embedding.js";
import type { IVectorStorage } from "../../storage/vector-storage.js";
import { MarkdownSpecChunker } from "./chunker.js";
import { DefaultSpecIndexer } from "./indexer.js";
import type { KnowledgeRAG, SearchResult, SpecChunker, SpecIndexer } from "./types.js";

export interface KnowledgeRagOptions {
    storage: IVectorStorage;
    embedding: EmbeddingAdapter;
    chunker?: SpecChunker;
    indexer?: SpecIndexer;
}

export class KnowledgeRagImpl implements KnowledgeRAG {
    private indexer: SpecIndexer;

    constructor(options: KnowledgeRagOptions) {
        const chunker = options.chunker ?? new MarkdownSpecChunker();
        this.indexer = options.indexer ?? new DefaultSpecIndexer(
            options.storage,
            options.embedding,
            chunker
        );
    }

    async indexSpec(spec: SpecContent): Promise<void> {
        await this.indexer.index(spec);
    }

    async search(query: string, options?: { limit?: number; minSimilarity?: number }): Promise<SearchResult[]> {
        return this.indexer.search(query, options?.limit);
    }
}

export function createKnowledgeRag(options: KnowledgeRagOptions): KnowledgeRAG {
    return new KnowledgeRagImpl(options);
}
