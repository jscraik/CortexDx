#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG'
The agent-toolkit package is no longer vendored inside CortexDx.
Use the copy that lives in the Cortex-OS repository (~/.Cortex-OS/packages/agent-toolkit)
or depend on the published @cortex-os/agent-toolkit package.

This script is retained as a guard so it is obvious when the old workflow is invoked.
MSG

exit 1
