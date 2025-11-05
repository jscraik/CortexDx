import { trace } from "@opentelemetry/api";

type AttributeValue = string | number | boolean | undefined;

export async function withSpan<T>(
  name: string,
  attrs: Record<string, AttributeValue>,
  fn: () => Promise<T>
) {
  const tracer = trace.getTracer("insula");
  return tracer.startActiveSpan(name, async (span) => {
    try {
      for (const [key, value] of Object.entries(attrs)) {
        if (value !== undefined) span.setAttribute(key, value);
      }
      return await fn();
    } finally {
      span.end();
    }
  });
}
