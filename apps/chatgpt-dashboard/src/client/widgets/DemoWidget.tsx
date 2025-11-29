import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Activity, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DemoData {
    status: 'healthy' | 'degraded' | 'down';
    uptime: number;
    activeAgents: number;
    lastCheck: string;
}

export function DemoWidget() {
    const [data, setData] = useState<DemoData | null>(null);
    const [loading, setLoading] = useState(true);

    // Simulate fetching data from window.openai.toolOutput
    useEffect(() => {
        // In a real widget, this would be:
        // const output = window.openai?.toolOutput;
        // if (output?.structuredContent) setData(output.structuredContent);

        // Mock for dev harness
        const mockData: DemoData = {
            status: 'healthy',
            uptime: 99.9,
            activeAgents: 12,
            lastCheck: new Date().toISOString()
        };

        const timer = setTimeout(() => {
            setData(mockData);
            setLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    const handleRefresh = async () => {
        setLoading(true);
        // In a real widget: await window.openai.callTool('refresh_status');
        setTimeout(() => setLoading(false), 800);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-48 bg-cortex-surface rounded-lg border border-cortex-border animate-pulse">
                <div className="flex flex-col items-center gap-2 text-cortex-muted">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="text-sm font-medium">Loading Widget...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-cortex-surface border border-cortex-border rounded-lg p-6 shadow-lg max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-cortex-bg rounded-md border border-cortex-border">
                        <Activity className="w-5 h-5 text-cortex-accent" />
                    </div>
                    <div>
                        <h3 className="font-display font-semibold text-lg text-white">System Status</h3>
                        <p className="text-xs text-cortex-muted font-mono">ID: sys-core-01</p>
                    </div>
                </div>
                <Badge variant={data?.status === 'healthy' ? 'success' : 'danger'}>
                    {data?.status.toUpperCase()}
                </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-cortex-bg rounded-md border border-cortex-border">
                    <span className="text-xs text-cortex-muted uppercase tracking-wider">Uptime</span>
                    <div className="text-2xl font-display font-bold text-white mt-1">{data?.uptime}%</div>
                </div>
                <div className="p-3 bg-cortex-bg rounded-md border border-cortex-border">
                    <span className="text-xs text-cortex-muted uppercase tracking-wider">Active Agents</span>
                    <div className="text-2xl font-display font-bold text-white mt-1">{data?.activeAgents}</div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-cortex-border">
                <span className="text-xs text-cortex-muted">
                    Last check: {new Date(data?.lastCheck || '').toLocaleTimeString()}
                </span>
                <Button variant="secondary" size="sm" onClick={handleRefresh}>
                    Refresh
                </Button>
            </div>
        </div>
    );
}
