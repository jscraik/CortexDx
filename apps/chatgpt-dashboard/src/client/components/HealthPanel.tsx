import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface ComponentStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  lastCheck: string;
  message: string;
}

export function HealthPanel() {
  // Mock data for now
  const components: ComponentStatus[] = [
    {
      name: "Database",
      status: "healthy",
      lastCheck: "2s ago",
      message: "Connected",
    },
    {
      name: "API Gateway",
      status: "healthy",
      lastCheck: "1s ago",
      message: "Operational",
    },
    {
      name: "Worker Pool",
      status: "degraded",
      lastCheck: "5s ago",
      message: "High Load",
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getBadgeColor = (
    status: string,
  ): "success" | "warning" | "danger" | "secondary" => {
    switch (status) {
      case "healthy":
        return "success";
      case "degraded":
        return "warning";
      case "unhealthy":
        return "danger";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-shadow duration-300">
          <h3 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
            Overall Status
          </h3>
          <div className="mt-2 flex items-center gap-2">
            <Badge color="success" size="lg" pill>
              Healthy
            </Badge>
          </div>
        </div>
        <div className="bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-shadow duration-300">
          <h3 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
            Uptime
          </h3>
          <p className="mt-2 text-3xl font-bold text-cortex-text font-display tracking-tight">
            99.9%
          </p>
        </div>
        <div className="bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-shadow duration-300">
          <h3 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
            Version
          </h3>
          <p className="mt-2 text-3xl font-bold text-cortex-text font-display tracking-tight">
            v0.1.0
          </p>
        </div>
        <div className="bg-cortex-surface p-4 rounded-xl border border-cortex-border shadow-sm hover:shadow-md transition-shadow duration-300">
          <h3 className="text-xs font-bold text-cortex-muted uppercase tracking-wider font-display">
            Protocol
          </h3>
          <p className="mt-2 text-xl font-bold text-cortex-text font-display tracking-tight">
            MCP v2025-03-26
          </p>
        </div>
      </div>

      <div className="bg-cortex-surface rounded-xl border border-cortex-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-cortex-border bg-cortex-surface/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-cortex-text font-display">
            Component Health
          </h3>
        </div>
        <table className="min-w-full divide-y divide-cortex-border">
          <thead className="bg-cortex-bg/50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display"
              >
                Component
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display"
              >
                Last Check
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-cortex-muted uppercase tracking-wider font-display"
              >
                Message
              </th>
            </tr>
          </thead>
          <tbody className="bg-cortex-surface divide-y divide-cortex-border">
            {components.map((component) => (
              <tr
                key={component.name}
                className="hover:bg-cortex-bg/50 transition-colors duration-150"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-cortex-text">
                  {component.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cortex-muted">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(component.status)}
                    <Badge color={getBadgeColor(component.status)} size="sm">
                      {component.status}
                    </Badge>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cortex-muted font-mono">
                  {component.lastCheck}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-cortex-muted">
                  {component.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
