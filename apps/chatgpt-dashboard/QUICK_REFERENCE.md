# Quick Reference - Apps SDK Conformant Dashboard

## Installation

```bash
cd apps/chatgpt-dashboard
pnpm install
pnpm build
pnpm dev
```

## Common Patterns

### Data Fetching
```typescript
import { useToolCall } from './hooks/useToolCall';

const { data, loading, error, retry } = useToolCall<MyType>('tool_name', args);
```

### Navigation
```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/dashboard/metrics');
```

### Localization
```typescript
import { FormattedMessage } from 'react-intl';

<FormattedMessage id="my.message.key" />
```

### Telemetry
```typescript
import { useTelemetry } from './lib/telemetry';

const track = useTelemetry();
track('event_name', { prop: 'value' });
```

### States
```typescript
import { LoadingState, ErrorState, EmptyState } from './components';

if (loading) return <LoadingState />;
if (error) return <ErrorState onRetry={retry} />;
if (!data) return <EmptyState title="No data" />;
```

## File Structure

```
src/client/
├── components/       # Reusable UI
├── hooks/           # Custom hooks
├── layouts/         # Page layouts
├── lib/             # Utilities
├── tabs/            # Tab content
├── App.tsx          # Main app
└── main.tsx         # Entry point
```

## Routes

```
/                    → /dashboard (redirect)
/dashboard           → Overview
/dashboard/metrics   → Metrics
/dashboard/logs      → Logs
/dashboard/traces    → Traces
/dashboard/controls  → Controls
```

## Display Modes

```typescript
// Inline: Simplified widget
if (displayMode === 'inline') return <InlineWidget />;

// Fullscreen: Full dashboard
return <DashboardLayout />;
```

## Locales

Supported: `en-US`, `es-ES`

Add messages in `src/client/lib/i18n.ts`

## Testing

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Build
pnpm build
```

## Debugging

```typescript
// Simulate inline mode
window.openai.displayMode = 'inline';

// Simulate fullscreen
window.openai.displayMode = 'fullscreen';

// Change locale
window.openai.locale = 'es-ES';

// Mock tool call
window.openai.callTool = async (name, args) => ({ /* mock data */ });
```

## Key Components

- `InlineWidget` - Simplified inline view
- `DashboardLayout` - Full dashboard with tabs
- `LoadingState` - Loading skeleton
- `ErrorState` - Error with retry
- `EmptyState` - No data message

## Key Hooks

- `useToolCall` - Fetch data from MCP tools
- `useTelemetry` - Track events
- `useDisplayMode` - Get current display mode
- `useOpenAiGlobal` - Read window.openai values

## Documentation

- `APPS_SDK_CONFORMANCE.md` - Full conformance guide
- `MIGRATION_GUIDE.md` - Migration instructions
- `IMPLEMENTATION_SUMMARY.md` - What was built

## Support

- Apps SDK: https://developers.openai.com/apps-sdk/
- Examples: https://github.com/openai/openai-apps-sdk-examples
- UI Components: https://openai.github.io/apps-sdk-ui
