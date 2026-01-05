/**
 * Metrics tab - System metrics and charts
 */

import { FormattedMessage } from "react-intl";

export function MetricsTab() {
  return (
    <div className="space-y-6 max-w-6xl">
      <h2 className="text-lg font-semibold text-cortex-text">
        <FormattedMessage id="metrics.title" />
      </h2>
      <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border">
        <p className="text-cortex-muted">
          Metrics implementation coming soon...
        </p>
      </div>
    </div>
  );
}
