"use strict";
/**
 * Example instrumented MCP server using @shinzolabs/instrumentation-mcp
 *
 * This demonstrates how to add telemetry instrumentation to an MCP server
 * using the Shinzo Labs instrumentation package.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TELEMETRY_CONFIG = exports.INTEGRATION_STEPS = void 0;
exports.createInstrumentedMcpServer = createInstrumentedMcpServer;
var instrumentation_mcp_1 = require("@shinzolabs/instrumentation-mcp");
var mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
var stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
var zod_1 = require("zod");
/**
 * Create and configure an instrumented MCP server
 *
 * @example
 * ```typescript
 * const server = createInstrumentedMcpServer();
 * // Server is now automatically instrumented with telemetry
 * ```
 */
function createInstrumentedMcpServer() {
    return __awaiter(this, void 0, void 0, function () {
        var server;
        var _this = this;
        return __generator(this, function (_a) {
            server = new mcp_js_1.McpServer({
                name: "cortexdx-mcp-server",
                version: "1.0.0"
            });
            // Add instrumentation BEFORE registering tools
            (0, instrumentation_mcp_1.instrumentServer)(server, {
                serverName: "cortexdx-mcp-server",
                serverVersion: "1.0.0",
                exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
                exporterAuth: {
                    type: "bearer",
                    token: process.env.SHINZO_TELEMETRY_TOKEN || "38a0a136a9aab7d73ee3172b01b25d89"
                }
            });
            // Register tools using the high-level API
            server.registerTool("cortexdx_diagnose", {
                title: "Diagnose MCP Server",
                description: "Diagnose MCP server issues",
                inputSchema: {
                    endpoint: zod_1.z.string().describe("MCP server endpoint to diagnose"),
                    suites: zod_1.z.array(zod_1.z.string()).optional().describe("Diagnostic suites to run")
                },
                outputSchema: {
                    status: zod_1.z.string(),
                    endpoint: zod_1.z.string(),
                    timestamp: zod_1.z.string()
                }
            }, function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                var output;
                var endpoint = _b.endpoint, _c = _b.suites, suites = _c === void 0 ? [] : _c;
                return __generator(this, function (_d) {
                    output = {
                        status: "diagnosed",
                        endpoint: endpoint,
                        timestamp: new Date().toISOString()
                    };
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: "Diagnosing ".concat(endpoint, "...")
                                }],
                            structuredContent: output
                        }];
                });
            }); });
            server.registerTool("cortexdx_health", {
                title: "Health Check",
                description: "Check server health",
                inputSchema: {},
                outputSchema: {
                    status: zod_1.z.string(),
                    timestamp: zod_1.z.string()
                }
            }, function () { return __awaiter(_this, void 0, void 0, function () {
                var output;
                return __generator(this, function (_a) {
                    output = {
                        status: "healthy",
                        timestamp: new Date().toISOString()
                    };
                    return [2 /*return*/, {
                            content: [{
                                    type: "text",
                                    text: JSON.stringify(output, null, 2)
                                }],
                            structuredContent: output
                        }];
                });
            }); });
            return [2 /*return*/, server];
        });
    });
}
/**
 * Integration guide for adding instrumentation to existing CortexDx server
 *
 * To add telemetry to your existing server.ts implementation:
 *
 * 1. Upgrade the MCP SDK:
 *    pnpm --filter @brainwav/cortexdx add @modelcontextprotocol/sdk@^1.15.1
 *
 * 2. Migrate to the high-level McpServer API:
 *    ```typescript
 *    import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 *    import { instrumentServer } from "@shinzolabs/instrumentation-mcp";
 *
 *    const server = new McpServer({
 *      name: "cortexdx",
 *      version: "1.0.0"
 *    });
 *
 *    // Instrument the high-level server instance
 *    instrumentServer(server, {
 *      serverName: "cortexdx-mcp-server",
 *      serverVersion: "1.0.0",
 *      exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
 *      exporterAuth: {
 *        type: "bearer",
 *        token: process.env.SHINZO_TELEMETRY_TOKEN
 *      }
 *    });
 *
 *    // Register tools with server.registerTool(...)
 *    ```
 *
 * 3. Set environment variable:
 *    export SHINZO_TELEMETRY_TOKEN="your-token"
 *
 * The instrumentation will automatically track:
 * - Tool execution metrics
 * - Performance data
 * - Error rates
 * - Usage patterns
 */
exports.INTEGRATION_STEPS = [
    "1. Upgrade @modelcontextprotocol/sdk to ^1.15.1",
    "2. Migrate to McpServer high-level API",
    "3. Instrument McpServer instance directly before tool registration",
    "4. Configure SHINZO_TELEMETRY_TOKEN environment variable",
    "5. Register tools using server.registerTool() method"
];
exports.TELEMETRY_CONFIG = {
    serverName: "cortexdx-mcp-server",
    serverVersion: "1.0.0",
    exporterEndpoint: "https://api.app.shinzo.ai/telemetry/ingest_http",
    defaultToken: "38a0a136a9aab7d73ee3172b01b25d89" // Demo token from your snippet
};
/**
 * Example standalone server that can be run directly
 */
function runInstrumentedServer() {
    return __awaiter(this, void 0, void 0, function () {
        var server, transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, createInstrumentedMcpServer()];
                case 1:
                    server = _a.sent();
                    transport = new stdio_js_1.StdioServerTransport();
                    return [4 /*yield*/, server.connect(transport)];
                case 2:
                    _a.sent();
                    console.log('🎯 Instrumented CortexDx MCP server started with telemetry');
                    return [2 /*return*/];
            }
        });
    });
}
// Run if this file is executed directly
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('instrumented-mcp-server.ts')) {
    runInstrumentedServer().catch(console.error);
}
