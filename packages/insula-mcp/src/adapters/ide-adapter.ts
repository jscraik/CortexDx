/**
 * IDE Adapter
 * Provides IDE-specific protocol adaptations for MCP integration
 * Requirements: 1.3, 4.1, 9.2
 */

export interface IdeAdapterConfig {
    editor: "vscode" | "intellij" | "vim" | "emacs" | "sublime" | "atom";
    version?: string;
    capabilities?: IdeCapabilities;
    transport?: "stdio" | "http" | "websocket";
}

export interface IdeCapabilities {
    diagnostics?: boolean;
    codeActions?: boolean;
    completion?: boolean;
    hover?: boolean;
    formatting?: boolean;
    refactoring?: boolean;
    inlayHints?: boolean;
    semanticTokens?: boolean;
}

export interface IdeMessage {
    type: "request" | "response" | "notification";
    method: string;
    params?: unknown;
    id?: string | number;
}

export interface IdeResponse {
    success: boolean;
    data?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

interface DiagnosticItem {
    range?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    severity?: string;
    code?: string;
    source?: string;
    message?: string;
    description?: string;
    evidence?: Array<{ type: string; ref: string }>;
}

interface CompletionItem {
    text?: string;
    label?: string;
    type?: string;
    description?: string;
    documentation?: string;
}

/**
 * Adapts MCP protocol to IDE-specific formats
 */
export class IdeAdapter {
    private config: IdeAdapterConfig;

    constructor(config: IdeAdapterConfig) {
        this.config = config;
    }

    /**
     * Converts IDE message to MCP format
     */
    toMcpMessage(ideMessage: IdeMessage): {
        jsonrpc: "2.0";
        method: string;
        params?: unknown;
        id?: string | number;
    } {
        return {
            jsonrpc: "2.0",
            method: this.mapIdeMethodToMcp(ideMessage.method),
            params: ideMessage.params,
            id: ideMessage.id,
        };
    }

    /**
     * Converts MCP response to IDE format
     */
    fromMcpResponse(mcpResponse: unknown, ideMethod: string): IdeResponse {
        // Handle different IDE-specific response formats
        switch (this.config.editor) {
            case "vscode":
                return this.toVsCodeResponse(mcpResponse, ideMethod);
            case "intellij":
                return this.toIntellijResponse(mcpResponse, ideMethod);
            default:
                return this.toGenericResponse(mcpResponse);
        }
    }

    /**
     * Maps IDE-specific method names to MCP methods
     */
    private mapIdeMethodToMcp(ideMethod: string): string {
        const methodMap: Record<string, string> = {
            // VS Code Language Server Protocol
            "textDocument/diagnostic": "ide_get_diagnostics",
            "textDocument/completion": "ide_get_completions",
            "textDocument/hover": "ide_get_hover_info",
            "textDocument/codeAction": "ide_apply_quick_fix",
            "textDocument/formatting": "ide_format_code",
            "textDocument/rename": "ide_refactor_code",

            // IntelliJ Platform
            "inspection/run": "ide_get_diagnostics",
            "completion/get": "ide_get_completions",
            "quickfix/apply": "ide_apply_quick_fix",
            "format/document": "ide_format_code",

            // Generic IDE methods
            validate: "ide_validate_code",
            suggest: "ide_get_suggestions",
            fix: "ide_apply_quick_fix",
            analyze: "ide_analyze_project",
        };

        return methodMap[ideMethod] || ideMethod;
    }

    /**
     * Converts to VS Code Language Server Protocol format
     */
    private toVsCodeResponse(mcpResponse: unknown, method: string): IdeResponse {
        // VS Code expects LSP-compliant responses
        return {
            success: true,
            data: this.adaptToLsp(mcpResponse, method),
        };
    }

    /**
     * Converts to IntelliJ Platform format
     */
    private toIntellijResponse(
        mcpResponse: unknown,
        method: string,
    ): IdeResponse {
        // IntelliJ has its own inspection format
        return {
            success: true,
            data: mcpResponse,
        };
    }

    /**
     * Generic response format
     */
    private toGenericResponse(mcpResponse: unknown): IdeResponse {
        return {
            success: true,
            data: mcpResponse,
        };
    }

    /**
     * Adapts MCP response to Language Server Protocol format
     */
    private adaptToLsp(mcpResponse: unknown, method: string): unknown {
        if (!mcpResponse || typeof mcpResponse !== "object") {
            return mcpResponse;
        }

        // Convert diagnostics to LSP format
        if (method.includes("diagnostic")) {
            return this.convertToLspDiagnostics(mcpResponse);
        }

        // Convert completions to LSP format
        if (method.includes("completion")) {
            return this.convertToLspCompletions(mcpResponse);
        }

        return mcpResponse;
    }

    /**
     * Converts to LSP Diagnostic format
     */
    private convertToLspDiagnostics(response: unknown): unknown {
        if (!Array.isArray(response)) {
            return [];
        }

        return response.map((item: DiagnosticItem) => ({
            range: item.range || {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
            },
            severity: this.mapSeverityToLsp(item.severity || "info"),
            code: item.code,
            source: item.source || "insula-mcp",
            message: item.message || item.description,
            relatedInformation: item.evidence?.map((ev) => ({
                location: {
                    uri: ev.ref,
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 0, character: 0 },
                    },
                },
                message: ev.type,
            })),
        }));
    }

    /**
     * Converts to LSP CompletionItem format
     */
    private convertToLspCompletions(response: unknown): unknown {
        if (!Array.isArray(response)) {
            return { items: [] };
        }

        return {
            isIncomplete: false,
            items: response.map((item: CompletionItem, index: number) => ({
                label: item.text || item.label,
                kind: this.mapCompletionKind(item.type || undefined),
                detail: item.description,
                documentation: item.documentation,
                sortText: String(index).padStart(5, "0"),
                insertText: item.text || item.label,
            })),
        };
    }

    /**
     * Maps severity to LSP DiagnosticSeverity
     */
    private mapSeverityToLsp(
        severity: string,
    ): 1 | 2 | 3 | 4 {
        const severityMap: Record<string, 1 | 2 | 3 | 4> = {
            error: 1,
            blocker: 1,
            warning: 2,
            major: 2,
            info: 3,
            minor: 3,
            hint: 4,
        };
        return severityMap[severity] || 3;
    }

    /**
     * Maps completion type to LSP CompletionItemKind
     */
    private mapCompletionKind(type?: string): number {
        const kindMap: Record<string, number> = {
            function: 3,
            method: 2,
            variable: 6,
            class: 7,
            interface: 8,
            module: 9,
            property: 10,
            keyword: 14,
            snippet: 15,
            text: 1,
        };
        return kindMap[type || "text"] || 1;
    }

    /**
     * Gets IDE-specific capabilities
     */
    getCapabilities(): IdeCapabilities {
        return (
            this.config.capabilities || {
                diagnostics: true,
                codeActions: true,
                completion: true,
                hover: true,
                formatting: true,
                refactoring: true,
                inlayHints: false,
                semanticTokens: false,
            }
        );
    }
}

/**
 * Creates an IDE adapter for the specified editor
 */
export function createIdeAdapter(
    editor: IdeAdapterConfig["editor"],
    options?: Partial<IdeAdapterConfig>,
): IdeAdapter {
    const config: IdeAdapterConfig = {
        editor,
        ...options,
    };

    return new IdeAdapter(config);
}
