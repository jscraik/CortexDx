# Deployment Guide

Complete guide for deploying CortexDx in production environments across all licensing tiers. This guide covers Docker, Docker Compose, and Kubernetes deployments with production-ready configurations, security best practices, monitoring, and operational procedures.

## Licensing Tiers

### Community Edition (Free)

**Features**:

- Basic diagnostic tools
- Limited LLM backend support
- Core MCP validation
- Open source plugins only

**Deployment**: Docker, Docker Compose, Kubernetes

### Professional Edition

**Features**:

- Advanced diagnostic plugins
- All LLM backend support
- Academic validation tools
- Priority support
- Commercial plugin access

**Deployment**: Docker, Docker Compose, Kubernetes
**Requirements**: Valid license key

### Enterprise Edition

**Features**:

- Full feature access
- Auth0 integration
- Custom plugin development
- On-premises deployment
- SLA guarantees
- Advanced usage analytics

**Deployment**: Kubernetes (recommended), Docker Compose
**Requirements**: Valid license key, Auth0 configuration

## Docker Deployment

### Quick Start

```bash
# Pull the image
docker pull brainwav/cortexdx:latest

# Run Community Edition
docker run -d \
  --name cortexdx \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e CORTEXDX_MCP_TIER=community \
  brainwav/cortexdx:latest

# Run Professional Edition
docker run -d \
  --name cortexdx-pro \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e CORTEXDX_MCP_TIER=professional \
  -e CORTEXDX_MCP_LICENSE_KEY=your-license-key \
  -v cortexdx-data:/app/data \
  -v cortexdx-models:/app/models \
  brainwav/cortexdx:latest

# Run Enterprise Edition
docker run -d \
  --name cortexdx-enterprise \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e CORTEXDX_MCP_TIER=enterprise \
  -e CORTEXDX_MCP_LICENSE_KEY=your-license-key \
  -e AUTH0_DOMAIN=your-domain.auth0.com \
  -e AUTH0_CLIENT_ID=your-client-id \
  -e AUTH0_CLIENT_SECRET=your-client-secret \
  -v cortexdx-data:/app/data \
  -v cortexdx-models:/app/models \
  brainwav/cortexdx:latest
```

### Building from Source

```bash
# Clone repository
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx

# Build Docker image with build args
docker build \
  --build-arg NODE_VERSION=20.11.1 \
  --build-arg PNPM_VERSION=9.12.2 \
  -t cortexdx:local \
  -f packages/cortexdx/Dockerfile .

# Run with production settings
docker run -d \
  --name cortexdx-local \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e CORTEXDX_MCP_TIER=community \
  --restart unless-stopped \
  --memory="512m" \
  --cpus="0.5" \
  cortexdx:local
```

### Production Docker Best Practices

```bash
# Use multi-stage builds for smaller images
# Enable BuildKit for better performance
export DOCKER_BUILDKIT=1

# Build with cache optimization
docker build \
  --cache-from brainwav/cortexdx:latest \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t cortexdx:production \
  -f packages/cortexdx/Dockerfile .

# Security scanning
docker scout cves cortexdx:production
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image cortexdx:production

# Resource limits and security
docker run -d \
  --name cortexdx-secure \
  -p 3000:3000 \
  --user 1001:1001 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \
  --security-opt no-new-privileges:true \
  --restart unless-stopped \
  --memory="1g" \
  --memory-swap="1g" \
  --cpus="1.0" \
  --pids-limit 100 \
  -v cortexdx-data:/app/data:rw \
  -v cortexdx-logs:/app/logs:rw \
  cortexdx:production
```

## Docker Compose Deployment

### Setup

1. **Create environment file** (`.env`):

```env
# License Configuration
CORTEXDX_LICENSE_KEY=your-license-key-here

# Auth0 Configuration (Enterprise only)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret

# Database Configuration (Enterprise only)
POSTGRES_PASSWORD=secure-password-here

# Observability (Enterprise only)
OTEL_ENDPOINT=http://otel-collector:4318
```

2. **Start services**:

```bash
# Community Edition
docker-compose up -d cortexdx-community

# Professional Edition (includes Ollama)
docker-compose up -d cortexdx-professional ollama

# Enterprise Edition (full stack)
docker-compose up -d cortexdx-enterprise ollama postgres redis
```

3. **Verify deployment**:

```bash
# Check health
curl http://localhost:3000/health

# View logs
docker-compose logs -f cortexdx-professional

# Check status
docker-compose ps
```

### Scaling

```bash
# Scale Professional Edition
docker-compose up -d --scale cortexdx-professional=3

# Scale Enterprise Edition
docker-compose up -d --scale cortexdx-enterprise=5
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3.x (optional)
- cert-manager (for TLS)
- Ingress controller (nginx recommended)

### Quick Deploy

```bash
# Apply all configurations
kubectl apply -f packages/cortexdx/kubernetes/deployment.yaml

# Verify deployment
kubectl get pods -n cortexdx
kubectl get services -n cortexdx

# Check logs
kubectl logs -n cortexdx -l app=cortexdx --tail=100
```

### Configuration

1. **Update secrets**:

```bash
# Create secrets file
cat <<EOF > secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cortexdx-secrets
  namespace: cortexdx
type: Opaque
stringData:
  license-key: "YOUR_LICENSE_KEY"
  auth0-domain: "your-domain.auth0.com"
  auth0-client-id: "YOUR_CLIENT_ID"
  auth0-client-secret: "YOUR_CLIENT_SECRET"
  postgres-password: "SECURE_PASSWORD"
EOF

# Apply secrets
kubectl apply -f secrets.yaml
```

2. **Configure ingress**:

```bash
# Update ingress host
kubectl edit ingress cortexdx-ingress -n cortexdx

# Update with your domain
# spec:
#   rules:
#   - host: cortexdx.yourdomain.com
```

3. **Configure storage**:

```bash
# For cloud providers, update storage class
kubectl edit pvc cortexdx-data-pvc -n cortexdx

# AWS: gp3
# GCP: pd-ssd
# Azure: managed-premium
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment cortexdx-enterprise -n cortexdx --replicas=10

