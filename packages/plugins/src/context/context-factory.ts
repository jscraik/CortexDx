import { httpAdapter } from "../adapters/http.js";
import type {
    DiagnosticArtifacts,
    DiagnosticContext,
    EvidencePointer,
    LlmAdapter,
} from "@brainwav/cortexdx-core";
import { loadArtifactsFromEnv } from "./artifacts.js";
import { createInspectorSession, type SharedSessionState } from "./inspector-session.js";
import { createDefaultKnowledgeOrchestrator } from "../knowledge/default-orchestrator.js";

export interface DiagnosticContextOptions {
    endpoint: string;
    headers: Record<string, string>;
    deterministic: boolean;
    deterministicSeed?: number;
    sessionOptions?: { preinitialized?: boolean; sharedState?: SharedSessionState };
    llm?: LlmAdapter | null;
}

export function createDiagnosticContext(options: DiagnosticContextOptions): DiagnosticContext {
    const { endpoint, headers, deterministic, deterministicSeed, sessionOptions, llm = null } = options;
    const session = createInspectorSession(endpoint, headers, sessionOptions);
    const baseHeaders = headers ?? {};
    const knowledge = createDefaultKnowledgeOrchestrator();

    const request = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
        const mergedHeaders =
            Object.keys(baseHeaders).length === 0 && !init?.headers
                ? init?.headers
                : {
                      ...baseHeaders,
                      ...(init?.headers as Record<string, string> | undefined),
                  };
        const nextInit = mergedHeaders ? { ...(init ?? {}), headers: mergedHeaders } : init;
        return httpAdapter<T>(input, nextInit);
    };

    const context: DiagnosticContext = {
        endpoint,
        headers: baseHeaders,
        logger: (...args: unknown[]) => {
            if (deterministic) {
                // eslint-disable-next-line no-console
                console.debug("[cortexdx]", ...args);
            } else {
                // eslint-disable-next-line no-console
                console.log("[cortexdx]", ...args);
            }
        },
        request,
        jsonrpc: session.jsonrpc,
        sseProbe: session.sseProbe,
        evidence: (ev: EvidencePointer) => {
            // eslint-disable-next-line no-console
            console.debug("[evidence]", ev);
        },
        deterministic,
        deterministicSeed,
        transport: session.transport,
        artifacts: loadArtifactsFromEnv(),
        knowledge,
        llm,
    };

    return context;
}

// exported via artifacts module
