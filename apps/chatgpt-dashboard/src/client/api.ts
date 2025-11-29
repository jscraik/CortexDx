const MCP_ENDPOINT = 'http://localhost:5002/mcp';

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: any;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

let requestId = 1;

async function sendRequest(method: string, params?: any): Promise<any> {
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

export async function fetchResource(uri: string): Promise<any> {
    const result = await sendRequest('resources/read', { uri });
    if (result.contents && result.contents.length > 0) {
        const content = result.contents[0];
        if (content.text) {
            try {
                return JSON.parse(content.text);
            } catch (e) {
                return content.text;
            }
        }
        return content;
    }
    return null;
}

export async function callTool(name: string, args: any = {}): Promise<any> {
    const result = await sendRequest('tools/call', { name, arguments: args });
    if (result.content && result.content.length > 0) {
        const content = result.content[0];
        if (content.type === 'text') {
            try {
                return JSON.parse(content.text);
            } catch (e) {
                return content.text;
            }
        }
        return content;
    }
    return null;
}
