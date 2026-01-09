# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ChatGPT Host                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    window.openai API                   │  │
│  │  • displayMode, theme, locale, safeArea               │  │
│  │  • toolOutput, toolInput, widgetState                 │  │
│  │  • callTool(), sendFollowUpMessage()                  │  │
│  │  • requestDisplayMode(), requestClose()               │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Dashboard iframe                      │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────┐     │  │
│  │  │            IntlProvider (i18n)               │     │  │
│  │  │  ┌────────────────────────────────────────┐  │     │  │
│  │  │  │       BrowserRouter (routing)          │  │     │  │
│  │  │  │  ┌──────────────────────────────────┐  │  │     │  │
│  │  │  │  │  App (display mode detection)    │  │  │     │  │
│  │  │  │  │                                  │  │  │     │  │
│  │  │  │  │  Inline Mode:                    │  │  │     │  │
│  │  │  │  │  ┌────────────────────────────┐  │  │  │     │  │
│  │  │  │  │  │     InlineWidget           │  │  │  │     │  │
│  │  │  │  │  │  • Status badge            │  │  │  │     │  │
│  │  │  │  │  │  • Uptime                  │  │  │  │     │  │
│  │  │  │  │  │  • Component count         │  │  │  │     │  │
│  │  │  │  │  │  • [View Dashboard] CTA    │  │  │  │     │  │
│  │  │  │  │  └────────────────────────────┘  │  │  │     │  │
│  │  │  │  │                                  │  │  │     │  │
│  │  │  │  │  Fullscreen Mode:                │  │  │     │  │
│  │  │  │  │  ┌────────────────────────────┐  │  │  │     │  │
│  │  │  │  │  │    DashboardLayout         │  │  │  │     │  │
│  │  │  │  │  │  ┌──────────────────────┐  │  │  │  │     │  │
│  │  │  │  │  │  │  Header + Nav Tabs   │  │  │  │  │     │  │
│  │  │  │  │  │  └──────────────────────┘  │  │  │  │     │  │
│  │  │  │  │  │  ┌──────────────────────┐  │  │  │  │     │  │
│  │  │  │  │  │  │  <Outlet> (Routes)   │  │  │  │  │     │  │
│  │  │  │  │  │  │  • OverviewTab       │  │  │  │  │     │  │
│  │  │  │  │  │  │  • MetricsTab        │  │  │  │  │     │  │
│  │  │  │  │  │  │  • LogsTab           │  │  │  │  │     │  │
│  │  │  │  │  │  │  • TracesTab         │  │  │  │  │     │  │
│  │  │  │  │  │  │  • ControlsTab       │  │  │  │  │     │  │
│  │  │  │  │  │  └──────────────────────┘  │  │  │  │     │  │
│  │  │  │  │  │  ┌──────────────────────┐  │  │  │  │     │  │
│  │  │  │  │  │  │  Status Bar          │  │  │  │  │     │  │
│  │  │  │  │  │  └──────────────────────┘  │  │  │  │     │  │
│  │  │  │  │  └────────────────────────────┘  │  │  │     │  │
│  │  │  │  └──────────────────────────────────┘  │  │     │  │
│  │  │  └────────────────────────────────────────┘  │     │  │
│  │  └──────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server (Backend)                   │
│  • HTTP/SSE/WebSocket transports                            │
│  • Tools: get_health, get_logs, get_traces, etc.           │
│  • Resources: cortex://health, cortex://metrics            │
└─────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
├── IntlProvider (i18n)
│   └── BrowserRouter (routing)
│       └── SafeAreaContainer
│           ├── InlineWidget (displayMode === 'inline')
│           │   ├── useToolCall('get_health')
│           │   ├── LoadingState | ErrorState | Content
│           │   └── Button (requestDisplayMode)
│           │
│           └── Routes (displayMode === 'fullscreen')
│               └── DashboardLayout
│                   ├── Header
│                   │   ├── Title
│                   │   └── CloseButton
│                   ├── Navigation
│                   │   └── NavLink[] (tabs)
│                   ├── Outlet (tab content)
│                   │   ├── OverviewTab
│                   │   │   ├── useToolCall('get_health')
│                   │   │   ├── LoadingState | ErrorState
│                   │   │   └── HealthCards
│                   │   ├── MetricsTab
│                   │   ├── LogsTab
│                   │   ├── TracesTab
│                   │   └── ControlsTab
│                   └── StatusBar
```

## Data Flow

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       │
       ↓
┌──────────────────────┐
│ Component            │
│ • useTelemetry()     │ ──→ Track event
│ • useToolCall()      │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│ window.openai        │
│ • callTool()         │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│ MCP Server           │
│ • Execute tool       │
│ • Return data        │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│ Component State      │
│ • data               │
│ • loading → false    │
│ • error (if any)     │
└──────┬───────────────┘
       │
       ↓
┌──────────────────────┐
│ Render               │
│ • LoadingState       │
│ • ErrorState         │
│ • EmptyState         │
│ • Content            │
└──────────────────────┘
```

## Navigation Flow

```
User clicks tab
       │
       ↓
NavLink onClick
       │
       ↓
React Router
       │
       ├─→ Update URL (/dashboard/metrics)
       │
       ├─→ Update browser history
       │
       └─→ Notify ChatGPT host (Skybridge)
              │
              ↓
       ChatGPT UI updates navigation controls
              │
              ↓
       React Router renders new route
              │
              ↓
       <Outlet> renders MetricsTab
              │
              ↓
       MetricsTab mounts
              │
              ├─→ useTelemetry() tracks mount
              │
              └─→ useToolCall() fetches data
```

