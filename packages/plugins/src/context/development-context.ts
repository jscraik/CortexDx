import type { ChatMessage, DevelopmentContext, DiagnosticContext, EnhancedLlmAdapter } from "@brainwav/cortexdx-core";
import { createConversationalAdapter } from "@brainwav/cortexdx-ml";

export interface DevelopmentContextOptions {
    baseContext: DiagnosticContext;
    sessionId: string;
    expertise: DevelopmentContext["userExpertiseLevel"];
    history?: ChatMessage[];
    enhancedLlm?: EnhancedLlmAdapter | null;
    projectContext?: DevelopmentContext["projectContext"];
    deterministic?: boolean;
}

export function createDevelopmentContext(options: DevelopmentContextOptions): DevelopmentContext {
    const {
        baseContext,
        sessionId,
        expertise,
        history = [],
        enhancedLlm = null,
        projectContext,
        deterministic,
    } = options;

    const conversationalLlm = enhancedLlm
        ? createConversationalAdapter(enhancedLlm, {
            deterministic,
        })
        : undefined;

    return {
        ...baseContext,
        sessionId,
        userExpertiseLevel: expertise,
        conversationHistory: history,
        projectContext,
        conversationalLlm,
    };
}
