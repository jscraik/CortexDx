# Backup and Recovery Guide

This guide provides comprehensive instructions for backing up and restoring Insula MCP data, including conversation history, pattern learning databases, local models, and configuration.

## Table of Contents

- [Overview](#overview)
- [What Gets Backed Up](#what-gets-backed-up)
- [Backup Methods](#backup-methods)
- [Automated Backups](#automated-backups)
- [Manual Backups](#manual-backups)
- [Restore Procedures](#restore-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Testing Backups](#testing-backups)
- [Best Practices](#best-practices)

## Overview

Regular backups are essential for:

- **Data Protection** - Prevent loss of conversation history and learned patterns
- **Disaster Recovery** - Quick recovery from system failures
- **Migration** - Move data between environments
- **Compliance** - Meet data retention requirements

## What Gets Backed Up

### Core Data (Always Backed Up)

1. **Conversation History** (`/app/data`)
   - User interactions and diagnostic sessions
   - Problem-solution pairs
   - Session metadata
   - Size: ~100MB-1GB depending on usage

2. **Pattern Learning Database** (`/app/patterns`)
   - Anonymized problem patterns
   - Solution patterns
   - Pattern matching indices
   - Success rate statistics
   - Size: ~50MB-500MB

3. **Configuration** (`/app/config`)
   - Server configuration
   - Plugin settings
   - License information (encrypted)
   - Size: ~1MB-10MB

### Optional Data

4. **Local Models** (`/app/models`)
   - LLM model files (Ollama, MLX)
   - Model configurations
   - Size: 2GB-50GB per model
   - **Note**: Usually not backed up due to size; can be re-downloaded

## Backup Methods

### Method 1: Automated Kubernetes CronJob (Recommended)

Best for production Kubernetes deployments.

**Setup:**

```bash
# Apply backup CronJob
kubectl apply -f packages/insula-mcp/kubernetes/backup/backup-cronjob.yaml

# Configure remote storage (optional)
kubectl create secret generic backup-secrets \
  --from-literal=remote-url='s3://my-bucket/insula-mcp-backups' \
  --from-literal=aws-access-key-id='YOUR_KEY' \
  --from-literal=aws-secret-access-key='YOUR_SECRET' \
  -n insula-mcp
```

**Schedule:**

- Default: Daily at 2 AM
- Customize: Edit `spec.schedule` in CronJob YAML

**Monitoring:**

```bash
# View backup jobs
kubectl get cronjobs -n insula-mcp

# Check last backup status
kubectl get jobs -n insula-mcp | grep backup

# View backup logs
kubectl logs -n insula-mcp job/insula-mcp-backup-<timestamp>
```

### Method 2: Manual Script Execution

Best for Docker deployments or manual backups.

**Docker:**

```bash
# Run backup inside container
docker exec insula-mcp /app/scripts/backup.sh

# Copy backup to host
docker cp insula-mcp:/app/backups/insula-mcp-backup-<timestamp>.tar.gz ./
```

**Direct Execution:**

```bash
# Set environment variables
export BACKUP_DIR=/path/to/backups
export DATA_DIR=/app/data
export PATTERNS_DIR=/app/patterns
export RETENTION_DAYS=30

# Run backup script
./packages/insula-mcp/scripts/backup.sh
```

### Method 3: Volume Snapshots

Best for cloud-native deployments with snapshot support.

**AWS EBS:**

```bash
# Create snapshot of EBS volume
aws ec2 create-snapshot \
  --volume-id vol-xxxxx \
  --description "Insula MCP backup $(date +%Y-%m-%d)" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=insula-mcp-backup}]'
```

**GCP Persistent Disk:**

```bash
# Create snapshot
gcloud compute disks snapshot insula-mcp-data \
  --snapshot-names=insula-mcp-backup-$(date +%Y%m%d) \
  --zone=us-central1-a
```

**Azure Disk:**

```bash
# Create snapshot
az snapshot create \
  --resource-group myResourceGroup \
  --name insula-mcp-backup-$(date +%Y%m%d) \
  --source /subscriptions/.../disks/insula-mcp-data
```

## Automated Backups

### Kubernetes CronJob Configuration

**Basic Configuration:**

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: insula-mcp-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: brainwav/insula-mcp:latest
              command: ["/bin/bash", "/app/scripts/backup.sh"]
              env:
                - name: RETENTION_DAYS
                  value: "30"
```

**Advanced Configuration with Remote Storage:**

```yaml
env:
  - name: BACKUP_REMOTE_URL
    value: "s3://my-bucket/insula-mcp-backups"
  - name: AWS_ACCESS_KEY_ID
    valueFrom:
      secretKeyRef:
        name: backup-secrets
        key: aws-access-key-id
  - name: AWS_SECRET_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: backup-secrets
        key: aws-secret-access-key
```

### Backup Retention Policy

Configure retention based on your needs:

```bash
# Keep daily backups for 7 days
RETENTION_DAYS=7

# Keep weekly backups for 30 days
RETENTION_DAYS=30

# Keep monthly backups for 365 days
RETENTION_DAYS=365
```

### Remote Storage Options

**AWS S3:**

```bash
# Install AWS CLI in backup container
apt-get update && apt-get install -y awscli

# Upload to S3
aws s3 cp backup.tar.gz s3://my-bucket/insula-mcp-backups/
```

**Google Cloud Storage:**

```bash
# Install gsutil
apt-get update && apt-get install -y google-cloud-sdk

# Upload to GCS
gsutil cp backup.tar.gz gs://my-bucket/insula-mcp-backups/
```

**Azure Blob Storage:**

```bash
# Install Azure CLI
apt-get update && apt-get install -y azure-cli

# Upload to Azure
az storage blob upload \
  --file backup.tar.gz \
  --container-name backups \
  --name insula-mcp-backup-$(date +%Y%m%d).tar.gz
```

## Manual Backups

### Before Major Changes

Always backup before:

- Upgrading Insula MCP
- Changing configuration
- Migrating to new infrastructure
- Testing new features

```bash
# Create pre-upgrade backup
./scripts/backup.sh
```

### On-Demand Backups

```bash
# Kubernetes
kubectl create job --from=cronjob/insula-mcp-backup manual-backup-$(date +%Y%m%d)

# Docker
docker exec insula-mcp /app/scripts/backup.sh

# Direct
./scripts/backup.sh
```

### Verify Backup

```bash
# List backups
ls -lh /app/backups/

# Check backup contents
tar -tzf insula-mcp-backup-<timestamp>.tar.gz

# Verify checksums
tar -xzf insula-mcp-backup-<timestamp>.tar.gz
cd insula-mcp-backup-<timestamp>
sha256sum -c checksums.sha256
```

## Restore Procedures

### Full Restore

**Kubernetes:**

```bash
# Stop current deployment
kubectl scale deployment insula-mcp --replicas=0 -n insula-mcp

# Create restore job
kubectl run insula-mcp-restore \
  --image=brainwav/insula-mcp:latest \
  --restart=Never \
  --command -- /bin/bash /app/scripts/restore.sh /backups/insula-mcp-backup-<timestamp>.tar.gz

# Wait for completion
kubectl wait --for=condition=complete job/insula-mcp-restore -n insula-mcp --timeout=10m

# Scale deployment back up
kubectl scale deployment insula-mcp --replicas=2 -n insula-mcp
```

**Docker:**

```bash
# Stop container
docker stop insula-mcp

# Copy backup to container
docker cp insula-mcp-backup-<timestamp>.tar.gz insula-mcp:/tmp/

# Restore
docker exec insula-mcp /app/scripts/restore.sh /tmp/insula-mcp-backup-<timestamp>.tar.gz

# Start container
docker start insula-mcp
```

**Direct:**

```bash
# Stop service
systemctl stop insula-mcp

# Run restore
./scripts/restore.sh /path/to/insula-mcp-backup-<timestamp>.tar.gz

# Start service
systemctl start insula-mcp
```

### Partial Restore

Restore specific components:

```bash
# Extract backup
tar -xzf insula-mcp-backup-<timestamp>.tar.gz
cd insula-mcp-backup-<timestamp>

# Restore only patterns
tar -xzf patterns.tar.gz -C /app/patterns

# Restore only configuration
tar -xzf config.tar.gz -C /app/config

# Restore only data
tar -xzf data.tar.gz -C /app/data
```

### Point-in-Time Recovery

Restore to a specific point in time:

```bash
# List available backups
ls -lt /app/backups/

# Choose backup from desired time
./scripts/restore.sh /app/backups/insula-mcp-backup-20250108_140000.tar.gz
```

## Disaster Recovery

### Recovery Time Objective (RTO)

Target recovery times:

- **Community Edition**: 30 minutes
- **Professional Edition**: 15 minutes
- **Enterprise Edition**: 5 minutes

### Recovery Point Objective (RPO)

Maximum acceptable data loss:

- **Daily Backups**: Up to 24 hours
- **Hourly Backups**: Up to 1 hour
- **Continuous Replication**: Near-zero

### Disaster Recovery Plan

**1. Assess Situation**

```bash
# Check service status
kubectl get pods -n insula-mcp
systemctl status insula-mcp

# Check logs
kubectl logs -n insula-mcp -l app=insula-mcp --tail=100
journalctl -u insula-mcp -n 100
```

**2. Identify Latest Backup**

```bash
# List backups
ls -lt /app/backups/ | head -5

# Verify backup integrity
tar -tzf <backup-file> > /dev/null && echo "OK" || echo "CORRUPTED"
```

**3. Restore from Backup**

Follow restore procedures above.

**4. Verify Recovery**

```bash
# Check health
curl http://localhost:3000/health

# Verify data
# - Check conversation history
# - Verify pattern database
# - Test LLM backend
```

**5. Resume Operations**

```bash
# Scale to normal capacity
kubectl scale deployment insula-mcp --replicas=5 -n insula-mcp

# Monitor for issues
kubectl logs -f -n insula-mcp -l app=insula-mcp
```

### Multi-Region Disaster Recovery

For enterprise deployments:

```yaml
# Primary region backup
aws s3 sync /app/backups/ s3://primary-backups/insula-mcp/

# Replicate to secondary region
aws s3 sync s3://primary-backups/insula-mcp/ s3://secondary-backups/insula-mcp/ \
  --source-region us-east-1 \
  --region us-west-2
```

## Testing Backups

### Regular Testing Schedule

- **Weekly**: Verify backup completion
- **Monthly**: Test restore procedure
- **Quarterly**: Full disaster recovery drill

### Backup Verification

```bash
# Automated verification script
#!/bin/bash
BACKUP_FILE="$1"

# Extract to temp directory
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Verify checksums
cd "$TEMP_DIR"/insula-mcp-backup-*
sha256sum -c checksums.sha256

# Check metadata
cat metadata.json

# Cleanup
rm -rf "$TEMP_DIR"
```

### Restore Testing

```bash
# Create test environment
kubectl create namespace insula-mcp-test

# Deploy test instance
helm install insula-mcp-test ./helm/insula-mcp \
  --namespace insula-mcp-test

# Restore backup to test instance
kubectl run restore-test \
  --image=brainwav/insula-mcp:latest \
  --namespace=insula-mcp-test \
  --command -- /app/scripts/restore.sh /backups/latest.tar.gz

# Verify functionality
kubectl port-forward -n insula-mcp-test svc/insula-mcp-test 3001:80
curl http://localhost:3001/health

# Cleanup
kubectl delete namespace insula-mcp-test
```

## Best Practices

### Backup Strategy

1. **3-2-1 Rule**
   - 3 copies of data
   - 2 different storage types
   - 1 off-site copy

2. **Encryption**
   - Encrypt backups at rest
   - Use encrypted transport (HTTPS, TLS)
   - Protect encryption keys

3. **Automation**
   - Automate backup creation
   - Automate backup verification
   - Automate cleanup of old backups

4. **Monitoring**
   - Alert on backup failures
   - Track backup size trends
   - Monitor backup duration

### Storage Recommendations

**Local Storage:**

- Fast SSD for backup operations
- Separate volume from application data
- Size: 2-3x data size

**Remote Storage:**

- Use versioned buckets
- Enable lifecycle policies
- Configure cross-region replication

### Security

1. **Access Control**
   - Limit backup access to authorized users
   - Use IAM roles for cloud storage
   - Audit backup access logs

2. **Encryption**

   ```bash
   # Encrypt backup
   gpg --encrypt --recipient backup@example.com backup.tar.gz
   
   # Decrypt backup
   gpg --decrypt backup.tar.gz.gpg > backup.tar.gz
   ```

3. **Secrets Management**
   - Never store credentials in backups
   - Use secret management systems
   - Rotate credentials regularly

### Performance

1. **Compression**
   - Use gzip for good compression/speed balance
   - Consider zstd for better compression
   - Skip compression for already compressed data

2. **Incremental Backups**

   ```bash
   # Create incremental backup
   rsync -av --link-dest=/backups/latest /app/data/ /backups/$(date +%Y%m%d)/
   ```

3. **Parallel Operations**

   ```bash
   # Backup multiple directories in parallel
   tar -czf data.tar.gz /app/data &
   tar -czf patterns.tar.gz /app/patterns &
   wait
   ```

## Troubleshooting

### Backup Failures

**Insufficient Disk Space:**

```bash
# Check available space
df -h /app/backups

# Clean old backups
find /app/backups -name "*.tar.gz" -mtime +30 -delete
```

**Permission Errors:**

```bash
# Fix permissions
chown -R insula:insula /app/backups
chmod 755 /app/backups
```

**Timeout Issues:**

```bash
# Increase timeout in CronJob
spec:
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600  # 1 hour
```

### Restore Failures

**Corrupted Backup:**

```bash
# Verify backup integrity
tar -tzf backup.tar.gz > /dev/null

# Try previous backup
ls -lt /app/backups/ | head -10
```

**Version Mismatch:**

```bash
# Check backup version
tar -xzOf backup.tar.gz insula-mcp-backup-*/metadata.json | jq .version

# Upgrade/downgrade if needed
```

**Service Won't Start:**

```bash
# Check logs
journalctl -u insula-mcp -n 100

# Verify configuration
cat /app/config/*.json

# Check permissions
ls -la /app/data /app/patterns
```

## Support

For additional help:

- Documentation: https://brainwav.dev/docs/insula-mcp/backup
- GitHub Issues: https://github.com/brainwav/insula-mcp/issues
- Community: https://discord.gg/brainwav
- Enterprise Support: support@brainwav.dev
