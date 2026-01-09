# Migration Guide: Apps SDK Conformant Dashboard

This guide helps you migrate from the old dashboard implementation to the new Apps SDK conformant version.

## Quick Start

### 1. Install Dependencies

```bash
cd apps/chatgpt-dashboard
pnpm install
```

New dependencies added:
- `react-router-dom@^6.28.0` - Host-backed navigation
- `react-intl@^6.7.2` - Internationalization

### 2. Replace App.tsx

```bash
# Backup old version
mv src/client/App.tsx src/client/App.old.tsx

# Use new version
mv src/client/App.new.tsx src/client/App.tsx
```

### 3. Build and Test

```bash
# Build
pnpm build

# Run dev server
pnpm dev

# Test
pnpm test
```

## What Changed

### Architecture Changes

#### Before: Local State Navigation
```typescript
const [activeTab, setActiveTab] = useState('health');

<button onClick={() => setActiveTab('metrics')}>
  Metrics
</button>
```

#### After: React Router Navigation
```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

<button onClick={() => navigate('/dashboard/metrics')}>
  Metrics
</button>
```

### Display Mode Changes

#### Before: Manual Mode Switching
```typescript
const displayMode = useDisplayMode();

if (displayMode === 'inline') {
  return <HealthCard />;
}

return <FullDashboard />;
```

#### After: Router-Based Mode Switching
```typescript
const displayMode = useDisplayMode();

if (displayMode === 'inline') {
  return <InlineWidget />;
}

// Router handles fullscreen layout
return (
  <Routes>
    <Route path="/dashboard" element={<DashboardLayout />}>
      <Route index element={<OverviewTab />} />
      {/* ... */}
    </Route>
  </Routes>
);
```

### Data Fetching Changes

#### Before: Direct Tool Calls
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  callTool('get_health').then(setData).finally(() => setLoading(false));
}, []);
```

#### After: useToolCall Hook
```typescript
const { data, loading, error, retry } = useToolCall('get_health');

if (loading) return <LoadingState />;
if (error) return <ErrorState onRetry={retry} />;
```

### Localization Changes

#### Before: Hardcoded Strings
```typescript
<h1>CortexDx Control Panel</h1>
<button>Refresh</button>
```

#### After: Localized Strings
```typescript
import { FormattedMessage } from 'react-intl';

<h1><FormattedMessage id="dashboard.title" /></h1>
<button><FormattedMessage id="action.refresh" /></button>
```

### Telemetry Changes

#### Before: No Tracking
```typescript
<button onClick={handleClick}>
  Submit
</button>
```

#### After: Event Tracking
```typescript
import { useTelemetry } from '../lib/telemetry';

const track = useTelemetry();

<button onClick={() => {
  track('submit_clicked');
  handleClick();
}}>
  Submit
</button>
```

## Component Migration

### Migrating a Panel Component

#### Before (HealthPanel.tsx)
```typescript
export function HealthPanel() {
  const components = [/* mock data */];

  return (
    <div>
      {components.map(c => (
        <div key={c.name}>
          <Badge>{c.status}</Badge>
          {c.name}
        </div>
      ))}
    </div>
  );
}
```

#### After (OverviewTab.tsx)
```typescript
import { useToolCall } from '../hooks/useToolCall';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { FormattedMessage } from 'react-intl';

export function OverviewTab() {
  const { data, loading, error, retry } = useToolCall('get_health');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div>
      <h2><FormattedMessage id="health.title" /></h2>
      {data.components.map(c => (
        <div key={c.name}>
          <Badge>{c.status}</Badge>
          {c.name}
        </div>
      ))}
    </div>
  );
}
```

## New Components Available

### LoadingState
```typescript
import { LoadingState } from '../components/LoadingState';

<LoadingState count={3} height={120} />
```

### ErrorState
```typescript
import { ErrorState } from '../components/ErrorState';

<ErrorState
  title="Failed to load"
  message={error.message}
  onRetry={retry}
/>
```

### EmptyState
```typescript
import { EmptyState } from '../components/EmptyState';

<EmptyState
  icon={<Activity size={48} />}
  title="No data"
  description="Data will appear here"
  action={<Button>Refresh</Button>}
/>
```

### InlineWidget
```typescript
import { InlineWidget } from '../components/InlineWidget';

