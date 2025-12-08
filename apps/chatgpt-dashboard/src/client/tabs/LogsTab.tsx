/**
 * Logs tab - System logs with filtering
 */

import { FormattedMessage } from 'react-intl';

export function LogsTab() {
  return (
    <div className="space-y-6 max-w-6xl">
      <h2 className="text-lg font-semibold text-cortex-text">
        <FormattedMessage id="logs.title" />
      </h2>
      <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border">
        <p className="text-cortex-muted">Logs implementation coming soon...</p>
      </div>
    </div>
  );
}
