const MCP_ENDPOINT = 'http://localhost:5002/mcp';

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

let requestId = 1;

async function sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = requestId++;
    const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
    };

    const response = await fetch(MCP_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: JsonRpcResponse = await response.json();

    if (data.error) {
        throw new Error(data.error.message);
    }

    return data.result;
}

export async function fetchResource(uri: string): Promise<unknown> {
    const result = await sendRequest('resources/read', { uri });
    if (result && typeof result === 'object' && 'contents' in result) {
        const contents = (result as { contents: Array<{ text?: string }> }).contents;
        if (contents && contents.length > 0) {
            const content = contents[0];
            if (content.text) {
                try {
                    return JSON.parse(content.text);
                } catch {
                    return content.text;
                }
            }
            return content;
        }
    }
    return null;
}

export async function callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const result = await sendRequest('tools/call', { name, arguments: args });
    if (result && typeof result === 'object' && 'content' in result) {
        const content = (result as { content: Array<{ type: string; text?: string }> }).content;
        if (content && content.length > 0) {
            const firstContent = content[0];
            if (firstContent.type === 'text' && firstContent.text) {
                try {
                    return JSON.parse(firstContent.text);
                } catch {
                    return firstContent.text;
                }
            }
            return firstContent;
        }
    }
    return null;
}
