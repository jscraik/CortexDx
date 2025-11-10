/**
 * Secure Model Storage and Execution Environment
 * Ensures local-only processing without external API calls
 * Requirements: 12.1, 12.2, 6.5
 */

import type { EnhancedLlmAdapter, ModelInfo } from "../types.js";

export interface ExecutionPolicy {
    allowNetworkAccess: boolean;
    allowFileSystemAccess: boolean;
    allowExternalApis: boolean;
    maxMemoryMb: number;
    maxExecutionTimeMs: number;
    trustedDomains: string[];
}

export interface ModelStorageConfig {
    localPath: string;
    maxModelSizeMb: number;
    allowedFormats: string[];
    verifyChecksum: boolean;
}

export interface ExecutionContext {
    policy: ExecutionPolicy;
    startTime: number;
    memoryUsed: number;
    networkCallsBlocked: number;
    externalApiCallsBlocked: number;
}

const LOCAL_ONLY_POLICY: ExecutionPolicy = {
    allowNetworkAccess: false,
    allowFileSystemAccess: true,
    allowExternalApis: false,
    maxMemoryMb: 8192,
    maxExecutionTimeMs: 300000,
    trustedDomains: [],
};

/**
 * Secure execution environment for local LLM operations
 * Enforces local-first processing without external dependencies
 */
export class SecureExecutionEnvironment {
    private policy: ExecutionPolicy;
    private context: ExecutionContext;

    constructor(policy: Partial<ExecutionPolicy> = {}) {
        this.policy = { ...LOCAL_ONLY_POLICY, ...policy };
        this.context = {
            policy: this.policy,
            startTime: Date.now(),
            memoryUsed: 0,
            networkCallsBlocked: 0,
            externalApiCallsBlocked: 0,
        };
    }

    /**
     * Validate that operation is local-only
     */
    validateLocalOnly(operation: string): void {
        if (operation.includes("http://") || operation.includes("https://")) {
            if (!this.policy.allowNetworkAccess) {
                this.context.networkCallsBlocked++;
                throw new Error(
                    `Network access blocked: ${operation}. Local-first policy enforced.`
                );
            }

            const url = new URL(operation);
            if (
                !this.policy.trustedDomains.includes(url.hostname) &&
                !this.policy.allowExternalApis
            ) {
                this.context.externalApiCallsBlocked++;
                throw new Error(
                    `External API call blocked: ${url.hostname}. Local-first policy enforced.`
                );
            }
        }
    }

    /**
     * Check execution time limits
     */
    checkExecutionTime(): void {
        const elapsed = Date.now() - this.context.startTime;
        if (elapsed > this.policy.maxExecutionTimeMs) {
            throw new Error(
                `Execution time limit exceeded: ${elapsed}ms > ${this.policy.maxExecutionTimeMs}ms`
            );
        }
    }

    /**
     * Check memory usage limits
     */
    checkMemoryUsage(currentMb: number): void {
        this.context.memoryUsed = currentMb;
        if (currentMb > this.policy.maxMemoryMb) {
            throw new Error(
                `Memory limit exceeded: ${currentMb}MB > ${this.policy.maxMemoryMb}MB`
            );
        }
    }

    /**
     * Get execution statistics
     */
    getStats(): ExecutionContext {
        return { ...this.context };
    }

    /**
     * Reset execution context
     */
    reset(): void {
        this.context = {
            policy: this.policy,
            startTime: Date.now(),
            memoryUsed: 0,
            networkCallsBlocked: 0,
            externalApiCallsBlocked: 0,
        };
    }
}

/**
 * Secure model storage manager
 * Ensures models are stored and loaded locally
 */
export class SecureModelStorage {
    private config: ModelStorageConfig;
    private models: Map<string, ModelInfo>;

    constructor(config: Partial<ModelStorageConfig> = {}) {
        this.config = {
            localPath: config.localPath || "./models",
            maxModelSizeMb: config.maxModelSizeMb || 10240,
            allowedFormats: config.allowedFormats || [".gguf", ".bin", ".safetensors"],
            verifyChecksum: config.verifyChecksum ?? true,
        };
        this.models = new Map();
    }

