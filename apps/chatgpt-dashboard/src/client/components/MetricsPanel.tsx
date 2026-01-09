import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Clock, Cpu, HardDrive, Network, RefreshCw } from "lucide-react";

export function MetricsPanel() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
      <div className="flex justify-end bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-cortex-muted hover:text-cortex-text transition-colors cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-cortex-border bg-cortex-bg text-cortex-accent focus:ring-cortex-accent"
              defaultChecked
            />
            Auto-refresh (5s)
          </label>
          <Button
            variant="outline"
            size="sm"
            color="secondary"
            className="border-cortex-border text-cortex-text hover:bg-cortex-bg hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
              CPU Usage
            </h4>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-bold text-cortex-text font-display tracking-tight">
            12%
          </p>
          <p className="text-xs text-cortex-muted mt-2 font-medium">
            4 cores active
          </p>
          {/* Mini chart visualization */}
          <div className="mt-4 flex items-end gap-1 h-8">
            {[40, 70, 45, 90, 60, 30, 50, 80].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-blue-500/20 rounded-t-sm hover:bg-blue-500/40 transition-colors"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
              Memory
            </h4>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-bold text-cortex-text font-display tracking-tight">
            512MB
          </p>
          <p className="text-xs text-cortex-muted mt-2 font-medium">
            of 2GB allocated
          </p>
          <div className="mt-4 w-full bg-cortex-bg rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{ width: "25%" }}
            />
          </div>
        </div>

        <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
              Network In
            </h4>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Network className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-bold text-cortex-text font-display tracking-tight">
            1.2{" "}
            <span className="text-lg text-cortex-muted font-normal">MB/s</span>
          </p>
          <p className="text-xs text-cortex-muted mt-2 font-medium">
            Peak: 5.4 MB/s
          </p>
          <div className="mt-4 flex items-end gap-1 h-8">
            {[20, 30, 50, 40, 80, 40, 60, 30].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-emerald-500/20 rounded-t-sm hover:bg-emerald-500/40 transition-colors"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
              Avg Latency
            </h4>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-bold text-cortex-text font-display tracking-tight">
            45<span className="text-lg text-cortex-muted font-normal">ms</span>
          </p>
          <p className="text-xs text-cortex-muted mt-2 font-medium">
            p99: 120ms
          </p>
          <div className="mt-4 flex items-end gap-1 h-8">
            {[30, 40, 35, 50, 45, 40, 35, 40].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-amber-500/20 rounded-t-sm hover:bg-amber-500/40 transition-colors"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