# Auto-scaling is configured via HPA
kubectl get hpa -n cortexdx

# Update HPA
kubectl edit hpa cortexdx-enterprise-hpa -n cortexdx
```

### Monitoring

```bash
# Check pod status
kubectl get pods -n cortexdx -w

# View logs
kubectl logs -n cortexdx -l app=cortexdx -f

# Check resource usage
kubectl top pods -n cortexdx
kubectl top nodes

# Describe deployment
kubectl describe deployment cortexdx-enterprise -n cortexdx
```

## Production Deployment Best Practices

### Pre-Deployment Checklist

#### Infrastructure Requirements

- [ ] **Compute Resources**: Verify CPU, memory, and storage requirements
- [ ] **Network**: Configure load balancers, firewalls, and DNS
- [ ] **Security**: Set up TLS certificates, secrets management, and access controls
- [ ] **Monitoring**: Deploy observability stack (Prometheus, Grafana, AlertManager)
- [ ] **Backup**: Configure automated backup and disaster recovery procedures

#### Configuration Validation

```bash
# Validate environment configuration
./scripts/validate-config.sh production

# Test database connectivity
./scripts/test-db-connection.sh

# Verify LLM backend availability
./scripts/test-llm-backend.sh

# Check resource limits
./scripts/check-resources.sh
```

#### Security Hardening

```bash
# Container security scanning
docker scout cves brainwav/cortexdx:latest
trivy image brainwav/cortexdx:latest

# Kubernetes security policies
kubectl apply -f security/pod-security-policy.yaml
kubectl apply -f security/network-policy.yaml
kubectl apply -f security/rbac.yaml

# Secrets rotation
./scripts/rotate-secrets.sh --dry-run
```

### Deployment Strategies

#### Blue-Green Deployment

```bash
# Deploy to green environment
kubectl apply -f k8s/green-deployment.yaml

# Validate green deployment
./scripts/validate-deployment.sh green

# Switch traffic to green
kubectl patch service cortexdx-service \
  -p '{"spec":{"selector":{"version":"green"}}}'

# Monitor and rollback if needed
kubectl patch service cortexdx-service \
  -p '{"spec":{"selector":{"version":"blue"}}}'
```

#### Canary Deployment

```yaml
# Istio canary configuration
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: cortexdx-canary
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: cortexdx-service
        subset: canary
  - route:
    - destination:
        host: cortexdx-service
        subset: stable
      weight: 90
    - destination:
        host: cortexdx-service
        subset: canary
      weight: 10
```

#### Rolling Updates

```bash
# Kubernetes rolling update
kubectl set image deployment/cortexdx-enterprise \
  cortexdx=brainwav/cortexdx:v1.2.0 \
  --record

# Monitor rollout progress
kubectl rollout status deployment/cortexdx-enterprise

# Configure rollout strategy
kubectl patch deployment cortexdx-enterprise -p '{
  "spec": {
    "strategy": {
      "type": "RollingUpdate",
      "rollingUpdate": {
        "maxUnavailable": "25%",
        "maxSurge": "25%"
      }
    }
  }
}'
```

### Load Balancing and High Availability

#### HAProxy Configuration

```bash
# /etc/haproxy/haproxy.cfg
global
    daemon
    maxconn 4096
    log stdout local0

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog

frontend cortexdx_mcp_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/cortexdx.pem
    redirect scheme https if !{ ssl_fc }
    default_backend cortexdx_mcp_backend

backend cortexdx_mcp_backend
    balance roundrobin
    option httpchk GET /health
    http-check expect status 200
    server app1 10.0.1.10:3000 check
    server app2 10.0.1.11:3000 check
    server app3 10.0.1.12:3000 check
```

#### NGINX Configuration

```nginx
# /etc/nginx/sites-available/cortexdx
upstream cortexdx_mcp {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name cortexdx.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cortexdx.yourdomain.com;

    ssl_certificate /etc/ssl/certs/cortexdx.crt;
    ssl_certificate_key /etc/ssl/private/cortexdx.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    location / {
        proxy_pass http://cortexdx_mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check bypass
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://cortexdx_mcp;
        access_log off;
    }
}
```

### Performance Optimization

#### Application Tuning

```bash
# Node.js performance tuning
export NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
export UV_THREADPOOL_SIZE=8

# Enable clustering
export CORTEXDX_MCP_WORKERS=4
export CORTEXDX_MCP_CLUSTER_MODE=true

# Memory optimization
export CORTEXDX_MCP_CACHE_SIZE=256
export CORTEXDX_MCP_MAX_CONCURRENT_REQUESTS=200
```

#### Database Optimization

```sql
-- PostgreSQL performance tuning
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
SELECT pg_reload_conf();

-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_diagnostics_created_at ON diagnostics(created_at);
CREATE INDEX CONCURRENTLY idx_findings_severity ON findings(severity);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);
```

#### Caching Strategy

```yaml
# Redis configuration for caching
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
data:
  redis.conf: |
    maxmemory 512mb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    save 60 10000
    tcp-keepalive 300
    timeout 0
```

## Production Configuration

### Environment Variables

#### Core Configuration

**Required**:

- `NODE_ENV`: Set to `production` for production deployments
- `CORTEXDX_MCP_TIER`: `community`, `professional`, or `enterprise`
- `CORTEXDX_MCP_LICENSE_KEY`: License key (Professional/Enterprise only)

**Application Settings**:

- `CORTEXDX_MCP_LOG_LEVEL`: `debug`, `info`, `warn`, `error` (default: `info`)
- `CORTEXDX_MCP_PORT`: Application port (default: `3000`)
- `CORTEXDX_MCP_HOST`: Bind address (default: `0.0.0.0`)
- `CORTEXDX_MCP_WORKERS`: Number of worker processes (default: CPU cores)
- `CORTEXDX_MCP_TIMEOUT`: Request timeout in milliseconds (default: `30000`)

#### LLM Backend Configuration

- `CORTEXDX_MCP_LLM_BACKEND`: `ollama` (default: `ollama`)
- `OLLAMA_HOST`: Ollama endpoint (default: `http://localhost:11434`)
- `OLLAMA_TIMEOUT`: Ollama request timeout (default: `60000`)

