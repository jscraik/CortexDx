/**
 * Dashboard layout with navigation tabs
 * Uses React Router for host-backed navigation
 */

import { Activity, BarChart2, FileText, Search, Sliders } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { NavLink, Outlet } from 'react-router-dom';
import { requestClose } from '../hooks/useOpenAi.js';
import { useTelemetry } from '../lib/telemetry.js';

const tabs = [
  { id: 'overview', path: '/dashboard', icon: Activity, label: 'Overview' },
  { id: 'metrics', path: '/dashboard/metrics', icon: BarChart2, label: 'Metrics' },
  { id: 'logs', path: '/dashboard/logs', icon: FileText, label: 'Logs' },
  { id: 'traces', path: '/dashboard/traces', icon: Search, label: 'Traces' },
  { id: 'controls', path: '/dashboard/controls', icon: Sliders, label: 'Controls' },
];

export function DashboardLayout() {
  const track = useTelemetry();

  const handleClose = () => {
    track('dashboard_closed');
    requestClose();
  };

  return (
    <div className="min-h-screen bg-cortex-bg">
      {/* Header */}
      <header className="bg-cortex-surface border-b border-cortex-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-cortex-accent" />
            <div>
              <h1 className="text-xl font-bold text-cortex-text">
                <FormattedMessage id="dashboard.title" />
              </h1>
              <p className="text-sm text-cortex-muted">
                <FormattedMessage id="dashboard.subtitle" />
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-cortex-muted hover:text-cortex-text transition-colors"
            aria-label="Close dashboard"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav
        className="bg-cortex-surface border-b border-cortex-border px-6"
        role="navigation"
        aria-label="Dashboard navigation"
      >
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.path === '/dashboard'}
                onClick={() => track('tab_clicked', { tab: tab.id })}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? 'text-cortex-accent border-cortex-accent'
                      : 'text-cortex-muted border-transparent hover:text-cortex-text hover:border-cortex-border'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Content Area */}
      <main className="p-6">
        <Outlet />
      </main>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-cortex-surface border-t border-cortex-border px-6 py-2">
        <div className="flex items-center justify-between text-xs text-cortex-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Connected
            </span>
            <span>Last update: 2s ago</span>
          </div>
          <div>MCP v2025-03-26</div>
        </div>
      </footer>
    </div>
  );
}
