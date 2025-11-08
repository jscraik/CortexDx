# Insula MCP Helm Chart

This Helm chart deploys Insula MCP on a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (for persistent storage)

## Installing the Chart

### Community Edition

```bash
helm install insula-mcp ./insula-mcp \
  --set tier=community \
  --set replicaCount=2
```

### Professional Edition

```bash
helm install insula-mcp ./insula-mcp \
  --set tier=professional \
  --set replicaCount=3 \
  --set secrets.licenseKey="YOUR_LICENSE_KEY" \
  --set ollama.enabled=true
```

### Enterprise Edition

```bash
helm install insula-mcp ./insula-mcp \
  --set tier=enterprise \
  --set replicaCount=5 \
  --set secrets.licenseKey="YOUR_LICENSE_KEY" \
  --set secrets.auth0Domain="YOUR_AUTH0_DOMAIN" \
  --set secrets.auth0ClientId="YOUR_CLIENT_ID" \
  --set secrets.auth0ClientSecret="YOUR_CLIENT_SECRET" \
  --set ollama.enabled=true \
  --set postgresql.enabled=true \
  --set redis.enabled=true \
  --set autoscaling.enabled=true
```

## Configuration

The following table lists the configurable parameters of the Insula MCP chart and their default values.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `tier` | Licensing tier (community, professional, enterprise) | `community` |
| `replicaCount` | Number of replicas | `2` |
| `image.repository` | Image repository | `brainwav/insula-mcp` |
| `image.tag` | Image tag | `""` (uses appVersion) |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `persistence.enabled` | Enable persistent storage | `true` |
| `persistence.size.data` | Data volume size | `10Gi` |
| `persistence.size.logs` | Logs volume size | `5Gi` |
| `persistence.size.models` | Models volume size | `50Gi` |
| `persistence.size.reports` | Reports volume size | `20Gi` |
| `autoscaling.enabled` | Enable horizontal pod autoscaling | `false` |
| `autoscaling.minReplicas` | Minimum number of replicas | `2` |
| `autoscaling.maxReplicas` | Maximum number of replicas | `10` |
| `ollama.enabled` | Enable Ollama LLM backend | `false` |
| `postgresql.enabled` | Enable PostgreSQL database | `false` |
| `redis.enabled` | Enable Redis cache | `false` |

## Upgrading

```bash
helm upgrade insula-mcp ./insula-mcp \
  --set tier=professional \
  --reuse-values
```

## Uninstalling

```bash
helm uninstall insula-mcp
```

## Examples

### Enable Autoscaling

```bash
helm install insula-mcp ./insula-mcp \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=15
```

### Enable Ingress with TLS

```bash
helm install insula-mcp ./insula-mcp \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=insula-mcp.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix \
  --set ingress.tls[0].secretName=insula-mcp-tls \
  --set ingress.tls[0].hosts[0]=insula-mcp.example.com
```

### Custom Resource Limits

```bash
helm install insula-mcp ./insula-mcp \
  --set resources.professional.requests.memory=1Gi \
  --set resources.professional.requests.cpu=1000m \
  --set resources.professional.limits.memory=2Gi \
  --set resources.professional.limits.cpu=2000m
```

## Monitoring

To enable Prometheus monitoring:

```bash
helm install insula-mcp ./insula-mcp \
  --set monitoring.enabled=true \
  --set monitoring.serviceMonitor.enabled=true
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=insula-mcp
```

### View Logs

```bash
kubectl logs -l app.kubernetes.io/name=insula-mcp -f
```

### Check Health

```bash
kubectl port-forward svc/insula-mcp 3000:80
curl http://localhost:3000/health
```

## Support

For issues and questions, please visit:

- GitHub: https://github.com/brainwav/insula-mcp
- Documentation: https://brainwav.dev/docs/insula-mcp
