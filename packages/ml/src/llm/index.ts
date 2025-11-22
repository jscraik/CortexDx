import { secureLogger } from "./secure-logger.js";
import { getLLMRegistry } from "./registry.js";
import type { LLMProviderConfig, GenerateInput, GenerateOutput } from "./types.js";

let registrySingleton: ReturnType<typeof getLLMRegistry> | null = null;

function registry(): ReturnType<typeof getLLMRegistry> {
  if (!registrySingleton) {
    registrySingleton = getLLMRegistry();
  }
  return registrySingleton;
}

function buildCandidates(
  preferredProvider: string | undefined,
  available: string[],
  userPinnedProvider: boolean,
): string[] {
  const providerCandidates: string[] = [];
  const candidateSet = new Set<string>();
  const addCandidate = (id?: string) => {
    if (!id || candidateSet.has(id)) return;
    candidateSet.add(id);
    providerCandidates.push(id);
  };
  addCandidate(preferredProvider);
  if (!userPinnedProvider) {
    for (const id of available) addCandidate(id);
  }
  return providerCandidates;
}

export async function initializeLLMs(): Promise<void> {
  await registry().initializeAll();
}

function buildOptions(modelOverride?: string): LLMProviderConfig {
  return modelOverride ? { model: modelOverride } : {};
}

async function generateWithCandidates(
  providerCandidates: string[],
  activeRegistry: ReturnType<typeof getLLMRegistry>,
  input: GenerateInput,
  userPinnedProvider: boolean,
  options: LLMProviderConfig,
): Promise<GenerateOutput> {
  let lastError: unknown;
  for (const candidateId of providerCandidates) {
    const resolved = await activeRegistry.ensurePlugin(candidateId);
    if (!resolved) {
      if (userPinnedProvider) throw new Error(`Provider ${candidateId} is not available`);
      continue;
    }
    const { plugin, context } = resolved;
    try {
      const result = await plugin.generate(
        { prompt: input.prompt, options, systemPrompt: input.systemPrompt || "You are a helpful assistant." },
        context,
      );
      return { text: result.text, model: result.model, provider: plugin.metadata.id, usage: result.usage };
    } catch (error) {
      lastError = error;
      secureLogger.warn("LLM", "Provider failed; checking next candidate", {
        providerId: candidateId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (userPinnedProvider) throw error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error("All LLM providers failed");
}

export async function generateResponse(input: GenerateInput): Promise<GenerateOutput> {
  const preferredProvider = input.modelOverride?.provider || process.env.DEFAULT_LLM_PROVIDER || undefined;
  const modelOverride = input.modelOverride?.model || process.env.DEFAULT_MODEL;
  const activeRegistry = registry();
  const userPinnedProvider = Boolean(input.modelOverride?.provider);
  const available = activeRegistry.getAvailable().map((plugin) => plugin.metadata.id);
  const providerCandidates = buildCandidates(preferredProvider, available, userPinnedProvider);
  if (providerCandidates.length === 0) {
    throw new Error("No LLM providers available");
  }
  return generateWithCandidates(
    providerCandidates,
    activeRegistry,
    input,
    userPinnedProvider,
    buildOptions(modelOverride),
  );
}

export async function askLLM(
  prompt: string,
  options?: {
    provider?: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  const activeRegistry = registry();
  const { response } = await activeRegistry.generate(
    { prompt, systemPrompt: options?.systemPrompt, options: { model: options?.model, temperature: options?.temperature, maxTokens: options?.maxTokens } },
    options?.provider,
  );
  return response.text;
}

export function getAvailableProviders(): string[] {
  return registry().getAvailable().map((plugin) => plugin.metadata.id);
}

export function getProviderMetadata() {
  return registry().getMetadata();
}
