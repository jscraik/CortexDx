export function redactHeaders(headers: Record<string, string>) {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    output[key] = /authorization|cookie|token/i.test(key) ? "[REDACTED]" : value;
  }
  return output;
}