> **Note:** Alternate local backends have been removed. Deployments must route all LLM traffic through Ollama.

#### Authentication & Security (Enterprise)

- `AUTH0_DOMAIN`: Auth0 domain (e.g., `your-domain.auth0.com`)
- `AUTH0_CLIENT_ID`: Auth0 application client ID
- `AUTH0_CLIENT_SECRET`: Auth0 application client secret
- `AUTH0_AUDIENCE`: Auth0 API audience identifier
- `JWT_SECRET`: JWT signing secret (generate with `openssl rand -hex 32`)
- `SESSION_SECRET`: Session encryption secret
- `CORS_ORIGINS`: Comma-separated list of allowed origins

#### Database Configuration (Enterprise)

- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_POOL_SIZE`: Connection pool size (default: `10`)
- `DATABASE_TIMEOUT`: Query timeout in milliseconds (default: `5000`)
- `REDIS_URL`: Redis connection string for caching
- `REDIS_TTL`: Cache TTL in seconds (default: `3600`)

#### Observability & Monitoring

- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector endpoint
- `OTEL_SERVICE_NAME`: Service name for tracing (default: `cortexdx`)
- `OTEL_RESOURCE_ATTRIBUTES`: Additional resource attributes
- `METRICS_ENABLED`: Enable Prometheus metrics (default: `true`)
- `METRICS_PORT`: Metrics endpoint port (default: `9090`)
- `HEALTH_CHECK_INTERVAL`: Health check interval in seconds (default: `30`)

#### Storage & Persistence

- `DATA_DIR`: Data directory path (default: `/app/data`)
- `LOGS_DIR`: Logs directory path (default: `/app/logs`)
- `MODELS_DIR`: Models directory path (default: `/app/models`)
- `BACKUP_ENABLED`: Enable automatic backups (default: `false`)
- `BACKUP_SCHEDULE`: Cron schedule for backups (default: `0 2 * * *`)
- `BACKUP_RETENTION`: Backup retention days (default: `7`)

#### Performance Tuning

- `NODE_OPTIONS`: Node.js runtime options (e.g., `--max-old-space-size=2048`)
- `UV_THREADPOOL_SIZE`: libuv thread pool size (default: `4`)
- `CACHE_SIZE`: In-memory cache size in MB (default: `128`)
- `MAX_CONCURRENT_REQUESTS`: Maximum concurrent requests (default: `100`)

#### Development & Debug

- `DEBUG`: Debug namespaces (e.g., `cortexdx:*`)
- `PROFILING_ENABLED`: Enable CPU profiling (default: `false`)
- `MEMORY_MONITORING`: Enable memory monitoring (default: `false`)
- `SLOW_QUERY_THRESHOLD`: Log slow queries over N ms (default: `1000`)

### Resource Requirements

**Community Edition**:

- CPU: 250m (request), 500m (limit)
- Memory: 256Mi (request), 512Mi (limit)
- Storage: 5Gi

**Professional Edition**:

- CPU: 500m (request), 1000m (limit)
- Memory: 512Mi (request), 1Gi (limit)
- Storage: 20Gi (includes models)

**Enterprise Edition**:

- CPU: 1000m (request), 2000m (limit)
- Memory: 1Gi (request), 2Gi (limit)
- Storage: 50Gi (includes models and data)

### Persistent Storage

**Data Directory** (`/app/data`):

- Conversation history
- User preferences
- Cache files

**Logs Directory** (`/app/logs`):

- Application logs
- Audit logs
- Error logs

**Models Directory** (`/app/models`):

- LLM models
- Model cache
- Quantized models

### Backup and Recovery

#### Backup

```bash
# Docker volumes
docker run --rm \
  -v cortexdx-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/cortexdx-data-backup.tar.gz /data

# Kubernetes PVCs
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  tar czf - /app/data | gzip > cortexdx-data-backup.tar.gz
```

#### Recovery

```bash
# Docker volumes
docker run --rm \
  -v cortexdx-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/cortexdx-data-backup.tar.gz -C /

# Kubernetes PVCs
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  tar xzf - -C /app/data < cortexdx-data-backup.tar.gz
```

#### Automated Backups

```bash
# Cron job for daily backups
0 2 * * * /usr/local/bin/backup-cortexdx.sh

# backup-cortexdx.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  tar czf - /app/data | \
  aws s3 cp - s3://backups/cortexdx-$DATE.tar.gz
```

## Monitoring and Logging

### Health Checks

#### Basic Health Endpoint

```bash
# HTTP health endpoint
curl http://localhost:3000/health

# Detailed health check with authentication
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/health?detailed=true

# Response format
{
  "status": "healthy",
  "version": "0.1.0",
  "tier": "enterprise",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "llm": {
      "status": "healthy",
      "backend": "ollama",
      "models": ["llama2", "codellama"],
      "response_time": 150
    },
    "database": {
      "status": "healthy",
      "connections": 8,
      "response_time": 5
    },
    "cache": {
      "status": "healthy",
      "hit_rate": 0.85,
      "memory_usage": "45%"
    },
    "storage": {
      "status": "healthy",
      "disk_usage": "23%",
      "available_space": "45GB"
    }
  }
}
```

#### Advanced Health Monitoring

```bash
# Kubernetes health probes
kubectl get pods -n cortexdx -o wide

# Custom health check script
#!/bin/bash
HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/health.json $HEALTH_URL)

if [ "$RESPONSE" = "200" ]; then
  STATUS=$(jq -r '.status' /tmp/health.json)
  if [ "$STATUS" = "healthy" ]; then
    echo "✅ Service is healthy"
    exit 0
  fi
fi

echo "❌ Service is unhealthy"
exit 1
```

### Comprehensive Logging

#### Structured Logging Configuration

```bash
# Environment variables for logging
export CORTEXDX_MCP_LOG_LEVEL=info
export CORTEXDX_MCP_LOG_FORMAT=json
export CORTEXDX_MCP_LOG_DESTINATION=stdout
export CORTEXDX_MCP_AUDIT_ENABLED=true
```

#### Docker Logging

```bash
# Configure Docker logging driver
docker run -d \
  --name cortexdx \
  --log-driver=json-file \
  --log-opt max-size=100m \
  --log-opt max-file=5 \
  --log-opt compress=true \
  brainwav/cortexdx:latest

