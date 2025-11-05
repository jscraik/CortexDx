export type Severity = "info" | "minor" | "major" | "blocker";

export interface EvidencePointer {
  type: "url" | "file" | "log";
  ref: string;
  lines?: [number, number];
}

export interface FilePlanItem {
  action: "update" | "new";
  path: string;
  description?: string;
  patch?: string;
}

export type FilePlan = FilePlanItem[];

export interface CodeSample {
  language: string;
  title: string;
  snippet: string;
}

export interface Finding {
  id: string;
  area: string;
  severity: Severity;
  title: string;
  description: string;
  evidence: EvidencePointer[];
  tags?: string[];
  confidence?: number;
  recommendation?: string;
  remediation?: {
    filePlan?: FilePlan;
    steps?: string[];
    codeSamples?: CodeSample[];
  };
}

export interface SseResult {
  ok: boolean;
  reason?: string;
  firstEventMs?: number;
  heartbeatMs?: number;
}

export interface GovernancePack {
  path: string;
  version?: string;
  commit?: string;
}

export interface LlmAdapter {
  complete: (prompt: string, maxTokens?: number) => Promise<string>;
}

export interface DiagnosticContext {
  endpoint: string;
  headers?: Record<string, string>;
  logger: (...args: unknown[]) => void;
  request: <T>(input: RequestInfo, init?: RequestInit) => Promise<T>;
  jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
  sseProbe: (url: string, opts?: unknown) => Promise<SseResult>;
  governance?: GovernancePack;
  llm?: LlmAdapter | null;
  evidence: (ev: EvidencePointer) => void;
  deterministic?: boolean;
}

export interface DiagnosticPlugin {
  id: string;
  title: string;
  order?: number;
  run: (ctx: DiagnosticContext) => Promise<Finding[]>;
}
