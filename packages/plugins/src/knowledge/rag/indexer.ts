import type { SpecContent } from "@brainwav/cortexdx-core";
import type { EmbeddingAdapter } from "../../adapters/embedding.js";
import { type VectorStorage, createReferenceDocument } from "../../storage/vector-storage.js";
import type { SearchResult, SpecChunker, SpecIndexer } from "./types.js";

export class DefaultSpecIndexer implements SpecIndexer {
    constructor(
        private storage: VectorStorage,
        private embedding: EmbeddingAdapter,
        private chunker: SpecChunker
    ) { }

    async index(spec: SpecContent): Promise<void> {
        const chunks = this.chunker.chunk(spec);

        // Generate embeddings in batch
        const embeddings = await this.embedding.embedBatch({
            texts: chunks.map(c => c.content),
            normalize: true
        });

        // Create vector documents
        const documents = chunks.map((chunk, i) => {
            const embedding = embeddings[i];
            if (!embedding) {
                throw new Error(`Failed to generate embedding for chunk ${chunk.id}`);
            }

            return createReferenceDocument({
                id: chunk.id,
                text: chunk.content,
                version: chunk.version,
                url: `/specification/${chunk.version}/${chunk.section}`,
                sourceId: chunk.section,
                order: i,
                sha256: "", // TODO: Calculate hash if needed
                title: chunk.metadata.header,
                metadata: chunk.metadata as Record<string, unknown>
            }, embedding);
        });

        await this.storage.addDocuments(documents);
    }

    async search(query: string, limit = 5): Promise<SearchResult[]> {
        const queryEmbedding = await this.embedding.embed({
            text: query,
            normalize: true
        });

        const results = await this.storage.search(queryEmbedding, {
            topK: limit,
            filterType: "reference"
        });

        return results.map(r => ({
            chunk: {
                id: r.document.id.replace("reference_", ""),
                section: r.document.metadata.context.sourceId as string,
                version: r.document.metadata.context.version as string,
                content: r.document.metadata.text,
                metadata: r.document.metadata.context.metadata as any
            },
            similarity: r.similarity,
            rank: r.rank
        }));
    }
}
