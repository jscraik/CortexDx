/**
 * Traces tab - Distributed traces
 */

import { FormattedMessage } from 'react-intl';

export function TracesTab() {
  return (
    <div className="space-y-6 max-w-6xl">
      <h2 className="text-lg font-semibold text-cortex-text">
        <FormattedMessage id="traces.title" />
      </h2>
      <div className="bg-cortex-surface p-6 rounded-xl border border-cortex-border">
        <p className="text-cortex-muted">Traces implementation coming soon...</p>
      </div>
    </div>
  );
}
