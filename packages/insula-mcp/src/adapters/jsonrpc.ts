let nextId = 1;

export function jsonRpcClient(base: string) {
  return async function call<T>(method: string, params?: unknown): Promise<T> {
    const res = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params })
    });
    const body = await res.json();
    if (body.error) {
      const { code, message } = body.error;
      throw new Error(`JSON-RPC error ${code}: ${message}`);
    }
    return body.result as T;
  };
}
