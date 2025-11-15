# CortexDx Helm Chart

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](../../../../../../LICENSE)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-1.20+-blue.svg)](https://kubernetes.io/)
[![Helm](https://img.shields.io/badge/Helm-3.0+-blue.svg)](https://helm.sh/)

This Helm chart deploys CortexDx on a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.20+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (for persistent storage)

## Installing the Chart

### Community Edition

```bash
helm install cortexdx ./cortexdx \
  --set tier=community \
  --set replicaCount=2
```

### Professional Edition

```bash
helm install cortexdx ./cortexdx \
  --set tier=professional \
  --set replicaCount=3 \
  --set secrets.licenseKey="YOUR_LICENSE_KEY" \
  --set ollama.enabled=true
```

### Enterprise Edition

```bash
helm install cortexdx ./cortexdx \
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

The following table lists the configurable parameters of the CortexDx chart and their default values.

| Parameter | Description | Default |
|-----------|-------------|---------|
| `tier` | Licensing tier (community, professional, enterprise) | `community` |
| `replicaCount` | Number of replicas | `2` |
| `image.repository` | Image repository | `brainwav/cortexdx` |
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
helm upgrade cortexdx ./cortexdx \
  --set tier=professional \
  --reuse-values
```

## Uninstalling

```bash
helm uninstall cortexdx
```

## Examples

### Enable Autoscaling

```bash
helm install cortexdx ./cortexdx \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=15
```

### Enable Ingress with TLS

```bash
helm install cortexdx ./cortexdx \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=cortexdx.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix \
  --set ingress.tls[0].secretName=cortexdx-tls \
  --set ingress.tls[0].hosts[0]=cortexdx.example.com
```

### Custom Resource Limits

```bash
helm install cortexdx ./cortexdx \
  --set resources.professional.requests.memory=1Gi \
  --set resources.professional.requests.cpu=1000m \
  --set resources.professional.limits.memory=2Gi \
  --set resources.professional.limits.cpu=2000m
```

## Monitoring

To enable Prometheus monitoring:

```bash
helm install cortexdx ./cortexdx \
  --set monitoring.enabled=true \
  --set monitoring.serviceMonitor.enabled=true
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=cortexdx
```

### View Logs

```bash
kubectl logs -l app.kubernetes.io/name=cortexdx -f
```

### Check Health

```bash
kubectl port-forward svc/cortexdx 3000:80
curl http://localhost:3000/health
```

## Contributing

When contributing improvements to the Helm chart:

1. Follow Helm best practices
2. Test with multiple Kubernetes versions
3. Update values.yaml with new configuration options
4. Document all parameters in this README
5. Test all three licensing tiers

See the main [Contributing Guide](../../../../../../CONTRIBUTING.md) for complete development setup and coding standards.

## Support

For issues and questions:

- **GitHub Issues**: [CortexDx Issues](https://github.com/jscraik/CortexDx/issues)
- **Documentation**: See main [CortexDx Documentation](../../../../../../README.md)
- **Helm Documentation**: <https://helm.sh/docs/>

## License

Licensed under the [Apache License 2.0](../../../../../../LICENSE)