## State Management

```
┌─────────────────────────────────────────────────────────┐
│                    State Layers                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. window.openai (Host State)                         │
│     • displayMode, theme, locale                       │
│     • toolOutput, widgetState                          │
│     • Read-only from component perspective             │
│                                                         │
│  2. React Router (Navigation State)                    │
│     • Current route                                    │
│     • History stack                                    │
│     • Location state                                   │
│                                                         │
│  3. Component State (Local State)                      │
│     • useToolCall() → data, loading, error             │
│     • useState() → UI state                            │
│     • useWidgetState() → Persisted preferences         │
│                                                         │
│  4. Server State (Backend)                             │
│     • Health status                                    │
│     • Logs, traces, metrics                            │
│     • Workflow runs                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Hook Dependencies

```
useToolCall
    ├─→ useCallback (fetchData)
    ├─→ useState (data, loading, error)
    ├─→ useEffect (fetch on mount/retry)
    └─→ callTool (from useOpenAi)
        └─→ window.openai.callTool

useTelemetry
    ├─→ useCallback (track)
    └─→ useOpenAiGlobal('toolResponseMetadata')
        └─→ useSyncExternalStore
            └─→ window.openai + event listeners

useOpenAiGlobal
    └─→ useSyncExternalStore
        ├─→ subscribe (openai:set_globals event)
        └─→ getSnapshot (window.openai[key])
```

## Rendering Pipeline

```
1. Initial Render
   ├─→ App mounts
   ├─→ IntlProvider sets locale
   ├─→ BrowserRouter initializes
   ├─→ Check displayMode
   │   ├─→ inline: Render InlineWidget
   │   └─→ fullscreen: Render Routes
   └─→ Component mounts
       ├─→ useToolCall() starts fetch
       ├─→ Render LoadingState
       └─→ useTelemetry() tracks mount

2. Data Loaded
   ├─→ useToolCall() updates state
   ├─→ Component re-renders
   └─→ Render content

3. User Interaction
   ├─→ Button click
   ├─→ useTelemetry() tracks event
   ├─→ Action handler executes
   │   ├─→ callTool() (if needed)
   │   ├─→ navigate() (if navigation)
   │   └─→ requestDisplayMode() (if mode change)
   └─→ Component updates

4. Navigation
   ├─→ React Router updates
   ├─→ Old route unmounts
   ├─→ New route mounts
   └─→ Repeat from step 1
```

## Error Handling Flow

```
Error occurs
    │
    ├─→ In useToolCall
    │   ├─→ Catch error
    │   ├─→ Set error state
    │   ├─→ trackError() (telemetry)
    │   └─→ Component renders ErrorState
    │       └─→ User clicks Retry
    │           └─→ Increment retryCount
    │               └─→ useEffect re-runs fetch
    │
    ├─→ In component
    │   ├─→ Error boundary catches
    │   ├─→ trackError() (telemetry)
    │   └─→ Render fallback UI
    │
    └─→ In event handler
        ├─→ Try/catch block
        ├─→ trackError() (telemetry)
        └─→ Show error message
```

## Build & Deploy Pipeline

```
Source Code
    │
    ├─→ TypeScript compilation
    │   └─→ Type checking
    │
    ├─→ Vite build
    │   ├─→ Bundle client code
    │   ├─→ Code splitting
    │   ├─→ Tree shaking
    │   └─→ Asset optimization
    │
    ├─→ Tsup build
    │   └─→ Bundle server code
    │
    └─→ Output
        ├─→ dist/client/
        │   ├─→ index.html
        │   ├─→ assets/*.js
        │   └─→ assets/*.css
        └─→ dist/
            ├─→ index.js (server)
            └─→ types/
```

## Key Design Decisions

### 1. React Router over Local State
**Why:** Host-backed navigation, browser history, deep linking

### 2. useToolCall Hook
**Why:** Consistent data fetching, automatic loading/error states

### 3. Separate Inline/Fullscreen Components
**Why:** Progressive disclosure, optimized for each mode

### 4. react-intl for i18n
**Why:** Industry standard, ICU message format, pluralization

### 5. Telemetry Infrastructure
**Why:** Debugging, analytics, user behavior insights

### 6. Component-Level Imports
**Why:** Tree shaking, code splitting, smaller bundles

## Performance Considerations

### Code Splitting
- Routes lazy loaded
- Tabs loaded on demand
- Reduces initial bundle size

### Memoization
- useCallback for event handlers
- useMemo for expensive computations
- React.memo for pure components

### Optimistic Updates
- Show loading state immediately
- Update UI before server confirms
- Rollback on error

### Caching
- Tool call results cached
- Avoid redundant fetches
- Invalidate on user action

## Security Considerations

### Input Validation
- Validate all user inputs
- Sanitize before sending to server
- Type checking with TypeScript

### XSS Protection
- React escapes by default
- No dangerouslySetInnerHTML
- CSP headers on server

### Authentication
- OAuth via window.openai
- No credentials in client
- Token refresh handled by host

### Data Privacy
- No PII in telemetry
- Respect user preferences
- GDPR compliant
