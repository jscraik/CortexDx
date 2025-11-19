/**
 * Server Type Definitions
 * Type definitions specific to the CortexDx server
 */

import type { MonitoringConfig } from "../healing/scheduler";

export type SelfDiagnoseOptions = {
  autoFix?: boolean;
  dryRun?: boolean;
  severity?: "minor" | "major" | "blocker";
};

export type TemplateApplyOptions = {
  dryRun?: boolean;
  backup?: boolean;
  validate?: boolean;
};

export type MonitoringControlOptions = {
  action?: "start" | "stop" | "status";
  intervalSeconds?: number;
  configs?: MonitoringConfig[];
};

export type MonitoringActionPayload = {
  action?: "start" | "stop";
};

export type ProviderExecutePayload = {
  tool: string;
  params?: Record<string, unknown>;
};

export type JsonRpcId = string | number | null;

export type JsonRpcResponsePayload =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } };

export type JsonRpcRequestPayload = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

export type JsonRpcTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};
