/**
 * Simplified inline widget with progressive disclosure
 * Conforms to Apps SDK inline mode guidelines
 */

import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { requestDisplayMode } from "../hooks/useOpenAi.js";
import { useTelemetry } from "../lib/telemetry.js";
import { ErrorState } from "./ErrorState.js";
import { LoadingSpinner } from "./LoadingState.js";
import { useToolCall } from "../hooks/useToolCall.js";
import type { HealthStatus } from "../../types/index.js";

export function InlineWidget() {
  const intl = useIntl();
  const navigate = useNavigate();
  const track = useTelemetry();
  const {
    data: health,
    loading,
    error,
    retry,
  } = useToolCall<HealthStatus>("get_health");

  const handleViewDashboard = async () => {
    track("view_dashboard_clicked", { source: "inline_widget" });
    try {
      await requestDisplayMode("fullscreen");
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to request fullscreen:", err);
      // Fallback: navigate anyway
      navigate("/dashboard");
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-cortex-bg rounded-lg border border-cortex-border">
        <ErrorState
          title={intl.formatMessage({ id: "state.error" })}
          message={error.message}
          onRetry={retry}
        />
      </div>
    );
  }

  const statusIcon =
    health?.status === "healthy" ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : health?.status === "degraded" ? (
      <AlertTriangle className="w-4 h-4 text-yellow-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );

  const statusColor =
    health?.status === "healthy"
      ? "success"
      : health?.status === "degraded"
        ? "warning"
        : "danger";

  return (
    <div className="p-4 bg-cortex-bg rounded-lg border border-cortex-border shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-cortex-accent" />
        <h2 className="text-lg font-semibold text-cortex-text">
          <FormattedMessage id="dashboard.title" />
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size={32} />
        </div>
      ) : (
        <>
          {/* Status */}
          <div className="flex items-center gap-2 mb-4">
            {statusIcon}
            <Badge color={statusColor}>
              <FormattedMessage
                id={`health.status.${health?.status || "unhealthy"}`}
              />
            </Badge>
            {health?.uptimeFormatted && (
              <span className="text-sm text-cortex-muted">
                ↑ {health.uptimeFormatted}
              </span>
            )}
          </div>

          {/* Quick Stats */}
          <div className="space-y-2 mb-4 text-sm">
            {health?.components && (
              <div className="flex items-center gap-2 text-cortex-muted">
                <span>
                  {
                    health.components.filter((c) => c.status === "healthy")
                      .length
                  }{" "}
                  / {health.components.length} components healthy
                </span>
              </div>
            )}
            {health?.version && (
              <div className="text-cortex-muted">Version {health.version}</div>
            )}
          </div>

          {/* Action */}
          <Button
            onClick={handleViewDashboard}
            color="primary"
            className="w-full"
          >
            <FormattedMessage id="action.viewDashboard" />
          </Button>
        </>
      )}
    </div>
  );
}
