#!/usr/bin/env bash
# Insula MCP Backup Script
# Backs up conversation history, patterns, models, and configuration

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="insula-mcp-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Directories to backup
DATA_DIR="${DATA_DIR:-/app/data}"
PATTERNS_DIR="${PATTERNS_DIR:-/app/patterns}"
MODELS_DIR="${MODELS_DIR:-/app/models}"
CONFIG_DIR="${CONFIG_DIR:-/app/config}"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# Create backup directory
mkdir -p "${BACKUP_PATH}"

log "Starting backup: ${BACKUP_NAME}"

# Backup conversation history and data
if [ -d "${DATA_DIR}" ]; then
    log "Backing up conversation history and data..."
    tar -czf "${BACKUP_PATH}/data.tar.gz" -C "${DATA_DIR}" . 2>/dev/null || {
        error "Failed to backup data directory"
        exit 1
    }
    log "Data backup completed: $(du -h "${BACKUP_PATH}/data.tar.gz" | cut -f1)"
fi

# Backup pattern learning database
if [ -d "${PATTERNS_DIR}" ]; then
    log "Backing up pattern learning database..."
    tar -czf "${BACKUP_PATH}/patterns.tar.gz" -C "${PATTERNS_DIR}" . 2>/dev/null || {
        error "Failed to backup patterns directory"
        exit 1
    }
    log "Patterns backup completed: $(du -h "${BACKUP_PATH}/patterns.tar.gz" | cut -f1)"
fi

# Backup local models (optional, can be large)
if [ -d "${MODELS_DIR}" ] && [ "${BACKUP_MODELS:-false}" = "true" ]; then
    log "Backing up local models (this may take a while)..."
    tar -czf "${BACKUP_PATH}/models.tar.gz" -C "${MODELS_DIR}" . 2>/dev/null || {
        error "Failed to backup models directory"
        exit 1
    }
    log "Models backup completed: $(du -h "${BACKUP_PATH}/models.tar.gz" | cut -f1)"
else
    log "Skipping models backup (set BACKUP_MODELS=true to enable)"
fi

# Backup configuration
if [ -d "${CONFIG_DIR}" ]; then
    log "Backing up configuration..."
    tar -czf "${BACKUP_PATH}/config.tar.gz" -C "${CONFIG_DIR}" . 2>/dev/null || {
        error "Failed to backup config directory"
        exit 1
    }
    log "Configuration backup completed: $(du -h "${BACKUP_PATH}/config.tar.gz" | cut -f1)"
fi

# Create backup metadata
cat > "${BACKUP_PATH}/metadata.json" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "version": "$(node -p "require('/app/package.json').version" 2>/dev/null || echo 'unknown')",
  "hostname": "$(hostname)",
  "tier": "${INSULA_MCP_TIER:-unknown}",
  "backup_size": "$(du -sh "${BACKUP_PATH}" | cut -f1)",
  "includes_models": ${BACKUP_MODELS:-false}
}
EOF

log "Backup metadata created"

# Create checksum file
log "Creating checksums..."
(cd "${BACKUP_PATH}" && sha256sum *.tar.gz > checksums.sha256) || {
    error "Failed to create checksums"
    exit 1
}

# Compress entire backup
log "Compressing backup..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}" || {
    error "Failed to compress backup"
    exit 1
}

# Remove uncompressed backup
rm -rf "${BACKUP_PATH}"

FINAL_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
log "Backup completed: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz (${FINAL_SIZE})"

# Cleanup old backups
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "insula-mcp-backup-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete || {
    error "Failed to cleanup old backups"
}

# Upload to remote storage (optional)
if [ -n "${BACKUP_REMOTE_URL:-}" ]; then
    log "Uploading backup to remote storage..."
    if command -v aws &> /dev/null; then
        aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "${BACKUP_REMOTE_URL}/" || {
            error "Failed to upload to S3"
        }
    elif command -v gsutil &> /dev/null; then
        gsutil cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "${BACKUP_REMOTE_URL}/" || {
            error "Failed to upload to GCS"
        }
    elif command -v az &> /dev/null; then
        az storage blob upload \
            --file "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
            --container-name backups \
            --name "${BACKUP_NAME}.tar.gz" || {
            error "Failed to upload to Azure"
        }
    else
        error "No cloud CLI tool found (aws, gsutil, az)"
    fi
fi

log "Backup process completed successfully"
exit 0
