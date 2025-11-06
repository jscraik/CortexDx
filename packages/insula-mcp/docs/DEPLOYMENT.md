# Deployment Guide

Complete guide for deploying Insula MCP in production environments across all licensing tiers.

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
docker pull brainwav/insula-mcp:latest

# Run Community Edition
docker run -d \
  --name insula-mcp \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e INSULA_MCP_TIER=community \
  brainwav/insula-mcp:latest

# Run Professional Edition
docker run -d \
  --name insula-mcp-pro \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e INSULA_MCP_TIER=professional \
  -e INSULA_MCP_LICENSE_KEY=your-license-key \
  -v insula-data:/app/data \
  -v insula-models:/app/models \
  brainwav/insula-mcp:latest

# Run Enterprise Edition
docker run -d \
  --name insula-mcp-enterprise \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e INSULA_MCP_TIER=enterprise \
  -e INSULA_MCP_LICENSE_KEY=your-license-key \
  -e AUTH0_DOMAIN=your-domain.auth0.com \
  -e AUTH0_CLIENT_ID=your-client-id \
  -e AUTH0_CLIENT_SECRET=your-client-secret \
  -v insula-data:/app/data \
  -v insula-models:/app/models \
  brainwav/insula-mcp:latest
```

### Building from Source

```bash
# Clone repository
git clone https://github.com/brainwav/insula-mcp.git
cd insula-mcp

# Build Docker image
docker build -t insula-mcp:local -f packages/insula-mcp/Dockerfile .

# Run
docker run -d -p 3000:3000 insula-mcp:local
```

## Docker Compose Deployment

### Setup

1. **Create environment file** (`.env`):

```env
# License Configuration
INSULA_LICENSE_KEY=your-license-key-here

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
docker-compose up -d insula-mcp-community

# Professional Edition (includes Ollama)
docker-compose up -d insula-mcp-professional ollama

# Enterprise Edition (full stack)
docker-compose up -d insula-mcp-enterprise ollama postgres redis
```

3. **Verify deployment**:

```bash
# Check health
curl http://localhost:3000/health

# View logs
docker-compose logs -f insula-mcp-professional

# Check status
docker-compose ps
```

### Scaling

```bash
# Scale Professional Edition
docker-compose up -d --scale insula-mcp-professional=3

# Scale Enterprise Edition
docker-compose up -d --scale insula-mcp-enterprise=5
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
kubectl apply -f packages/insula-mcp/kubernetes/deployment.yaml

# Verify deployment
kubectl get pods -n insula-mcp
kubectl get services -n insula-mcp

# Check logs
kubectl logs -n insula-mcp -l app=insula-mcp --tail=100
```

### Configuration

1. **Update secrets**:

```bash
# Create secrets file
cat <<EOF > secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: insula-mcp-secrets
  namespace: insula-mcp
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
kubectl edit ingress insula-mcp-ingress -n insula-mcp

# Update with your domain
# spec:
#   rules:
#   - host: insula-mcp.yourdomain.com
```

3. **Configure storage**:

```bash
# For cloud providers, update storage class
kubectl edit pvc insula-mcp-data-pvc -n insula-mcp

# AWS: gp3
# GCP: pd-ssd
# Azure: managed-premium
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment insula-mcp-enterprise -n insula-mcp --replicas=10

# Auto-scaling is configured via HPA
kubectl get hpa -n insula-mcp

# Update HPA
kubectl edit hpa insula-mcp-enterprise-hpa -n insula-mcp
```

### Monitoring

```bash
# Check pod status
kubectl get pods -n insula-mcp -w

# View logs
kubectl logs -n insula-mcp -l app=insula-mcp -f

# Check resource usage
kubectl top pods -n insula-mcp
kubectl top nodes

# Describe deployment
kubectl describe deployment insula-mcp-enterprise -n insula-mcp
```

## Production Configuration

### Environment Variables

**Required**:

- `NODE_ENV`: Set to `production`
- `INSULA_MCP_TIER`: `community`, `professional`, or `enterprise`
- `INSULA_MCP_LICENSE_KEY`: License key (Professional/Enterprise)

**Optional**:

- `INSULA_MCP_LOG_LEVEL`: `debug`, `info`, `warn`, `error` (default: `info`)
- `INSULA_MCP_LLM_BACKEND`: `ollama`, `mlx`, `llamacpp`
- `OLLAMA_HOST`: Ollama endpoint (default: `http://localhost:11434`)
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry endpoint
- `AUTH0_DOMAIN`: Auth0 domain (Enterprise)
- `AUTH0_CLIENT_ID`: Auth0 client ID (Enterprise)
- `AUTH0_CLIENT_SECRET`: Auth0 client secret (Enterprise)

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
  -v insula-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/insula-data-backup.tar.gz /data