// Automatically shown in inline mode
<InlineWidget />
```

## New Hooks Available

### useToolCall
```typescript
import { useToolCall } from '../hooks/useToolCall';

const { data, loading, error, retry, refetch } = useToolCall<MyType>(
  'tool_name',
  { arg1: 'value' },
  {
    enabled: true,
    onSuccess: (data) => console.log('Success', data),
    onError: (error) => console.error('Error', error),
  }
);
```

### useTelemetry
```typescript
import { useTelemetry } from '../lib/telemetry';

const track = useTelemetry();

track('event_name', { property: 'value' });
```

## Routing Structure

### New Routes

```
/                          → Redirects to /dashboard
/dashboard                 → Overview tab
/dashboard/metrics         → Metrics tab
/dashboard/logs            → Logs tab
/dashboard/traces          → Traces tab
/dashboard/controls        → Controls tab
```

### Navigation Examples

```typescript
import { useNavigate, NavLink } from 'react-router-dom';

// Programmatic navigation
const navigate = useNavigate();
navigate('/dashboard/metrics');

// Declarative navigation
<NavLink to="/dashboard/logs">View Logs</NavLink>

// With state
navigate('/dashboard/traces', { state: { traceId: '123' } });
```

## Localization

### Adding New Messages

Edit `src/client/lib/i18n.ts`:

```typescript
export const messages = {
  'en-US': {
    'my.new.key': 'My new message',
  },
  'es-ES': {
    'my.new.key': 'Mi nuevo mensaje',
  },
};
```

### Using Messages

```typescript
import { FormattedMessage, useIntl } from 'react-intl';

// In JSX
<FormattedMessage id="my.new.key" />

// In code
const intl = useIntl();
const message = intl.formatMessage({ id: 'my.new.key' });

// With values
<FormattedMessage
  id="greeting"
  values={{ name: 'John' }}
/>
```

## Testing Changes

### Testing Display Modes

```typescript
// Simulate inline mode
window.openai = {
  ...window.openai,
  displayMode: 'inline',
};

// Simulate fullscreen mode
window.openai.displayMode = 'fullscreen';
```

### Testing Locales

```typescript
// Test Spanish
window.openai.locale = 'es-ES';

// Test English
window.openai.locale = 'en-US';
```

### Testing Tool Calls

```typescript
// Mock tool response
window.openai.callTool = async (name, args) => {
  if (name === 'get_health') {
    return {
      status: 'healthy',
      uptime: 3600,
      components: [/* ... */],
    };
  }
};
```

## Troubleshooting

### Issue: "Cannot find module 'react-router-dom'"

**Solution:**
```bash
pnpm install react-router-dom
```

### Issue: "Cannot find module 'react-intl'"

**Solution:**
```bash
pnpm install react-intl
```

### Issue: Navigation not working

**Solution:** Ensure `BrowserRouter` wraps your app in `main.tsx`:

```typescript
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <App />
</BrowserRouter>
```

### Issue: Translations not showing

**Solution:** Ensure `IntlProvider` wraps your app:

```typescript
import { IntlProvider } from 'react-intl';
import { messages } from './lib/i18n';

<IntlProvider locale="en-US" messages={messages['en-US']}>
  <App />
</IntlProvider>
```

### Issue: Tool calls failing

**Solution:** Check that `window.openai.callTool` is available:

```typescript
if (!window.openai?.callTool) {
  console.error('Not running in ChatGPT iframe');
}
```

## Rollback Plan

If you need to rollback:

```bash
# Restore old App.tsx
mv src/client/App.old.tsx src/client/App.tsx

# Remove new dependencies (optional)
pnpm remove react-router-dom react-intl

# Rebuild
pnpm build
```

## Next Steps

1. ✅ Complete migration
2. ⏭️ Implement remaining tabs (Metrics, Logs, Traces, Controls)
3. ⏭️ Add real-time updates (SSE/WebSocket)
4. ⏭️ Run accessibility audit
5. ⏭️ Add integration tests
6. ⏭️ Optimize bundle size

## Support

For questions or issues:
1. Check `APPS_SDK_CONFORMANCE.md` for detailed conformance info
2. Review Apps SDK docs: https://developers.openai.com/apps-sdk/
3. Check examples: https://github.com/openai/openai-apps-sdk-examples
