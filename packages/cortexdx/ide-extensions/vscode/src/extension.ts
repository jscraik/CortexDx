/**
 * CortexDx VS Code Extension
 * Provides real-time MCP validation and assistance
 */

import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
    console.log("CortexDx extension activated");

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand("cortexdx.validate", validateCurrentFile),
        vscode.commands.registerCommand(
            "cortexdx.analyzeProject",
            analyzeProject,
        ),
        vscode.commands.registerCommand(
            "cortexdx.generateTests",
            generateTests,
        ),
        vscode.commands.registerCommand("cortexdx.formatCode", formatCode),
        vscode.commands.registerCommand("cortexdx.startServer", startServer),
        vscode.commands.registerCommand("cortexdx.stopServer", stopServer),
    );

    // Start language client
    startLanguageClient(context);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("cortexdx")) {
                restartLanguageClient(context);
            }
        }),
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}

async function startLanguageClient(
    context: vscode.ExtensionContext,
): Promise<void> {
    const config = vscode.workspace.getConfiguration("cortexdx");
    const serverUrl = config.get<string>("server.url", "http://localhost:3000");
    const transport = config.get<string>("server.transport", "http");

    let serverOptions: ServerOptions;

    if (transport === "stdio") {
        // Use stdio transport
        const serverModule = context.asAbsolutePath("../../dist/server.js");
        serverOptions = {
            run: { module: serverModule, transport: TransportKind.stdio },
            debug: { module: serverModule, transport: TransportKind.stdio },
        };
    } else {
        // Use HTTP/WebSocket transport
        serverOptions = async () => {
            const socket = await connectToServer(serverUrl, transport);
            return {
                reader: socket,
                writer: socket,
            };
        };
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: "file", language: "typescript" },
            { scheme: "file", language: "javascript" },
            { scheme: "file", language: "python" },
            { scheme: "file", language: "go" },
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{ts,js,py,go}"),
        },
    };

    client = new LanguageClient(
        "cortexdx",
        "CortexDx",
        serverOptions,
        clientOptions,
    );

    try {
        await client.start();
        vscode.window.showInformationMessage("CortexDx: Connected to server");
    } catch (error) {
        vscode.window.showErrorMessage(
            `CortexDx: Failed to connect to server: ${error}`,
        );
    }
}

async function restartLanguageClient(
    context: vscode.ExtensionContext,
): Promise<void> {
    if (client) {
        await client.stop();
    }
    await startLanguageClient(context);
}

async function connectToServer(
    url: string,
    transport: string,
): Promise<any> {
    // Simplified connection logic
    // In a real implementation, this would establish HTTP or WebSocket connection
    throw new Error("HTTP/WebSocket transport not yet implemented");
}

async function validateCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
    }

    const document = editor.document;
    const code = document.getText();
    const filePath = document.uri.fsPath;

    try {
        if (!client) {
            throw new Error("Language client not initialized");
        }

        const result = await client.sendRequest("ide_validate_code", {
            code,
            filePath,
            language: document.languageId,
        });

        vscode.window.showInformationMessage(
            `Validation complete: ${JSON.stringify(result)}`,
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Validation failed: ${error}`);
    }
}

async function analyzeProject(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage("No workspace folder open");
        return;
    }

    const projectRoot = workspaceFolder.uri.fsPath;

    try {
        if (!client) {
            throw new Error("Language client not initialized");
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing project...",
                cancellable: false,
            },
            async () => {
                const result = await client!.sendRequest("ide_analyze_project", {
                    projectRoot,
                    includeTests: true,
                    depth: "standard",
                });

                vscode.window.showInformationMessage(
                    `Analysis complete: ${JSON.stringify(result)}`,
                );
            },
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Analysis failed: ${error}`);
    }
}

async function generateTests(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
    }

    const document = editor.document;
    const code = document.getText();
    const filePath = document.uri.fsPath;

    try {
        if (!client) {
            throw new Error("Language client not initialized");
        }

        const result = await client.sendRequest("ide_generate_tests", {
            code,
            filePath,
            testFramework: "vitest",
            coverage: "standard",
        });

        vscode.window.showInformationMessage(
            `Tests generated: ${JSON.stringify(result)}`,
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Test generation failed: ${error}`);
    }
}

async function formatCode(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("No active editor");
        return;
    }

    const document = editor.document;
    const code = document.getText();

    try {
        if (!client) {
            throw new Error("Language client not initialized");
        }

        const result = await client.sendRequest("ide_format_code", {
            code,
            language: document.languageId,
            options: {
                indentSize: 2,
                useTabs: false,
                lineWidth: 80,
            },
        });

        // Apply formatted code
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(code.length),
        );
        edit.replace(document.uri, fullRange, result as string);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage("Code formatted");
    } catch (error) {
        vscode.window.showErrorMessage(`Formatting failed: ${error}`);
    }
}

async function startServer(): Promise<void> {
    vscode.window.showInformationMessage(
        "Starting CortexDx server... (not yet implemented)",
    );
}

async function stopServer(): Promise<void> {
    if (client) {
        await client.stop();
        vscode.window.showInformationMessage("CortexDx server stopped");
    }
}
