# Waiver Template — network-guard-integration-spike

| Field | Value |
| --- | --- |
| waiver_id | network-guard-integration-spike |
| rule_id | network-guard-outbound-block |
| owner | FILL-ME (feature owner requesting live network access) |
| approver | FILL-ME (Maintainer/Constitution delegate) |
| expiry | YYYY-MM-DD (≤30 days from approval) |
| mitigations | FILL-ME (logs, synthetic fixtures, rollback plan) |
| env_flag | `ALLOW_TEST_NETWORK=1` |
| ci_job | `network-smoke` (workflow_dispatch) |

## Preconditions
- Default CI runs **MUST** keep `ALLOW_TEST_NETWORK` unset so socket and HTTP guards remain enforced.
- List every temporary host added via `TEST_NETWORK_EXTRA_HOSTS` and justify why localhost fixtures were insufficient.
- Attach evidence that synthetic fixtures were exhausted and why live network access is required.
- Capture logs with `{ "brand": "brAInwav", "component": "network-guard" }` while the waiver is active.
- Record teardown tasks to restore fixtures and remove the env flag after the spike.

## Usage
1. Submit this file updated with final metadata in the PR requesting the waiver.
2. Obtain Maintainer approval and merge alongside the change that sets `ALLOW_TEST_NETWORK=1` in the targeted job. Trigger the `network-smoke` workflow with the waiver ID as confirmation.
3. Remove the waiver, extra hosts, and env override before the expiry date; archive the file under `.cortexdx/waivers/archive/` afterward.
