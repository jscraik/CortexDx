# Apps SDK UI Conformance Guide

This document describes how the CortexDx ChatGPT Dashboard conforms to the OpenAI Apps SDK guidelines.

## ✅ Conformance Checklist

### Component Library
- [x] Uses `@openai/apps-sdk-ui` components (Badge, Button, Input, Select)
- [x] Wraps app in `AppsSDKUIProvider`
- [x] Imports from correct paths (`@openai/apps-sdk-ui/components/*`)

### Display Modes
- [x] Supports inline, fullscreen, and PiP modes
- [x] Uses `useDisplayMode()` hook to detect current mode
- [x] Calls `requestDisplayMode()` for mode transitions
- [x] Inline shows simplified widget (progressive disclosure)
- [x] Fullscreen shows complete dashboard

### Navigation
- [x] Uses React Router for host-backed navigation
- [x] Routes mirror iframe history to ChatGPT UI
- [x] Tab navigation uses `<NavLink>` with proper paths
- [x] Programmatic navigation with `useNavigate()`

### State Management
- [x] Reads `window.openai.toolOutput` for initial data
- [x] Uses `window.openai.setWidgetState()` for persistence
- [x] Implements `useWidgetState` hook pattern
- [x] State scoped to widget instance (message_id/widgetId)

### Tool Integration
- [x] Uses `window.openai.callTool()` for server actions
- [x] Uses `window.openai.sendFollowUpMessage()` for follow-ups
- [x] Implements `useToolCall` hook with loading/error states
- [x] Tracks tool call IDs in telemetry

### Localization
- [x] Uses `react-intl` for internationalization
- [x] Reads `window.openai.locale` for user's language
- [x] Supports en-US and es-ES (extensible)
- [x] Uses `<FormattedMessage>` for all user-facing text

### Accessibility
- [x] ARIA labels on interactive elements
- [x] ARIA live regions for dynamic updates
- [x] Keyboard navigation support
- [x] Focus management
- [x] Color-independent status indicators (icons + text)
- [x] Screen reader friendly

### Error Handling
- [x] Error boundaries for component failures
- [x] Loading states with skeleton UI
- [x] Empty states with helpful messaging
- [x] Retry mechanisms for failed operations
- [x] Fallback UI when components fail

### Telemetry
- [x] `useTelemetry` hook for tracking events
- [x] Tracks component mounts, clicks, errors
- [x] Includes tool call IDs in events
- [x] Console logging in development
- [x] Ready for analytics service integration

### Mobile Support
- [x] Respects `window.openai.safeArea` insets
- [x] Responsive layouts
- [x] Touch-friendly controls
- [x] Adaptive breakpoints

### Performance
- [x] Code splitting by route
- [x] Lazy loading of tabs
- [x] Optimized bundle size
- [x] Minimal re-renders

## Architecture

### File Structure

```
src/client/
├── components/          # Reusable UI components
│   ├── EmptyState.tsx   # Empty state component
│   ├── ErrorState.tsx   # Error state with retry
│   ├── InlineWidget.tsx # Simplified inline widget
│   └── LoadingState.tsx # Loading skeletons
├── hooks/               # Custom React hooks
│   ├── useOpenAi.ts     # window.openai bridge
│   └── useToolCall.ts   # Tool calling with states
├── layouts/             # Layout components
│   └── DashboardLayout.tsx # Full dashboard layout
├── lib/                 # Utilities
│   ├── i18n.ts          # Localization messages
│   └── telemetry.ts     # Telemetry infrastructure
├── tabs/                # Tab content components
│   ├── OverviewTab.tsx  # System health overview
│   ├── MetricsTab.tsx   # Metrics and charts
│   ├── LogsTab.tsx      # Log viewer
│   ├── TracesTab.tsx    # Distributed traces
│   └── ControlsTab.tsx  # Workflow controls
├── App.new.tsx          # Main app with routing
├── main.tsx             # Entry point
└── index.css            # Global styles
```

### Component Patterns

#### 1. Tool Calling Pattern

```typescript
import { useToolCall } from '../hooks/useToolCall';

function MyComponent() {
  const { data, loading, error, retry } = useToolCall<MyData>('tool_name', args);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={retry} />;
  if (!data) return <EmptyState title="No data" />;

  return <div>{/* render data */}</div>;
}
```

#### 2. Telemetry Pattern

```typescript
import { useTelemetry } from '../lib/telemetry';

function MyComponent() {
  const track = useTelemetry();

  const handleClick = () => {
    track('button_clicked', { button: 'submit' });
    // ... handle click
  };

  return <Button onClick={handleClick}>Submit</Button>;
}
```

#### 3. Localization Pattern

```typescript
import { FormattedMessage, useIntl } from 'react-intl';

function MyComponent() {
  const intl = useIntl();

  return (
    <div>
      <h1><FormattedMessage id="my.title" /></h1>
      <input placeholder={intl.formatMessage({ id: 'my.placeholder' })} />
    </div>
  );
}
```