# View logs with timestamps
docker logs -f --timestamps cortexdx

# Export logs with rotation
docker logs --since="2024-01-01T00:00:00" \
           --until="2024-01-02T00:00:00" \
           cortexdx > cortexdx-$(date +%Y%m%d).log

# Centralized logging with Fluentd
docker run -d \
  --log-driver=fluentd \
  --log-opt fluentd-address=fluentd:24224 \
  --log-opt tag="cortexdx.{{.Name}}" \
  brainwav/cortexdx:latest
```

#### Kubernetes Logging

```bash
# View logs across all pods
kubectl logs -n cortexdx -l app=cortexdx -f --tail=100

# Export logs with filtering
kubectl logs -n cortexdx deployment/cortexdx-enterprise \
  --since=1h --timestamps > cortexdx-$(date +%Y%m%d-%H%M).log

# Log aggregation with ELK stack
kubectl apply -f - <<EOF
apiVersion: logging.coreos.com/v1
kind: ClusterLogForwarder
metadata:
  name: cortexdx-logs
spec:
  outputs:
  - name: elasticsearch
    type: elasticsearch
    url: http://elasticsearch:9200
  pipelines:
  - name: cortexdx-pipeline
    inputRefs:
    - application
    filterRefs:
    - cortexdx-filter
    outputRefs:
    - elasticsearch
EOF
```

#### Log Analysis and Monitoring

```bash
# Real-time log analysis with jq
kubectl logs -n cortexdx -l app=cortexdx -f | \
  jq 'select(.level == "error" or .level == "warn")'

# Performance monitoring from logs
kubectl logs -n cortexdx -l app=cortexdx --tail=1000 | \
  jq -r 'select(.response_time) | .response_time' | \
  awk '{sum+=$1; count++} END {print "Avg response time:", sum/count "ms"}'

# Error rate calculation
kubectl logs -n cortexdx -l app=cortexdx --since=1h | \
  jq -r '.level' | sort | uniq -c
```

### Metrics and Observability

#### Prometheus Metrics

```yaml
# Prometheus configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cortexdx'
    static_configs:
      - targets: ['cortexdx:9090']
    metrics_path: /metrics
    scrape_interval: 10s
    scrape_timeout: 5s

  - job_name: 'cortexdx-kubernetes'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['cortexdx']
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

#### Key Performance Metrics

```bash
# Application metrics
cortexdx_mcp_requests_total{method="POST",status="200"}
cortexdx_mcp_request_duration_seconds{quantile="0.95"}
cortexdx_mcp_active_connections
cortexdx_mcp_llm_inference_duration_seconds
cortexdx_mcp_plugin_execution_duration_seconds
cortexdx_mcp_cache_hit_ratio
cortexdx_mcp_database_connections_active

# System metrics
process_cpu_seconds_total
process_resident_memory_bytes
nodejs_heap_size_total_bytes
nodejs_heap_size_used_bytes
nodejs_gc_duration_seconds

# Business metrics
cortexdx_mcp_diagnostics_completed_total
cortexdx_mcp_findings_by_severity
cortexdx_mcp_license_usage_percentage
cortexdx_mcp_user_sessions_active
```

#### OpenTelemetry Integration

```yaml
# OpenTelemetry Collector configuration
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  resource:
    attributes:
      - key: service.name
        value: cortexdx
        action: upsert

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  logging:
    loglevel: debug

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [jaeger, logging]
    metrics:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [prometheus, logging]
```

#### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "CortexDx Production Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(cortexdx_mcp_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time P95",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(cortexdx_mcp_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(cortexdx_mcp_requests_total{status=~\"5..\"}[5m]) / rate(cortexdx_mcp_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

### Alerting and Notifications

#### Prometheus Alerting Rules

```yaml
groups:
- name: cortexdx-critical
  rules:
  - alert: CortexDxMCPDown
    expr: up{job="cortexdx"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "CortexDx service is down"
      description: "CortexDx has been down for more than 1 minute"

  - alert: HighErrorRate
    expr: rate(cortexdx_mcp_requests_total{status=~"5.."}[5m]) / rate(cortexdx_mcp_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }} over the last 5 minutes"

  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, rate(cortexdx_mcp_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow response time detected"
      description: "95th percentile response time is {{ $value }}s"

  - alert: HighMemoryUsage
    expr: process_resident_memory_bytes / 1024 / 1024 / 1024 > 1.5
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value | humanize }}GB"

  - alert: LLMBackendUnavailable
    expr: cortexdx_mcp_llm_backend_available == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "LLM backend unavailable"
      description: "LLM backend has been unavailable for more than 2 minutes"

- name: cortexdx-capacity
  rules:
  - alert: HighCPUUsage
    expr: rate(process_cpu_seconds_total[5m]) * 100 > 80
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage"
      description: "CPU usage is {{ $value | humanizePercentage }}"

  - alert: DatabaseConnectionsHigh
    expr: cortexdx_mcp_database_connections_active > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High database connection usage"
      description: "Database connections: {{ $value }}/100"

  - alert: DiskSpaceLow
    expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Low disk space"
      description: "Disk usage is {{ $value | humanizePercentage }}"
```

#### AlertManager Configuration

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourcompany.com'
  smtp_auth_username: 'alerts@yourcompany.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'critical-alerts'
  - match:
      severity: warning
    receiver: 'warning-alerts'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://slack-webhook-url'

- name: 'critical-alerts'
  email_configs:
  - to: 'oncall@yourcompany.com'
    subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      {{ end }}
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts-critical'
    title: 'Critical Alert: {{ .GroupLabels.alertname }}'

- name: 'warning-alerts'
  email_configs:
  - to: 'team@yourcompany.com'
    subject: 'WARNING: {{ .GroupLabels.alertname }}'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts-warning'
    title: 'Warning: {{ .GroupLabels.alertname }}'
