/**
 * Main App component with React Router for host-backed navigation
 * Conforms to Apps SDK navigation guidelines
 */

import { IntlProvider } from "react-intl";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useDisplayMode, useOpenAiGlobal } from "./hooks/useOpenAi.js";
import { messages } from "./lib/i18n.js";
import { InlineWidget } from "./components/InlineWidget.js";
import { DashboardLayout } from "./layouts/DashboardLayout.js";
import { OverviewTab } from "./tabs/OverviewTab.js";
import { MetricsTab } from "./tabs/MetricsTab.js";
import { LogsTab } from "./tabs/LogsTab.js";
import { TracesTab } from "./tabs/TracesTab.js";
import { ControlsTab } from "./tabs/ControlsTab.js";

function AppContent() {
  const displayMode = useDisplayMode();

  // Inline mode: show simplified widget
  if (displayMode === "inline") {
    return <InlineWidget />;
  }

  // Fullscreen/PiP mode: show full dashboard with routing
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<OverviewTab />} />
        <Route path="metrics" element={<MetricsTab />} />
        <Route path="logs" element={<LogsTab />} />
        <Route path="traces" element={<TracesTab />} />
        <Route path="controls" element={<ControlsTab />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  // Get locale from window.openai (Apps SDK guideline)
  const locale = useOpenAiGlobal("locale") ?? "en-US";

  // Get safe area insets for mobile (Apps SDK guideline)
  const safeArea = useOpenAiGlobal("safeArea");

  return (
    <IntlProvider
      locale={locale}
      messages={messages[locale as keyof typeof messages] || messages["en-US"]}
    >
      <BrowserRouter>
        <div
          style={{
            paddingTop: safeArea?.insets?.top || 0,
            paddingBottom: safeArea?.insets?.bottom || 0,
            paddingLeft: safeArea?.insets?.left || 0,
            paddingRight: safeArea?.insets?.right || 0,
            minHeight: "100vh",
          }}
        >
          <AppContent />
        </div>
      </BrowserRouter>
    </IntlProvider>
  );
}