# Kubernetes PVCs
kubectl exec -n insula-mcp deployment/insula-mcp-enterprise -- \
  tar czf - /app/data | gzip > insula-data-backup.tar.gz
```

#### Recovery

```bash
# Docker volumes
docker run --rm \
  -v insula-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/insula-data-backup.tar.gz -C /

# Kubernetes PVCs
kubectl exec -n insula-mcp deployment/insula-mcp-enterprise -- \
  tar xzf - -C /app/data < insula-data-backup.tar.gz
```

#### Automated Backups

```bash
# Cron job for daily backups
0 2 * * * /usr/local/bin/backup-insula-mcp.sh

# backup-insula-mcp.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
kubectl exec -n insula-mcp deployment/insula-mcp-enterprise -- \
  tar czf - /app/data | \
  aws s3 cp - s3://backups/insula-mcp-$DATE.tar.gz
```

## Monitoring and Logging

### Health Checks

```bash
# HTTP health endpoint
curl http://localhost:3000/health

# Response
{
  "status": "healthy",
  "version": "0.1.0",
  "tier": "enterprise",
  "llm": "available",
  "uptime": 3600
}
```

### Logging

**Docker**:

```bash
# View logs
docker logs -f insula-mcp

# Export logs
docker logs insula-mcp > insula-mcp.log
```

**Kubernetes**:

```bash
# View logs
kubectl logs -n insula-mcp -l app=insula-mcp -f

# Export logs
kubectl logs -n insula-mcp deployment/insula-mcp-enterprise > insula-mcp.log
```

### Metrics

**OpenTelemetry Integration**:

```yaml
# Configure OTEL
environment:
  - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
  - OTEL_SERVICE_NAME=insula-mcp
  - OTEL_RESOURCE_ATTRIBUTES=tier=enterprise
```

**Key Metrics**:

- Request rate
- Response time
- Error rate
- LLM inference time
- Plugin execution time
- Memory usage
- CPU usage

### Alerting

**Prometheus Alerts**:

```yaml
groups:
- name: insula-mcp
  rules:
  - alert: HighErrorRate
    expr: rate(insula_mcp_errors_total[5m]) > 0.05
    for: 5m
    annotations:
      summary: "High error rate detected"
  
  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, insula_mcp_response_time_seconds) > 2
    for: 5m
    annotations:
      summary: "95th percentile response time > 2s"
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
  brainwav/insula-mcp:latest
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
  name: insula-mcp-network-policy
  namespace: insula-mcp
spec:
  podSelector:
    matchLabels:
      app: insula-mcp
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
kubectl create secret generic insula-mcp-secrets \
  --from-file=license-key=./license.key \
  --from-file=auth0-config=./auth0.json \
  -n insula-mcp

# Create from literal
kubectl create secret generic insula-mcp-secrets \
  --from-literal=license-key=YOUR_KEY \
  -n insula-mcp
```

**External Secrets** (recommended):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: insula-mcp-secrets
  namespace: insula-mcp
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: insula-mcp-secrets
  data:
  - secretKey: license-key
    remoteRef:
      key: insula-mcp/license-key
```

## Troubleshooting

### Common Issues

**Container won't start**:

```bash
# Check logs
docker logs insula-mcp
kubectl logs -n insula-mcp deployment/insula-mcp-enterprise

# Check events
kubectl describe pod -n insula-mcp <pod-name>
```

**Health check failing**:

```bash
# Test health endpoint
curl -v http://localhost:3000/health

# Check port binding
netstat -tulpn | grep 3000
```

**LLM not available**:

```bash
# Check Ollama connection
curl http://ollama:11434/api/tags

# Verify environment variables
docker exec insula-mcp env | grep OLLAMA
kubectl exec -n insula-mcp deployment/insula-mcp-enterprise -- env | grep OLLAMA
```

## Upgrade Procedures

### Docker

```bash
# Pull new image
docker pull brainwav/insula-mcp:latest

# Stop and remove old container
docker stop insula-mcp
docker rm insula-mcp

# Start new container
docker run -d --name insula-mcp brainwav/insula-mcp:latest
```

### Kubernetes

```bash
# Update image
kubectl set image deployment/insula-mcp-enterprise \
  insula-mcp=brainwav/insula-mcp:latest \
  -n insula-mcp

# Monitor rollout
kubectl rollout status deployment/insula-mcp-enterprise -n insula-mcp

# Rollback if needed
kubectl rollout undo deployment/insula-mcp-enterprise -n insula-mcp
```

## Support

- **Documentation**: [docs/](./GETTING_STARTED.md)
- **GitHub Issues**: Report bugs and request features
- **Enterprise Support**: <support@brainwav.com>
- **Community**: GitHub Discussions

## License

Apache 2.0 - See LICENSE file for details
