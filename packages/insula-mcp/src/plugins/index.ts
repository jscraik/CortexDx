import type { DiagnosticPlugin } from "../types.js";

import { DevtoolEnvPlugin } from "./devtool-env.js";
import { AuthPlugin } from "./auth.js";
import { DiscoveryPlugin } from "./discovery.js";
import { ProtocolPlugin } from "./protocol.js";
import { JsonRpcBatchPlugin } from "./jsonrpc-batch.js";
import { PermissioningPlugin } from "./permissioning.js";
import { StreamingSsePlugin } from "./streaming-sse.js";
import { SseReconnectPlugin } from "./sse-reconnect.js";
import { CorsPlugin } from "./cors.js";
import { RateLimitPlugin } from "./ratelimit.js";
import { ToolDriftPlugin } from "./tool-drift.js";
import { GovernancePlugin } from "./governance.js";
import { ThreatModelPlugin } from "./threat-model.js";
import { PerformancePlugin } from "./performance.js";

export const BUILTIN_PLUGINS: DiagnosticPlugin[] = [
  DevtoolEnvPlugin,
  AuthPlugin,
  DiscoveryPlugin,
  ProtocolPlugin,
  JsonRpcBatchPlugin,
  PermissioningPlugin,
  StreamingSsePlugin,
  SseReconnectPlugin,
  CorsPlugin,
  RateLimitPlugin,
  ToolDriftPlugin,
  GovernancePlugin,
  ThreatModelPlugin,
  PerformancePlugin
];

export function getPluginById(id: string): DiagnosticPlugin | undefined {
  return BUILTIN_PLUGINS.find((p) => p.id === id);
}