```

## Security

### TLS/SSL

**Docker**:

```bash
docker run -d \
  -p 443:3000 \
  -v /path/to/certs:/certs \
  -e TLS_CERT=/certs/cert.pem \
  -e TLS_KEY=/certs/key.pem \
  brainwav/cortexdx:latest
```

**Kubernetes**:

```yaml
# TLS is handled by Ingress
# cert-manager automatically provisions certificates
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cortexdx-network-policy
  namespace: cortexdx
spec:
  podSelector:
    matchLabels:
      app: cortexdx
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 11434  # Ollama
    - protocol: TCP
      port: 5432   # PostgreSQL
```

### Secrets Management

**Kubernetes Secrets**:

```bash
# Create from file
kubectl create secret generic cortexdx-secrets \
  --from-file=license-key=./license.key \
  --from-file=auth0-config=./auth0.json \
  -n cortexdx

# Create from literal
kubectl create secret generic cortexdx-secrets \
  --from-literal=license-key=YOUR_KEY \
  -n cortexdx
```

**External Secrets** (recommended):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: cortexdx-secrets
  namespace: cortexdx
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: cortexdx-secrets
  data:
  - secretKey: license-key
    remoteRef:
      key: cortexdx/license-key
```

## Disaster Recovery and Business Continuity

### Backup Strategies

#### Automated Backup System

```bash
#!/bin/bash
# /usr/local/bin/backup-cortexdx.sh

set -euo pipefail

BACKUP_DIR="/backups/cortexdx"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
pg_dump -h postgres -U cortexdx -d cortexdx_mcp | \
  gzip > "$BACKUP_DIR/database_$DATE.sql.gz"

# Application data backup
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  tar czf - /app/data | \
  aws s3 cp - "s3://cortexdx-backups/data_$DATE.tar.gz"

# Configuration backup
kubectl get configmap,secret -n cortexdx -o yaml | \
  gzip > "$BACKUP_DIR/config_$DATE.yaml.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup integrity
gunzip -t "$BACKUP_DIR/database_$DATE.sql.gz"
echo "Backup completed successfully: $DATE"
```

#### Cross-Region Replication

```yaml
# PostgreSQL streaming replication
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cortexdx-postgres-cluster
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      
  bootstrap:
    initdb:
      database: cortexdx_mcp
      owner: cortexdx
      
  storage:
    size: 100Gi
    storageClass: fast-ssd
    
  monitoring:
    enabled: true
```

### Recovery Procedures

#### Point-in-Time Recovery

```bash
# Restore from specific backup
RESTORE_DATE="20240115_143000"

# Stop application
kubectl scale deployment cortexdx-enterprise --replicas=0

# Restore database
gunzip -c "/backups/cortexdx/database_$RESTORE_DATE.sql.gz" | \
  psql -h postgres -U cortexdx -d cortexdx_mcp

# Restore application data
aws s3 cp "s3://cortexdx-backups/data_$RESTORE_DATE.tar.gz" - | \
  kubectl exec -i -n cortexdx deployment/cortexdx-enterprise -- \
  tar xzf - -C /app

# Restart application
kubectl scale deployment cortexdx-enterprise --replicas=3

# Verify recovery
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl -f http://localhost:3000/health
```

#### Multi-Region Failover

```bash
# Automated failover script
#!/bin/bash
PRIMARY_REGION="us-east-1"
SECONDARY_REGION="us-west-2"
HEALTH_ENDPOINT="https://cortexdx.yourdomain.com/health"

# Check primary region health
if ! curl -f --max-time 10 "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
  echo "Primary region unhealthy, initiating failover..."
  
  # Update DNS to point to secondary region
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456789 \
    --change-batch file://failover-dns.json
  
  # Scale up secondary region
  kubectl --context="$SECONDARY_REGION" \
    scale deployment cortexdx-enterprise --replicas=5
  
  # Notify operations team
  curl -X POST "$SLACK_WEBHOOK" \
    -d '{"text":"🚨 Failover initiated to secondary region"}'
fi
```

### Operational Procedures

#### Maintenance Windows

```bash
# Planned maintenance procedure
#!/bin/bash

# 1. Notify users (30 minutes before)
curl -X POST "$NOTIFICATION_API" \
  -d '{"message":"Maintenance starting in 30 minutes"}'

# 2. Enable maintenance mode
kubectl patch configmap cortexdx-config \
  -p '{"data":{"MAINTENANCE_MODE":"true"}}'

# 3. Drain traffic gradually
for i in {5..1}; do
  kubectl scale deployment cortexdx-enterprise --replicas=$i
  sleep 60
done

# 4. Perform maintenance tasks
./scripts/database-maintenance.sh
./scripts/update-certificates.sh
./scripts/cleanup-logs.sh

# 5. Deploy updates
kubectl set image deployment/cortexdx-enterprise \
  cortexdx=brainwav/cortexdx:latest

# 6. Scale back up
kubectl scale deployment cortexdx-enterprise --replicas=5

# 7. Disable maintenance mode
kubectl patch configmap cortexdx-config \
  -p '{"data":{"MAINTENANCE_MODE":"false"}}'

# 8. Verify health
./scripts/post-maintenance-checks.sh
```

#### Capacity Planning

```bash
# Resource usage analysis
#!/bin/bash

echo "=== CPU Usage Analysis ==="
kubectl top nodes | awk 'NR>1 {cpu+=$3} END {print "Average CPU:", cpu/NR "%"}'

echo "=== Memory Usage Analysis ==="
kubectl top pods -n cortexdx --sort-by=memory

echo "=== Storage Usage Analysis ==="
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  df -h /app/data /app/logs /app/models

echo "=== Network Usage Analysis ==="
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  ss -tuln | grep :3000

# Generate capacity report
cat > capacity-report.json <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "cpu_usage": $(kubectl top nodes --no-headers | awk '{sum+=$3} END {print sum/NR}'),
  "memory_usage": $(kubectl top nodes --no-headers | awk '{sum+=$5} END {print sum/NR}'),
  "pod_count": $(kubectl get pods -n cortexdx --no-headers | wc -l),
  "storage_usage": $(kubectl exec -n cortexdx deployment/cortexdx-enterprise -- df /app/data | awk 'NR==2 {print $5}' | tr -d '%')
}
EOF
```

