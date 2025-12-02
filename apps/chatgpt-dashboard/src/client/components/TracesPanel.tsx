import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { ChevronRight, Clock, RefreshCw, Search } from 'lucide-react';

interface TraceSpan {
  id: string;
  traceId: string;
  name: string;
  operation: string;
  duration: number;
  status: 'success' | 'danger';
  timestamp: string;
}

export function TracesPanel() {
  const traces: TraceSpan[] = [
    { id: 's1', traceId: 't1', name: 'GET /api/health', operation: 'http.request', duration: 45, status: 'success', timestamp: '10:00:01' },
    { id: 's2', traceId: 't2', name: 'POST /api/control', operation: 'http.request', duration: 120, status: 'success', timestamp: '10:05:22' },
    { id: 's3', traceId: 't3', name: 'BackgroundJob:Sync', operation: 'background.job', duration: 540, status: 'danger', timestamp: '10:10:15' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
      <div className="flex justify-between items-center bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm">
        <div className="relative w-96 group">
          <Input
            placeholder="Search trace ID or operation..."
            className="pl-10 bg-cortex-bg border-cortex-border text-cortex-text placeholder:text-cortex-muted focus:ring-cortex-accent transition-all duration-200"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cortex-muted group-focus-within:text-cortex-accent transition-colors duration-200 pointer-events-none" />
        </div>
        <Button variant="outline" color="secondary" className="border-cortex-border text-cortex-text hover:bg-cortex-bg hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="bg-cortex-surface rounded-xl border border-cortex-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-cortex-border bg-cortex-surface/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-cortex-text font-display">Recent Traces</h3>
        </div>
        <div className="divide-y divide-cortex-border">
          {traces.map((trace) => (
            <div key={trace.id} className="p-4 hover:bg-cortex-bg/50 transition-colors duration-200 group cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Badge
                    color={trace.status === 'success' ? 'success' : 'danger'}
                    variant="soft"
                    size="sm"
                    pill
                  >
                    {trace.status}
                  </Badge>
                  <span className="font-mono text-sm text-cortex-accent group-hover:text-cortex-accent-hover transition-colors">{trace.id}</span>
                  <span className="text-sm font-medium text-cortex-text">{trace.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-cortex-muted">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {trace.duration}
                  </div>
                  <span>{trace.timestamp}</span>
                  <ChevronRight className="w-4 h-4 text-cortex-border group-hover:text-cortex-muted transition-colors" />
                </div>
              </div>

              {/* Mini timeline visualization */}
              <div className="mt-3 relative h-1.5 bg-cortex-bg rounded-full overflow-hidden">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full ${trace.status === 'success' ? 'bg-cortex-success' : 'bg-cortex-danger'}`}
                  style={{ width: '100%' }} // Mock width
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
