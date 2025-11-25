
import { Activity, BarChart2, FileText, Search, Sliders } from 'lucide-react';
import { useState } from 'react';
import { ControlsPanel } from './components/ControlsPanel.js';
import { HealthPanel } from './components/HealthPanel.js';
import { LogsPanel } from './components/LogsPanel.js';
import { MetricsPanel } from './components/MetricsPanel.js';
import { TracesPanel } from './components/TracesPanel.js';

function App() {
  const [activeTab, setActiveTab] = useState('health');

  const renderContent = () => {
    switch (activeTab) {
      case 'health': return <HealthPanel />;
      case 'logs': return <LogsPanel />;
      case 'traces': return <TracesPanel />;
      case 'metrics': return <MetricsPanel />;
      case 'controls': return <ControlsPanel />;
      default: return <HealthPanel />;
    }
  };

  const tabs = [
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'logs', label: 'Logs', icon: FileText },
    { id: 'traces', label: 'Traces', icon: Search },
    { id: 'metrics', label: 'Metrics', icon: BarChart2 },
    { id: 'controls', label: 'Controls', icon: Sliders },
  ];

  return (
    <div className="min-h-screen bg-cortex-bg text-cortex-text font-sans selection:bg-cortex-accent selection:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-white tracking-tight">
                Cortex<span className="text-cortex-accent">Dx</span>
              </h1>
              <p className="mt-1 text-cortex-muted text-sm font-medium">Diagnostic Control Center</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cortex-surface border border-cortex-border">
                <div className="w-2 h-2 rounded-full bg-cortex-success animate-pulse" />
                <span className="text-xs font-medium text-cortex-text">System Online</span>
              </div>
            </div>
          </div>

          <nav className="mt-8 flex space-x-1 bg-cortex-surface/50 p-1 rounded-xl border border-cortex-border backdrop-blur-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-cortex-accent text-white shadow-lg shadow-cortex-accent/20'
                      : 'text-cortex-muted hover:text-cortex-text hover:bg-cortex-surface'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-current'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="transition-all duration-300 ease-in-out">
          {renderContent()}
        </main>

        <footer className="mt-12 pt-8 border-t border-cortex-border text-center text-sm text-cortex-muted">
          <p>CortexDx Control Panel v0.1.0 | <a href="/.well-known/oauth-protected-resource" className="text-cortex-accent hover:underline">OAuth Metadata</a> | MCP v2025-03-26</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
