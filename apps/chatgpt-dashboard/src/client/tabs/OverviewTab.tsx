/**
 * Overview tab - System health and quick metrics
 * Conforms to Apps SDK component guidelines
 */

import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import { useToolCall } from "../hooks/useToolCall.js";
import { useTelemetry } from "../lib/telemetry.js";
import { EmptyState } from "../components/EmptyState.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import type { HealthStatus } from "../../types/index.js";

export function OverviewTab() {
  const intl = useIntl();
  const track = useTelemetry();
  const {
    data: health,
    loading,
    error,
    retry,
    refetch,
  } = useToolCall<HealthStatus>("get_health");

  const handleRefresh = () => {
    track("health_refresh_clicked");
    refetch();
  };

  if (loading) {
    return <LoadingState count={3} height={120} />;
  }

  if (error) {
    return (
      <ErrorState
        title={intl.formatMessage({ id: "state.error" })}
        message={error.message}
        onRetry={retry}
      />
    );
  }

  if (!health) {
    return (
      <EmptyState
        icon={<AlertTriangle size={48} />}
        title={intl.formatMessage({ id: "state.empty" })}
        description="No health data available"
      />
    );
  }

  const statusIcon =
    health.status === "healthy" ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : health.status === "degraded" ? (
      <AlertTriangle className="w-5 h-5 text-yellow-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );

  const statusColor =
    health.status === "healthy"
      ? "success"
      : health.status === "degraded"
        ? "warning"
        : "danger";

  return (
    <div className="space-y-6 max-w-6xl">
      {/* System Health Card */}
      <section aria-labelledby="health-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="health-heading"
            className="text-lg font-semibold text-cortex-text"
          >
            System Health
          </h2>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            color="secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <FormattedMessage id="action.refresh" />
          </Button>
        </div>

        <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border shadow-sm">
          {/* Status Header */}
          <div className="flex items-center gap-3 mb-6">
            {statusIcon}
            <Badge color={statusColor} className="text-base">
              <FormattedMessage id={`health.status.${health.status}`} />
            </Badge>
            {health.uptimeFormatted && (
              <span className="text-cortex-muted">
                ↑ {health.uptimeFormatted}
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <span className="text-cortex-muted">
                <FormattedMessage id="health.version" />:
              </span>{" "}
              <span className="text-cortex-text font-medium">
                {health.version}
              </span>
            </div>
            <div>
              <span className="text-cortex-muted">
                <FormattedMessage id="health.protocol" />:
              </span>{" "}
              <span className="text-cortex-text font-medium">
                {health.protocol}
              </span>
            </div>
          </div>

          {/* Components */}
          <div>
            <h3 className="text-sm font-semibold text-cortex-text mb-3">
              <FormattedMessage id="health.components" />
            </h3>
            <div className="space-y-2">
              {health.components.map((component) => {
                const compIcon =
                  component.status === "healthy" ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : component.status === "degraded" ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  );

                return (
                  <div
                    key={component.name}
                    className="flex items-center justify-between p-3 bg-cortex-bg rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {compIcon}
                      <span className="text-sm font-medium text-cortex-text">
                        {component.name}
                      </span>
                    </div>
                    <span className="text-xs text-cortex-muted">
                      {component.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Metrics Placeholder */}
      <section aria-labelledby="metrics-heading">
        <h2
          id="metrics-heading"
          className="text-lg font-semibold text-cortex-text mb-4"
        >
          Quick Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {["CPU", "Memory", "Network", "Latency"].map((metric) => (
            <div
              key={metric}
              className="bg-cortex-surface p-4 rounded-xl border border-cortex-border"
            >
              <div className="text-xs text-cortex-muted mb-1">{metric}</div>
              <div className="text-2xl font-bold text-cortex-text">--</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
