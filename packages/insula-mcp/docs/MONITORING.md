# Monitoring and Alerting Guide

This guide provides comprehensive instructions for monitoring Insula MCP in production environments.

## Table of Contents

- [Overview](#overview)
- [Metrics](#metrics)
- [Prometheus Setup](#prometheus-setup)
- [Grafana Dashboards](#grafana-dashboards)
- [Alerting Rules](#alerting-rules)
- [Alert Channels](#alert-channels)
- [Troubleshooting](#troubleshooting)

## Overview

Insula MCP exposes Prometheus-compatible metrics for monitoring system health, performance, and usage. The monitoring stack includes:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Alertmanager** - Alert routing and notification

## Metrics

### Application Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `insula_mcp_requests_total` | Counter | Total HTTP requests by method, endpoint, status |
| `insula_mcp_request_duration_seconds` | Histogram | Request duration in seconds |
| `insula_mcp_active_sessions` | Gauge | Number of active diagnostic sessions |
| `insula_mcp_health_status` | Gauge | Health check status (1=healthy, 0=unhealthy) |

### LLM Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `insula_mcp_llm_backend_status` | Gauge | LLM backend status (1=ready, 0=unavailable) |
| `insula_mcp_llm_inference_duration_seconds` | Histogram | LLM inference duration |
| `insula_mcp_llm_tokens_processed_total` | Counter | Total tokens processed |
| `insula_mcp_llm_model_loaded` | Gauge | Currently loaded model (1=loaded, 0=unloaded) |

### Pattern Learning Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `insula_mcp_pattern_matches_total` | Counter | Total pattern matches |
| `insula_mcp_pattern_matching_duration_seconds` | Histogram | Pattern matching duration |
| `insula_mcp_pattern_storage_size_bytes` | Gauge | Pattern storage size in bytes |
| `insula_mcp_patterns_stored_total` | Counter | Total patterns stored |

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `insula_mcp_database_connection_status` | Gauge | Database connection status (1=connected, 0=disconnected) |
| `insula_mcp_database_query_duration_seconds` | Histogram | Database query duration |
| `insula_mcp_database_connections_active` | Gauge | Active database connections |
| `insula_mcp_database_pool_size` | Gauge | Database connection pool size |

### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `process_cpu_seconds_total` | Counter | Total CPU time consumed |
| `process_resident_memory_bytes` | Gauge | Resident memory size |
| `nodejs_heap_size_total_bytes` | Gauge | Total heap size |
| `nodejs_heap_size_used_bytes` | Gauge | Used heap size |
| `nodejs_eventloop_lag_seconds` | Gauge | Event loop lag |

## Prometheus Setup

### Installation

#### Using Helm

```bash
# Add Prometheus community Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus Operator
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
```

#### Manual Installation

```bash
# Apply Prometheus configuration
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/main/bundle.yaml

# Create namespace
kubectl create namespace monitoring

# Apply ServiceMonitor
kubectl apply -f packages/insula-mcp/kubernetes/monitoring/prometheus-servicemonitor.yaml

# Apply PrometheusRule
kubectl apply -f packages/insula-mcp/kubernetes/monitoring/prometheus-rules.yaml
```

### Configuration

Create a `prometheus.yml` configuration file:

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s
  external_labels:
    cluster: 'production'
    environment: 'prod'

scrape_configs:
  - job_name: 'insula-mcp'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - insula-mcp
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
        action: keep
        regex: insula-mcp
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: pod
      - source_labels: [__meta_kubernetes_namespace]
        target_label: namespace

rule_files:
  - '/etc/prometheus/rules/*.yaml'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

### Verify Metrics

```bash
# Port-forward Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Access Prometheus UI
open http://localhost:9090

# Query metrics
curl http://localhost:9090/api/v1/query?query=up{job="insula-mcp"}
```

## Grafana Dashboards

### Installation

```bash
# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set adminPassword='admin'

# Get admin password
kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode

# Port-forward Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
```

### Import Dashboard

1. Access Grafana at http://localhost:3000
2. Login with admin credentials
3. Navigate to Dashboards → Import
4. Upload `packages/insula-mcp/kubernetes/monitoring/grafana-dashboard.json`
5. Select Prometheus data source
6. Click Import

### Dashboard Panels

**Overview Dashboard** includes:

1. **Service Health** - Real-time service status
2. **Request Rate** - Requests per second by endpoint
3. **Error Rate** - Error rate over time
4. **Response Time** - p50, p95, p99 latencies
5. **Memory Usage** - Memory consumption per pod
6. **CPU Usage** - CPU utilization per pod
7. **LLM Inference Latency** - LLM backend performance
8. **Active Sessions** - Current diagnostic sessions
9. **Pattern Matches** - Pattern matching rate
10. **Database Performance** - Query latencies
11. **Storage Usage** - Disk usage by PVC

### Custom Dashboards

Create custom dashboards for specific use cases:

**LLM Performance Dashboard:**

```json
{
  "panels": [
    {
      "title": "LLM Backend Status",
      "targets": [{
        "expr": "insula_mcp_llm_backend_status"
      }]
    },
    {
      "title": "Inference Latency by Model",
      "targets": [{
        "expr": "histogram_quantile(0.95, rate(insula_mcp_llm_inference_duration_seconds_bucket[5m]))"
      }]
    },
    {
      "title": "Tokens Processed",
      "targets": [{
        "expr": "rate(insula_mcp_llm_tokens_processed_total[5m])"
      }]
    }
  ]
}
```

## Alerting Rules

### Alert Severity Levels

- **Critical** - Immediate action required (service down, data loss)
- **Warning** - Attention needed (high latency, resource usage)
- **Info** - Informational (storage growth, pattern updates)

### Key Alerts

#### Service Availability

```yaml
- alert: InsulaMCPDown
  expr: up{job="insula-mcp"} == 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Insula MCP instance is down"
```

#### Performance

```yaml
- alert: InsulaMCPHighResponseTime
  expr: histogram_quantile(0.95, rate(insula_mcp_request_duration_seconds_bucket[5m])) > 2
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "High response time detected"
```

#### Resource Usage

```yaml
- alert: InsulaMCPHighMemoryUsage
  expr: (container_memory_working_set_bytes / container_spec_memory_limit_bytes) > 0.85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage"
```

### Alert Configuration

Apply alerting rules:

```bash
kubectl apply -f packages/insula-mcp/kubernetes/monitoring/prometheus-rules.yaml
```

Verify rules are loaded:

```bash
# Check PrometheusRule status
kubectl get prometheusrule -n insula-mcp

# View active alerts
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
open http://localhost:9090/alerts
```

## Alert Channels

### Slack Integration

```yaml
# alertmanager-config.yaml
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#insula-mcp-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack-notifications'
  routes:
    - match:
        severity: critical
      receiver: 'slack-notifications'
      continue: true
```

### PagerDuty Integration

```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: '{{ .GroupLabels.alertname }}: {{ .Annotations.summary }}'

route:
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
```

### Email Integration

```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'ops-team@example.com'
        from: 'alertmanager@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alertmanager@example.com'
        auth_password: 'password'
        headers:
          Subject: '[{{ .Status }}] {{ .GroupLabels.alertname }}'
```

### Apply Alertmanager Configuration

```bash
kubectl create secret generic alertmanager-config \
  --from-file=alertmanager.yaml=alertmanager-config.yaml \
  -n monitoring

kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: alertmanager
  namespace: monitoring
spec:
  ports:
    - port: 9093
      targetPort: 9093
  selector:
    app: alertmanager
EOF
```

## Troubleshooting

### Metrics Not Appearing

**Check ServiceMonitor:**

```bash
kubectl get servicemonitor -n insula-mcp
kubectl describe servicemonitor insula-mcp -n insula-mcp
```

**Check Prometheus Targets:**

```bash
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
# Navigate to http://localhost:9090/targets
```

**Check Pod Labels:**

```bash
kubectl get pods -n insula-mcp --show-labels
```

### Alerts Not Firing

**Check PrometheusRule:**

```bash
kubectl get prometheusrule -n insula-mcp
kubectl describe prometheusrule insula-mcp-alerts -n insula-mcp
```

**Check Alert Status:**

```bash
# View active alerts in Prometheus
open http://localhost:9090/alerts

# Check Alertmanager
kubectl port-forward -n monitoring svc/alertmanager-operated 9093:9093
open http://localhost:9093
```

**Verify Alert Expression:**

```bash
# Test alert query in Prometheus
curl 'http://localhost:9090/api/v1/query?query=up{job="insula-mcp"}==0'
```

### High Cardinality Issues

**Identify High Cardinality Metrics:**

```bash
# Query metric cardinality
curl 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data | length'

# Find metrics with most series
curl 'http://localhost:9090/api/v1/query?query=topk(10,count by (__name__)({__name__=~".+"}))'
```

**Reduce Cardinality:**

```yaml
# Add metric relabeling in ServiceMonitor
metricRelabelings:
  - sourceLabels: [__name__]
    regex: 'high_cardinality_metric_.*'
    action: drop
```

### Dashboard Not Loading

**Check Data Source:**

```bash
# Verify Prometheus data source in Grafana
# Settings → Data Sources → Prometheus
# Test connection
```

**Check Query Syntax:**

```bash
# Test query in Prometheus
curl 'http://localhost:9090/api/v1/query?query=YOUR_QUERY'
```

**Check Time Range:**

```bash
# Ensure time range includes data
# Adjust dashboard time picker
```

## Best Practices

### Metric Naming

- Use consistent naming: `insula_mcp_<component>_<metric>_<unit>`
- Include units in metric names: `_seconds`, `_bytes`, `_total`
- Use labels for dimensions, not metric names

### Alert Design

- Set appropriate thresholds based on SLOs
- Use `for` clause to avoid flapping alerts
- Include actionable information in annotations
- Test alerts in staging before production

### Dashboard Organization

- Group related metrics in panels
- Use consistent color schemes
- Add annotations for deployments and incidents
- Create separate dashboards for different audiences

### Performance

- Use recording rules for expensive queries
- Limit metric retention based on needs
- Use downsampling for long-term storage
- Monitor Prometheus resource usage

## Support

For additional help:

- Documentation: https://brainwav.dev/docs/insula-mcp/monitoring
- GitHub Issues: https://github.com/brainwav/insula-mcp/issues
- Community: https://discord.gg/brainwav