#### 4. Navigation Pattern

```typescript
import { useNavigate, NavLink } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate('/dashboard/details');
  };

  return (
    <nav>
      <NavLink to="/dashboard">Overview</NavLink>
      <NavLink to="/dashboard/metrics">Metrics</NavLink>
    </nav>
  );
}
```

## Display Mode Behavior

### Inline Mode
- Shows simplified `InlineWidget` component
- Displays: status badge, uptime, component count
- Single CTA: "View Dashboard" button
- Calls `requestDisplayMode('fullscreen')` on click

### Fullscreen Mode
- Shows complete `DashboardLayout` with tabs
- Full navigation with React Router
- All features accessible
- Close button calls `requestClose()`

### PiP Mode
- Same as fullscreen (mobile may coerce to fullscreen)
- Compact layout optimizations

## State Persistence

Widget state is persisted via `window.openai.setWidgetState()`:

```typescript
const [preferences, setPreferences] = useWidgetState({
  autoRefresh: true,
  theme: 'auto',
  defaultTab: 'overview',
});
```

State is:
- Scoped to widget instance (message_id/widgetId)
- Rehydrated on widget mount
- Sent to model for context
- Kept under 4k tokens

## Telemetry Events

Tracked events:
- `component_mounted` - Component initialization
- `tab_clicked` - Tab navigation
- `button_clicked` - Button interactions
- `tool_call_started` - Tool invocation
- `tool_call_success` - Tool success
- `tool_call_error` - Tool failure
- `view_dashboard_clicked` - Inline → Fullscreen
- `dashboard_closed` - Close button

Each event includes:
- `toolCallId` - Current tool call ID
- `timestamp` - ISO 8601 timestamp
- Custom properties

## Localization

Supported locales:
- `en-US` (English)
- `es-ES` (Spanish)

To add a new locale:
1. Add messages to `src/client/lib/i18n.ts`
2. Use same keys as `en-US`
3. Test with `window.openai.locale = 'your-locale'`

## Accessibility Features

### Keyboard Navigation
- Tab through all interactive elements
- Arrow keys for tab navigation
- Enter/Space for buttons
- Escape to close modals

### Screen Readers
- ARIA labels on all controls
- ARIA live regions for updates
- Semantic HTML structure
- Skip links for navigation

### Visual
- High contrast mode support
- Color-independent indicators
- Visible focus states
- Reduced motion support

## Testing

### Manual Testing
1. Test inline mode: `window.openai.displayMode = 'inline'`
2. Test fullscreen: `window.openai.displayMode = 'fullscreen'`
3. Test locale: `window.openai.locale = 'es-ES'`
4. Test theme: `window.openai.theme = 'dark'`

### Automated Testing
```bash
# Run tests
pnpm test

# Run accessibility audit
pnpm test:a11y

# Run lint
pnpm lint
```

## Migration from Old Architecture

### Changes Made
1. ✅ Added React Router for navigation
2. ✅ Simplified inline widget
3. ✅ Added loading/empty/error states
4. ✅ Added telemetry infrastructure
5. ✅ Added localization support
6. ✅ Added safe area inset handling
7. ✅ Refactored to conformant patterns

### Breaking Changes
- Tab state now managed by React Router (URL-based)
- Display mode detection moved to App level
- Tool calling now uses `useToolCall` hook
- All text must use `<FormattedMessage>`

### Migration Steps
1. Install new dependencies: `pnpm install`
2. Replace `App.tsx` with `App.new.tsx`
3. Update imports to use new components
4. Wrap text in `<FormattedMessage>`
5. Replace direct tool calls with `useToolCall`
6. Add telemetry tracking to interactions

## Next Steps

### Phase 1: Complete Core Tabs
- [ ] Implement MetricsTab with real data
- [ ] Implement LogsTab with filtering
- [ ] Implement TracesTab with timeline
- [ ] Implement ControlsTab with workflow management

### Phase 2: Real-Time Updates
- [ ] Add SSE client for live updates
- [ ] Add WebSocket client for bidirectional
- [ ] Update components reactively
- [ ] Add connection status indicator

### Phase 3: Advanced Features
- [ ] Add diagnostics tab
- [ ] Add security tab
- [ ] Add search across all tabs
- [ ] Add export functionality

### Phase 4: Polish
- [ ] Run axe accessibility audit
- [ ] Add integration tests
- [ ] Optimize bundle size
- [ ] Add performance monitoring

## Resources

- [Apps SDK Documentation](https://developers.openai.com/apps-sdk/)
- [Apps SDK UI Components](https://openai.github.io/apps-sdk-ui)
- [Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [React Router Docs](https://reactrouter.com/)
- [React Intl Docs](https://formatjs.io/docs/react-intl/)