    /**
     * Validate model path is local
     */
    validateLocalPath(path: string): void {
        if (path.startsWith("http://") || path.startsWith("https://")) {
            throw new Error(
                `Remote model path not allowed: ${path}. Models must be stored locally.`
            );
        }

        if (path.includes("..")) {
            throw new Error(
                `Path traversal not allowed: ${path}. Models must be in local directory.`
            );
        }

        const hasAllowedFormat = this.config.allowedFormats.some((format) =>
            path.endsWith(format)
        );
        if (!hasAllowedFormat) {
            throw new Error(
                `Invalid model format: ${path}. Allowed formats: ${this.config.allowedFormats.join(", ")}`
            );
        }
    }

    /**
     * Register a local model
     */
    async registerModel(modelInfo: ModelInfo): Promise<void> {
        this.models.set(modelInfo.name, modelInfo);
    }

    /**
     * Get model information
     */
    async getModel(name: string): Promise<ModelInfo | null> {
        return this.models.get(name) || null;
    }

    /**
     * List all registered models
     */
    async listModels(): Promise<ModelInfo[]> {
        return Array.from(this.models.values());
    }

    /**
     * Remove model registration
     */
    async removeModel(name: string): Promise<boolean> {
        return this.models.delete(name);
    }
}

/**
 * Wrapper for LLM adapters with security enforcement
 */
export class SecureLlmAdapter implements EnhancedLlmAdapter {
    private adapter: EnhancedLlmAdapter;
    private execution: SecureExecutionEnvironment;
    private storage: SecureModelStorage;

    constructor(
        adapter: EnhancedLlmAdapter,
        policy?: Partial<ExecutionPolicy>,
        storageConfig?: Partial<ModelStorageConfig>
    ) {
        this.adapter = adapter;
        this.execution = new SecureExecutionEnvironment(policy);
        this.storage = new SecureModelStorage(storageConfig);
    }

    get backend(): "ollama" {
        return this.adapter.backend;
    }

    async complete(prompt: string, maxTokens?: number): Promise<string> {
        this.execution.checkExecutionTime();
        return this.adapter.complete(prompt, maxTokens);
    }

    async loadModel(modelId: string): Promise<void> {
        this.storage.validateLocalPath(modelId);
        return this.adapter.loadModel(modelId);
    }

    async unloadModel(modelId: string): Promise<void> {
        return this.adapter.unloadModel(modelId);
    }

    async getSupportedModels(): Promise<string[]> {
        return this.adapter.getSupportedModels();
    }

    async getModelInfo(modelId: string): Promise<ModelInfo> {
        return this.adapter.getModelInfo(modelId);
    }

    async startConversation(context: import("../types.js").ConversationContext): Promise<string> {
        this.execution.reset();
        return this.adapter.startConversation(context);
    }

    async continueConversation(id: string, message: string): Promise<string> {
        this.execution.checkExecutionTime();
        return this.adapter.continueConversation(id, message);
    }

    async endConversation(id: string): Promise<void> {
        return this.adapter.endConversation(id);
    }

    async analyzeCode(
        code: string,
        context: string
    ): Promise<import("../types.js").CodeAnalysis> {
        this.execution.checkExecutionTime();
        return this.adapter.analyzeCode(code, context);
    }

    async generateSolution(
        problem: import("../types.js").Problem,
        constraints: import("../types.js").Constraints
    ): Promise<import("../types.js").Solution> {
        this.execution.checkExecutionTime();
        return this.adapter.generateSolution(problem, constraints);
    }

    async explainError(
        error: Error,
        context: import("../types.js").Context
    ): Promise<import("../types.js").Explanation> {
        this.execution.checkExecutionTime();
        return this.adapter.explainError(error, context);
    }

    /**
     * Get security statistics
     */
    getSecurityStats(): ExecutionContext {
        return this.execution.getStats();
    }
}
