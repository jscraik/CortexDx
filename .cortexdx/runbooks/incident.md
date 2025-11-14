# Incident Runbook

- Declare severity and comms channel
- Capture timeline and evidence
- Mitigate, then remediate
- Record post-incident in .cortexdx/audit

## North-Star Telemetry Alerts

- **Metrics**: emit `north_star_red_first_total`, `north_star_green_after_total`, and `north_star_latency_observed_total` from the shared logging helper. Track five-minute rates with Prometheus recording rules.
- **Alerting**: page when any rate falls to zero for 10 minutes while service traffic remains above baseline or when the green/red ratio exceeds 2:1, signalling skipped red-first runs. Trigger a warning when latency counters stop moving but request throughput stays normal.
- **Dashboards**: pin Grafana panels showing token emission rates, last waiver ID, and synthetic acceptance status. Annotate incidents and waivers for temporal context.
- **Runbook**:
  1. Confirm recent deployments affecting logging; roll back if instrumentation regressed.
  2. Run synthetic north-star acceptance to reseed `NORTH_STAR:RED_FIRST` and `...GREEN_AFTER` tokens.
  3. If a temporary bypass is unavoidable, file a waiver (per connector freshness policy) with expiry ≤24h and compensating controls.
  4. After recovery, update the incident timeline with manifest pointers to the restored logs, attach the JSON produced by `scripts/governance/backfill-log-evidence.ts --all --report reports/log-evidence-summary.json`, and include the `pnpm policy:validate --all` output.
