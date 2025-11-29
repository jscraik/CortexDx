import { Layout } from 'lucide-react';
import { DemoWidget } from '../widgets/DemoWidget.js';

export function WidgetsPanel() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-display font-bold text-white">Widget Development</h2>
                    <p className="text-cortex-muted">Preview and test MCP widgets in isolation.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cortex-surface border border-cortex-border">
                    <Layout className="w-4 h-4 text-cortex-accent" />
                    <span className="text-xs font-medium text-cortex-text">Dev Harness Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Demo Widget Container */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-sm font-medium text-cortex-muted">Demo Widget</span>
                        <span className="text-xs font-mono text-cortex-muted opacity-50">ui://widget/demo.html</span>
                    </div>
                    <div className="p-4 border border-dashed border-cortex-border rounded-xl bg-cortex-bg/50">
                        <DemoWidget />
                    </div>
                </div>

                {/* Placeholder for future widgets */}
                <div className="flex items-center justify-center p-12 border border-dashed border-cortex-border rounded-xl bg-cortex-bg/30 text-cortex-muted">
                    <div className="text-center">
                        <p className="text-sm">Add more widgets to</p>
                        <code className="text-xs bg-cortex-surface px-1.5 py-0.5 rounded mt-1 block">src/client/widgets/</code>
                    </div>
                </div>
            </div>
        </div>
    );
}
