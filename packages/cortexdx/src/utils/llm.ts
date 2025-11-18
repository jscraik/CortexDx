/**
 * LLM Entry Point
 * Simplified API for interacting with the LLM provider system
 */

import {
  BUILTIN_PLUGINS,
  getLLMRegistry,
  type LLMProviderConfig,
  type QuestionInput,
  type QuestionOutput,
} from "../plugins/llm/index.js";
import { secureLogger } from "./security/secure-logger.js";

let registrySingleton: ReturnType<typeof getLLMRegistry> | null = null;

function registry(): ReturnType<typeof getLLMRegistry> {
  if (!registrySingleton) {
    registrySingleton = getLLMRegistry({
      plugins: BUILTIN_PLUGINS,
    });
  }
  return registrySingleton;
}

/**
 * Initialize all available LLM providers
 */
export async function initializeLLMs(): Promise<void> {
  await registry().initializeAll();
  secureLogger.info("LLM", "All available LLM providers initialized");
}

/**
 * Get list of available LLM providers
 */
export function getAvailableProviders(): string[] {
  return registry()
    .getAvailable()
    .map((p) => p.metadata.id);
}

/**
 * Simple LLM query function
 * @param prompt - The prompt to send to the LLM
 * @param options - Optional configuration
 * @returns The LLM response text
 */
export async function askLLM(
  prompt: string,
  options?: {
    provider?: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  }
): Promise<string> {
  const activeRegistry = registry();

  const { response } = await activeRegistry.generate(
    {
      prompt,
      systemPrompt: options?.systemPrompt,
      options: {
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        timeout: options?.timeout,
      },
    },
    options?.provider
  );

  return response.text;
}

/**
 * Generate response with automatic provider fallback
 * @param input - Structured question input
 * @returns Generated response
 */
export async function generateResponse(
  input: QuestionInput
): Promise<QuestionOutput> {
  const preferredProvider =
    input.modelOverride?.provider ||
    process.env.DEFAULT_LLM_PROVIDER ||
    undefined;
  const modelOverride = input.modelOverride?.model || process.env.DEFAULT_MODEL;

  const activeRegistry = registry();
  const userPinnedProvider = Boolean(input.modelOverride?.provider);
  const providerCandidates: string[] = [];
  const candidateSet = new Set<string>();

  const addCandidate = (id?: string) => {
    if (!id || candidateSet.has(id)) return;
    candidateSet.add(id);
    providerCandidates.push(id);
  };

  addCandidate(preferredProvider);

  if (!userPinnedProvider) {
    for (const plugin of activeRegistry.getAvailable()) {
      addCandidate(plugin.metadata.id);
    }
  }

  if (providerCandidates.length === 0) {
    throw new Error("No LLM providers available");
  }

  const options: LLMProviderConfig = {};
  if (modelOverride) {
    options.model = modelOverride;
  }

  // Build prompt from input
  const parts: string[] = [];
  if (input.goal) {
    parts.push(`Goal: ${input.goal}`);
  }
  if (input.plan) {
    parts.push(`Plan: ${input.plan}`);
  }
  if (input.progress) {
    parts.push(`Progress: ${input.progress}`);
  }
  if (input.uncertainties && input.uncertainties.length > 0) {
    parts.push(`Uncertainties:\n${input.uncertainties.map((u) => `- ${u}`).join("\n")}`);
  }
  if (input.taskContext) {
    parts.push(`Context: ${input.taskContext}`);
  }
  if (input.historySummary) {
    parts.push(`History: ${input.historySummary}`);
  }
  if (input.organizationalLearnings) {
    parts.push(`Learnings: ${input.organizationalLearnings}`);
  }
  if (input.userPrompt) {
    parts.push(`\n${input.userPrompt}`);
  }

  const fullPrompt = parts.join("\n\n");

  let lastError: unknown;

  for (const candidateId of providerCandidates) {
    const resolved = await activeRegistry.ensurePlugin(candidateId);
    if (!resolved) {
      if (userPinnedProvider) {
        throw new Error(`Provider ${candidateId} is not available`);
      }
      continue;
    }

    const { plugin, context } = resolved;

    try {
      const result = await plugin.generate(
        {
          prompt: fullPrompt,
          options,
          systemPrompt: "You are a helpful AI assistant.",
        },
        context
      );

      return { questions: result.text };
    } catch (error) {
      lastError = error;
      secureLogger.warn("LLM", "Provider failed; checking next candidate", {
        providerId: candidateId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (userPinnedProvider) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("All LLM providers failed");
}

/**
 * Reset the LLM registry (useful for testing)
 */
export function resetLLM(): void {
  registrySingleton = null;
}
