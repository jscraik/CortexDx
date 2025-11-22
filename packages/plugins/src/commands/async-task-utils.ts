
export interface AsyncDiagnoseOptions {
    endpoint: string;
    diagnosticArgs: {
        endpoint: string;
        suites: string[];
        full?: boolean;
    };
    taskTtl: number;
    pollInterval: number;
    headers?: Record<string, string>;
    noColor?: boolean;
}

export interface AsyncDiagnoseResult {
    content?: Array<{ type: string; text?: string }>;
    [key: string]: unknown;
}

export async function executeDiagnoseAsync(_options: AsyncDiagnoseOptions): Promise<AsyncDiagnoseResult> {
    throw new Error("Async diagnose not implemented yet");
}