## Troubleshooting

### Common Issues and Solutions

#### Application Startup Issues

**Container won't start**:

```bash
# Check container logs for startup errors
docker logs --tail=50 cortexdx
kubectl logs -n cortexdx deployment/cortexdx-enterprise --tail=50

# Check container events and status
kubectl describe pod -n cortexdx <pod-name>
kubectl get events -n cortexdx --sort-by='.lastTimestamp'

# Verify resource constraints
kubectl describe node <node-name>
docker stats cortexdx

# Check image pull issues
kubectl describe pod -n cortexdx <pod-name> | grep -A 10 "Events:"

# Debug with interactive shell
kubectl run debug-pod --rm -i --tty \
  --image=brainwav/cortexdx:latest \
  --restart=Never -- /bin/sh
```

**Configuration Issues**:

```bash
# Validate environment variables
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- env | sort

# Check configuration file syntax
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node -e "console.log(JSON.stringify(process.env, null, 2))"

# Test configuration loading
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node -e "require('./dist/config').validate()"
```

#### Health Check and Connectivity Issues

**Health check failing**:

```bash
# Test health endpoint directly
curl -v http://localhost:3000/health
curl -v -H "Accept: application/json" http://localhost:3000/health?detailed=true

# Check port binding and network
netstat -tulpn | grep 3000
ss -tulpn | grep 3000

# Test from within cluster
kubectl run curl-test --rm -i --tty \
  --image=curlimages/curl:latest \
  --restart=Never -- \
  curl -v http://cortexdx-service:80/health

# Check service and endpoint configuration
kubectl get svc,endpoints -n cortexdx
kubectl describe svc cortexdx-service -n cortexdx
```

**Network connectivity issues**:

```bash
# Test DNS resolution
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  nslookup ollama-service

# Check network policies
kubectl get networkpolicy -n cortexdx
kubectl describe networkpolicy -n cortexdx

# Test inter-service communication
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl -v http://ollama-service:11434/api/tags

# Check ingress configuration
kubectl get ingress -n cortexdx
kubectl describe ingress cortexdx-ingress -n cortexdx
```

#### LLM Backend Issues

**LLM not available**:

```bash
# Check Ollama service health
curl http://ollama:11434/api/tags
kubectl exec -n cortexdx deployment/ollama -- \
  curl http://localhost:11434/api/tags

# Verify Ollama models
kubectl exec -n cortexdx deployment/ollama -- \
  ollama list

# Check Ollama logs
kubectl logs -n cortexdx deployment/ollama --tail=100

# Test model loading
kubectl exec -n cortexdx deployment/ollama -- \
  ollama run llama2 "Hello, world!"

# Verify environment variables
docker exec cortexdx env | grep OLLAMA
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- env | grep OLLAMA

# Check resource allocation for GPU
kubectl describe node | grep -A 5 "Allocated resources"
nvidia-smi  # On GPU nodes
```

#### Database and Storage Issues

**Database connection problems**:

```bash
# Test database connectivity
kubectl exec -n cortexdx deployment/postgres -- \
  pg_isready -U cortexdx -d cortexdx_mcp

# Check database logs
kubectl logs -n cortexdx deployment/postgres --tail=100

# Test connection from application
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node -e "
    const { Client } = require('pg');
    const client = new Client(process.env.DATABASE_URL);
    client.connect().then(() => console.log('Connected')).catch(console.error);
  "

# Check connection pool status
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl http://localhost:3000/debug/db-pool
```

**Storage and persistence issues**:

```bash
# Check persistent volume status
kubectl get pv,pvc -n cortexdx
kubectl describe pvc cortexdx-data-pvc -n cortexdx

# Check disk space
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  df -h /app/data /app/logs /app/models

# Verify file permissions
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  ls -la /app/data /app/logs /app/models

# Check storage class and provisioner
kubectl get storageclass
kubectl describe storageclass standard
```

#### Performance and Resource Issues

**High memory usage**:

```bash
# Check memory usage patterns
kubectl top pods -n cortexdx --sort-by=memory
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node -e "console.log(process.memoryUsage())"

# Analyze heap dumps
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node --inspect=0.0.0.0:9229 dist/server.js &

# Check for memory leaks
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl http://localhost:3000/debug/memory

# Monitor garbage collection
kubectl logs -n cortexdx deployment/cortexdx-enterprise | \
  grep -i "gc\|memory"
```

**High CPU usage**:

```bash
# Check CPU usage patterns
kubectl top pods -n cortexdx --sort-by=cpu
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  top -p $(pgrep node)

# Profile CPU usage
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node --prof dist/server.js

# Check for CPU-intensive operations
kubectl logs -n cortexdx deployment/cortexdx-enterprise | \
  grep -i "slow\|timeout\|performance"
```

#### Authentication and Authorization Issues

**Auth0 integration problems** (Enterprise):

```bash
# Test Auth0 configuration
curl -X POST https://$AUTH0_DOMAIN/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'$AUTH0_CLIENT_ID'",
    "client_secret": "'$AUTH0_CLIENT_SECRET'",
    "audience": "'$AUTH0_AUDIENCE'",
    "grant_type": "client_credentials"
  }'

# Verify JWT token validation
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/protected

# Check Auth0 logs
kubectl logs -n cortexdx deployment/cortexdx-enterprise | \
  grep -i "auth\|jwt\|token"
```

#### Monitoring and Observability Issues

**Metrics not appearing**:

```bash
# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Verify metrics endpoint
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl http://localhost:9090/metrics

# Check OpenTelemetry configuration
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl http://localhost:3000/debug/otel

# Test trace export
kubectl logs -n cortexdx deployment/otel-collector
```

### Diagnostic Tools and Scripts

#### Health Check Script

