import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Select } from '@openai/apps-sdk-ui/components/Select';
import { Pause, Play, Rocket, Trash2 } from 'lucide-react';

export function ControlsPanel() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
      {/* Active Runs Section */}
      <section>
        <h3 className="text-lg font-bold text-cortex-text mb-4 pb-2 border-b border-cortex-border font-display flex items-center gap-2">
          <div className="w-1 h-6 bg-cortex-accent rounded-full" />
          Active Runs
        </h3>
        <div className="bg-cortex-surface rounded-xl border border-cortex-border shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-cortex-border">
            <thead className="bg-cortex-bg/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">Run ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">Workflow</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">Status</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-cortex-surface divide-y divide-cortex-border">
              <tr>
                <td className="px-6 py-8 text-sm text-cortex-muted text-center italic" colSpan={4}>
                  No active runs detected
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Global Actions Section */}
      <section>
        <h3 className="text-lg font-bold text-cortex-text mb-4 pb-2 border-b border-cortex-border font-display flex items-center gap-2">
          <div className="w-1 h-6 bg-cortex-warning rounded-full" />
          Global Actions
        </h3>
        <div className="flex flex-wrap gap-4">
          <Button variant="outline" color="warning" className="border-cortex-warning/50 text-cortex-warning hover:bg-cortex-warning/10 transition-colors">
            <Pause className="w-4 h-4 mr-2" />
            Pause All
          </Button>
          <Button variant="outline" color="success" className="border-cortex-success/50 text-cortex-success hover:bg-cortex-success/10 transition-colors">
            <Play className="w-4 h-4 mr-2" />
            Resume All
          </Button>
          <Button variant="outline" color="danger" className="border-cortex-danger/50 text-cortex-danger hover:bg-cortex-danger/10 transition-colors">
            <Trash2 className="w-4 h-4 mr-2" />
            Drain Queue
          </Button>
        </div>
      </section>

      {/* Test Flow Section */}
      <section>
        <h3 className="text-lg font-bold text-cortex-text mb-4 pb-2 border-b border-cortex-border font-display flex items-center gap-2">
          <div className="w-1 h-6 bg-cortex-accent rounded-full" />
          Test Flow
        </h3>
        <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border shadow-sm max-w-xl hover:shadow-md transition-shadow duration-300">
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <label htmlFor="mcp-endpoint" className="block text-sm font-medium text-cortex-text">MCP Endpoint</label>
              <Input
                id="mcp-endpoint"
                placeholder="http://localhost:3024/mcp"
                defaultValue="http://localhost:3024/mcp"
                className="bg-cortex-bg border-cortex-border text-cortex-text placeholder:text-cortex-muted focus:ring-cortex-accent"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="workflow-select" className="block text-sm font-medium text-cortex-text">Workflow</label>
              <Select
                id="workflow-select"
                options={[
                  { label: 'Diagnose', value: 'diagnose' },
                  { label: 'Self-Healing', value: 'self-healing' },
                  { label: 'Research', value: 'research' },
                ]}
                value="diagnose"
                onChange={() => { }}
                triggerClassName="bg-cortex-bg border-cortex-border text-cortex-text"
              />
            </div>
            <Button type="submit" color="primary" className="w-full bg-cortex-accent hover:bg-cortex-accent-hover text-white shadow-lg shadow-cortex-accent/20 transition-all duration-200 hover:scale-[1.02]">
              <Rocket className="w-4 h-4 mr-2" />
              Run Test Flow
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
