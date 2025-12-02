import { Badge } from '@openai/apps-sdk-ui/components/Badge';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Activity, RefreshCw, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { callTool, requestDisplayMode, useToolOutput } from '../hooks/useOpenAi.js';

export interface HealthData {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    uptimeFormatted?: string;
    version: string;
    protocol: string;
    components: Array<{
        name: string;
        status: 'healthy' | 'degraded' | 'unhealthy';
    }>;
}

export function HealthCard() {
    const healthData = useToolOutput<HealthData>();
    const [loading, setLoading] = useState(false);

    const handleRefresh = async () => {
        setLoading(true);
        try {
            await callTool('get_health', {});
        } catch (error) {
            console.error('Failed to refresh health:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async () => {
        try {
            await requestDisplayMode('fullscreen');
        } catch (error) {
            console.error('Failed to request fullscreen:', error);
        }
    };

    if (!healthData) {
        return (
            <div className="rounded-2xl border border-default bg-surface shadow-lg p-4">
                <div className="flex items-center justify-center p-8">
                    <Activity className="size-8 animate-pulse text-secondary" />
                </div>
            </div>
        );
    }

    const statusColor =
        healthData.status === 'healthy' ? 'success' :
            healthData.status === 'degraded' ? 'warning' :
                'danger';

    return (
        <div className="w-full max-w-2xl rounded-2xl border border-default bg-surface shadow-lg p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Activity className="size-5 text-secondary" />
                    <div>
                        <p className="text-secondary text-sm">System Health</p>
                        <h2 className="mt-1 heading-lg">CortexDx</h2>
                    </div>
                </div>
                <Badge color={statusColor} size="lg">
                    {healthData.status}
                </Badge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-sm text-secondary">Uptime</p>
                    <p className="mt-1 text-2xl font-bold">{healthData.uptimeFormatted || `${Math.floor(healthData.uptime / 3600)}h`}</p>
                </div>
                <div>
                    <p className="text-sm text-secondary">Version</p>
                    <p className="mt-1 text-2xl font-bold">{healthData.version}</p>
                </div>
                <div>
                    <p className="text-sm text-secondary">Protocol</p>
                    <p className="mt-1 text-lg font-bold">{healthData.protocol}</p>
                </div>
            </div>

            {healthData.components && healthData.components.length > 0 && (
                <div className="mt-4 space-y-2">
                    {healthData.components.slice(0, 3).map((component) => {
                        const compColor =
                            component.status === 'healthy' ? 'success' :
                                component.status === 'degraded' ? 'warning' :
                                    'danger';

                        return (
                            <div
                                key={component.name}
                                className="flex items-center justify-between p-3 bg-default rounded-lg border border-subtle"
                            >
                                <span className="text-sm font-medium">{component.name}</span>
                                <Badge color={compColor} size="sm">
                                    {component.status}
                                </Badge>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-4 grid gap-3 border-t border-subtle pt-4 sm:grid-cols-2">
                <Button
                    variant="outline"
                    color="secondary"
                    block
                    onClick={handleRefresh}
                    disabled={loading}
                >
                    <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
                <Button
                    color="primary"
                    block
                    onClick={handleViewDetails}
                >
                    <TrendingUp className="size-4" />
                    View Details
                </Button>
            </div>
        </div>
    );
}