```bash
#!/bin/bash
# comprehensive-health-check.sh

set -euo pipefail

NAMESPACE="cortexdx"
SERVICE_NAME="cortexdx-enterprise"

echo "🔍 Comprehensive Health Check for CortexDx"
echo "============================================="

# Check Kubernetes resources
echo "📋 Checking Kubernetes resources..."
kubectl get pods,svc,ingress -n $NAMESPACE
kubectl get pv,pvc -n $NAMESPACE

# Check pod health
echo "🏥 Checking pod health..."
kubectl get pods -n $NAMESPACE -o wide
kubectl top pods -n $NAMESPACE

# Check application health
echo "🌐 Checking application health..."
for pod in $(kubectl get pods -n $NAMESPACE -l app=cortexdx -o name); do
  echo "Testing $pod..."
  kubectl exec -n $NAMESPACE $pod -- curl -f http://localhost:3000/health || echo "❌ Health check failed for $pod"
done

# Check external dependencies
echo "🔗 Checking external dependencies..."
kubectl exec -n $NAMESPACE deployment/$SERVICE_NAME -- \
  curl -f http://ollama-service:11434/api/tags || echo "❌ Ollama unavailable"

kubectl exec -n $NAMESPACE deployment/postgres -- \
  pg_isready -U cortexdx -d cortexdx_mcp || echo "❌ Database unavailable"

# Check resource usage
echo "📊 Checking resource usage..."
kubectl top nodes
kubectl describe nodes | grep -A 5 "Allocated resources"

# Check recent events
echo "📰 Recent events..."
kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10

echo "✅ Health check completed"
```

#### Performance Analysis Script

```bash
#!/bin/bash
# performance-analysis.sh

NAMESPACE="cortexdx"
DURATION="5m"

echo "📈 Performance Analysis for CortexDx"
echo "======================================"

# CPU and Memory usage over time
echo "💻 Resource usage analysis..."
kubectl top pods -n $NAMESPACE --sort-by=cpu
kubectl top pods -n $NAMESPACE --sort-by=memory

# Application metrics
echo "📊 Application metrics..."
kubectl exec -n $NAMESPACE deployment/cortexdx-enterprise -- \
  curl -s http://localhost:9090/metrics | grep -E "(request_duration|error_rate|active_connections)"

# Database performance
echo "🗄️ Database performance..."
kubectl exec -n $NAMESPACE deployment/postgres -- \
  psql -U cortexdx -d cortexdx_mcp -c "
    SELECT query, calls, total_time, mean_time 
    FROM pg_stat_statements 
    ORDER BY total_time DESC 
    LIMIT 10;"

# Log analysis for errors
echo "📝 Error analysis..."
kubectl logs -n $NAMESPACE -l app=cortexdx --since=$DURATION | \
  grep -i error | tail -20

echo "✅ Performance analysis completed"
```

## Upgrade Procedures

### Pre-Upgrade Checklist

#### Preparation Steps

```bash
# 1. Backup current deployment
./scripts/backup-cortexdx.sh

# 2. Review release notes
curl -s https://api.github.com/repos/brainwav/cortexdx/releases/latest | \
  jq -r '.body'

# 3. Test upgrade in staging environment
kubectl apply -f k8s/staging/ --dry-run=client

# 4. Verify resource requirements
kubectl describe nodes | grep -A 5 "Allocated resources"

# 5. Check compatibility matrix
./scripts/check-compatibility.sh v1.2.0
```

#### Version Compatibility

| CortexDx | Node.js | Kubernetes | PostgreSQL | Redis |
|------------|---------|------------|------------|-------|
| v1.0.x     | 18.x    | 1.24+      | 13+        | 6+    |
| v1.1.x     | 20.x    | 1.25+      | 14+        | 7+    |
| v1.2.x     | 20.11+  | 1.26+      | 15+        | 7+    |

### Docker Upgrade

#### Standard Upgrade

```bash
# 1. Pull new image
docker pull brainwav/cortexdx:v1.2.0

# 2. Create backup
docker exec cortexdx tar czf - /app/data | \
  gzip > "backup-$(date +%Y%m%d).tar.gz"

# 3. Stop current container gracefully
docker kill -s SIGTERM cortexdx
sleep 30
docker stop cortexdx

# 4. Remove old container
docker rm cortexdx

# 5. Start new container with same configuration
docker run -d \
  --name cortexdx \
  --env-file .env \
  -v cortexdx-data:/app/data \
  -v cortexdx-logs:/app/logs \
  -p 3000:3000 \
  brainwav/cortexdx:v1.2.0

# 6. Verify upgrade
docker logs -f cortexdx
curl http://localhost:3000/health
```

#### Zero-Downtime Docker Upgrade

```bash
# 1. Start new container on different port
docker run -d \
  --name cortexdx-new \
  --env-file .env \
  -v cortexdx-data:/app/data \
  -v cortexdx-logs:/app/logs \
  -p 3001:3000 \
  brainwav/cortexdx:v1.2.0

# 2. Wait for new container to be ready
while ! curl -f http://localhost:3001/health; do
  echo "Waiting for new container..."
  sleep 5
done

# 3. Update load balancer to point to new container
# (Update your load balancer configuration)

# 4. Stop old container
docker stop cortexdx
docker rm cortexdx

# 5. Rename new container
docker rename cortexdx-new cortexdx

# 6. Update port mapping
docker stop cortexdx
docker run -d \
  --name cortexdx-final \
  --env-file .env \
  -v cortexdx-data:/app/data \
  -v cortexdx-logs:/app/logs \
  -p 3000:3000 \
  brainwav/cortexdx:v1.2.0
```

### Kubernetes Upgrade

#### Rolling Update Strategy

```bash
# 1. Update deployment with new image
kubectl set image deployment/cortexdx-enterprise \
  cortexdx=brainwav/cortexdx:v1.2.0 \
  -n cortexdx \
  --record

# 2. Monitor rollout progress
kubectl rollout status deployment/cortexdx-enterprise -n cortexdx -w

# 3. Verify pods are running new version
kubectl get pods -n cortexdx -o wide
kubectl describe pod -n cortexdx <pod-name> | grep Image

# 4. Test application functionality
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl -f http://localhost:3000/health

# 5. Check application logs
kubectl logs -n cortexdx -l app=cortexdx --tail=50
```

#### Blue-Green Deployment Upgrade

