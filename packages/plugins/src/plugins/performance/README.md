# Performance Plugin - Modular Architecture

This directory contains the refactored performance measurement and profiling functionality, previously contained in a single 2,422-line file.

## Architecture

The performance plugin has been split into focused, maintainable modules:

```
performance/
├── index.ts                    # Main entry point, plugin exports
├── types.ts                    # TypeScript type definitions
├── utils.ts                    # Utility functions
├── measurements/
│   ├── http.ts                # HTTP performance measurement
│   ├── sse.ts                 # Server-Sent Events measurement
│   └── websocket.ts           # WebSocket performance measurement
└── README.md                  # This file
```

## Modules

### `index.ts`
Main entry point that exports:
- `PerformancePlugin` - Base performance measurement plugin
- `EnhancedPerformanceProfilerPlugin` - Advanced profiling (simplified)
- `measureTransports()` - Core measurement function
- `buildPerformanceFindings()` - Findings generation
- Type re-exports for backward compatibility

### `types.ts`
Type definitions:
- `HttpMetrics` - HTTP performance metrics
- `SseMetrics` - SSE performance metrics
- `WebSocketMetrics` - WebSocket performance metrics
- `PerformanceSummary` - Combined metrics
- `PerformanceHarness` - Testing harness interface

### `utils.ts`
Utility functions:
- `getMemoryUsage()` - Get current memory usage
- `calculateVariance()` - Statistical variance calculation
- `calculatePercentile()` - Percentile calculation
- `formatBytes()` - Human-readable byte formatting
- `formatDuration()` - Human-readable duration formatting
- `createHarness()` - Create performance harness from context

### `measurements/http.ts`
HTTP-specific functionality:
- `measureHttp()` - Measure HTTP request performance
- `buildHttpFindings()` - Generate HTTP-related findings

### `measurements/sse.ts`
SSE-specific functionality:
- `measureSse()` - Measure SSE stream performance
- `calculateSseJitter()` - Calculate timing jitter
- `buildSseDescription()` - Format SSE metrics
- `buildSseFindings()` - Generate SSE-related findings

### `measurements/websocket.ts`
WebSocket-specific functionality:
- `measureWebSocket()` - Analyze WebSocket transcript
- `buildWebSocketDescription()` - Format WebSocket metrics
- `buildWebSocketFindings()` - Generate WebSocket-related findings

## Usage

### Basic Usage

```typescript
import { PerformancePlugin } from './plugins/performance/index.js';

// Use in plugin array
const findings = await PerformancePlugin.run(diagnosticContext);
```

### Direct Measurement

```typescript
import { measureTransports, buildPerformanceFindings } from './plugins/performance/index.js';

// Measure all transports
const metrics = await measureTransports(ctx);

// Build findings from metrics
const findings = buildPerformanceFindings(metrics, ctx.endpoint);
```

### Individual Transport Measurement

```typescript
import { measureHttp } from './plugins/performance/measurements/http.js';
import { measureSse } from './plugins/performance/measurements/sse.js';
import { createHarness } from './plugins/performance/utils.js';

const harness = createHarness(ctx);

// Measure just HTTP
const httpMetrics = await measureHttp(ctx, harness);

// Measure just SSE
const sseMetrics = await measureSse(ctx, harness);
```

## Testing

Tests are located in `tests/plugins/performance.spec.ts` (40+ test cases covering core functionality).

Run tests:
```bash
pnpm test tests/plugins/performance.spec.ts
```

## Benefits of Modular Structure

1. **Maintainability**: Each module has a single responsibility (< 200 lines each vs. 2,422 lines)
2. **Testability**: Easier to unit test individual measurement functions
3. **Reusability**: Import only what you need
4. **Clarity**: Clear separation of concerns
5. **Extensibility**: Easy to add new measurement types

## Migration from Old Structure

The original `performance.ts` file contained advanced profiling features including:
- Real-time monitoring
- Bottleneck identification
- CPU hotspot detection
- Event loop blocking detection
- Async bottleneck analysis

These features can be migrated to additional modules as needed:
- `profiling/realtime.ts`
- `profiling/bottlenecks.ts`
- `profiling/detection.ts`

## Backward Compatibility

All types and main functions are re-exported from `index.ts`, ensuring backward compatibility with existing code that imports from the old `performance.ts` file.

## Performance

- **File Size Reduction**: 2,422 lines → ~150 lines per module
- **Build Time**: Improved with code splitting
- **Bundle Size**: Only used modules are bundled
- **Cognitive Load**: Easier to understand each module independently

---

**Last Updated**: November 2025
**Refactoring Phase**: 4