```yaml
# blue-green-upgrade.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: cortexdx-rollout
  namespace: cortexdx
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: cortexdx-active
      previewService: cortexdx-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: cortexdx-preview
      postPromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: cortexdx-active
  selector:
    matchLabels:
      app: cortexdx
  template:
    metadata:
      labels:
        app: cortexdx
    spec:
      containers:
      - name: cortexdx
        image: brainwav/cortexdx:v1.2.0
```

#### Canary Deployment Upgrade

```yaml
# canary-upgrade.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: cortexdx-canary
  namespace: cortexdx
spec:
  replicas: 10
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 5m}
      - setWeight: 25
      - pause: {duration: 10m}
      - setWeight: 50
      - pause: {duration: 15m}
      - setWeight: 75
      - pause: {duration: 10m}
      analysis:
        templates:
        - templateName: error-rate
        - templateName: response-time
        args:
        - name: service-name
          value: cortexdx-canary
  selector:
    matchLabels:
      app: cortexdx
  template:
    metadata:
      labels:
        app: cortexdx
    spec:
      containers:
      - name: cortexdx
        image: brainwav/cortexdx:v1.2.0
```

### Database Migration

#### Automated Migration

```bash
# 1. Create database backup
kubectl exec -n cortexdx deployment/postgres -- \
  pg_dump -U cortexdx cortexdx_mcp | \
  gzip > "db-backup-$(date +%Y%m%d).sql.gz"

# 2. Run database migrations
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  npm run migrate

# 3. Verify migration status
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  npm run migrate:status

# 4. Test database connectivity
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  node -e "require('./dist/db').testConnection()"
```

#### Manual Migration Steps

```sql
-- Example migration for v1.2.0
BEGIN;

-- Add new columns
ALTER TABLE diagnostics ADD COLUMN IF NOT EXISTS severity_score INTEGER;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS confidence_level DECIMAL(3,2);

-- Create new indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diagnostics_severity_score 
ON diagnostics(severity_score);

-- Update existing data
UPDATE diagnostics SET severity_score = 
  CASE 
    WHEN severity = 'critical' THEN 100
    WHEN severity = 'major' THEN 75
    WHEN severity = 'minor' THEN 50
    ELSE 25
  END
WHERE severity_score IS NULL;

-- Verify migration
SELECT COUNT(*) FROM diagnostics WHERE severity_score IS NOT NULL;

COMMIT;
```

### Rollback Procedures

#### Kubernetes Rollback

```bash
# 1. Check rollout history
kubectl rollout history deployment/cortexdx-enterprise -n cortexdx

# 2. Rollback to previous version
kubectl rollout undo deployment/cortexdx-enterprise -n cortexdx

# 3. Rollback to specific revision
kubectl rollout undo deployment/cortexdx-enterprise \
  --to-revision=2 -n cortexdx

# 4. Monitor rollback progress
kubectl rollout status deployment/cortexdx-enterprise -n cortexdx

# 5. Verify rollback
kubectl get pods -n cortexdx -o wide
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl -f http://localhost:3000/health
```

#### Database Rollback

```bash
# 1. Stop application to prevent data corruption
kubectl scale deployment cortexdx-enterprise --replicas=0 -n cortexdx

# 2. Restore database from backup
gunzip -c "db-backup-$(date +%Y%m%d).sql.gz" | \
  kubectl exec -i -n cortexdx deployment/postgres -- \
  psql -U cortexdx -d cortexdx_mcp

# 3. Restart application with previous version
kubectl set image deployment/cortexdx-enterprise \
  cortexdx=brainwav/cortexdx:v1.1.0 -n cortexdx

kubectl scale deployment cortexdx-enterprise --replicas=5 -n cortexdx

# 4. Verify rollback
kubectl exec -n cortexdx deployment/cortexdx-enterprise -- \
  curl -f http://localhost:3000/health
```

### Post-Upgrade Validation

#### Automated Testing

```bash
#!/bin/bash
# post-upgrade-validation.sh

set -euo pipefail

NAMESPACE="cortexdx"
SERVICE_URL="http://cortexdx-service"

echo "🧪 Post-Upgrade Validation"
echo "========================="

# 1. Health check
echo "🏥 Testing health endpoint..."
kubectl exec -n $NAMESPACE deployment/cortexdx-enterprise -- \
  curl -f $SERVICE_URL/health

# 2. API functionality
echo "🔧 Testing API endpoints..."
kubectl exec -n $NAMESPACE deployment/cortexdx-enterprise -- \
  curl -f -X POST $SERVICE_URL/api/diagnose \
  -H "Content-Type: application/json" \
  -d '{"target": "http://example.com"}'

# 3. Database connectivity
echo "🗄️ Testing database..."
kubectl exec -n $NAMESPACE deployment/cortexdx-enterprise -- \
  node -e "require('./dist/db').testConnection()"

# 4. LLM backend
echo "🤖 Testing LLM backend..."
kubectl exec -n $NAMESPACE deployment/cortexdx-enterprise -- \
  curl -f http://ollama-service:11434/api/tags

# 5. Performance test
echo "⚡ Performance test..."
kubectl exec -n $NAMESPACE deployment/cortexdx-enterprise -- \
  ab -n 100 -c 10 $SERVICE_URL/health

echo "✅ Validation completed successfully"
```

#### Manual Verification Steps

1. **Functional Testing**:
   - Test all major API endpoints
   - Verify diagnostic functionality
   - Check report generation
   - Test plugin execution

2. **Performance Testing**:
   - Monitor response times
   - Check resource usage
   - Verify throughput metrics
   - Test under load

3. **Integration Testing**:
   - Test LLM backend integration
   - Verify database operations
   - Check external service connectivity
   - Test authentication flows

4. **User Acceptance Testing**:
   - Test web interface (if applicable)
   - Verify CLI functionality
   - Check documentation accuracy
   - Test common user workflows

## Support

- **Documentation**: [docs/](./GETTING_STARTED.md)
- **GitHub Issues**: Report bugs and request features
- **Enterprise Support**: <support@brainwav.com>
- **Community**: GitHub Discussions

## License

Apache 2.0 - See LICENSE file for details
