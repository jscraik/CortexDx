#!/usr/bin/env bash
# Insula MCP Restore Script
# Restores conversation history, patterns, models, and configuration from backup

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
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

# Check if backup file is provided
if [ $# -eq 0 ]; then
    error "Usage: $0 <backup-file.tar.gz>"
    error "Available backups:"
    ls -lh "${BACKUP_DIR}"/insula-mcp-backup-*.tar.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

log "Starting restore from: ${BACKUP_FILE}"

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Extract backup
log "Extracting backup..."
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}" || {
    error "Failed to extract backup"
    exit 1
}

# Find the backup directory
BACKUP_NAME=$(basename "${BACKUP_FILE}" .tar.gz)
EXTRACTED_DIR="${TEMP_DIR}/${BACKUP_NAME}"

if [ ! -d "${EXTRACTED_DIR}" ]; then
    error "Backup directory not found in archive"
    exit 1
fi

# Verify checksums
if [ -f "${EXTRACTED_DIR}/checksums.sha256" ]; then
    log "Verifying checksums..."
    (cd "${EXTRACTED_DIR}" && sha256sum -c checksums.sha256) || {
        error "Checksum verification failed"
        exit 1
    }
    log "Checksums verified successfully"
fi

# Display backup metadata
if [ -f "${EXTRACTED_DIR}/metadata.json" ]; then
    log "Backup metadata:"
    cat "${EXTRACTED_DIR}/metadata.json"
fi

# Confirm restore
read -p "Do you want to proceed with restore? This will overwrite existing data. (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log "Restore cancelled"
    exit 0
fi

# Stop Insula MCP service if running
if command -v systemctl &> /dev/null; then
    log "Stopping Insula MCP service..."
    systemctl stop insula-mcp || true
fi

# Backup current data before restore
CURRENT_BACKUP_DIR="${BACKUP_DIR}/pre-restore-$(date +%Y%m%d_%H%M%S)"
mkdir -p "${CURRENT_BACKUP_DIR}"
log "Backing up current data to: ${CURRENT_BACKUP_DIR}"

[ -d "${DATA_DIR}" ] && cp -r "${DATA_DIR}" "${CURRENT_BACKUP_DIR}/data" || true
[ -d "${PATTERNS_DIR}" ] && cp -r "${PATTERNS_DIR}" "${CURRENT_BACKUP_DIR}/patterns" || true
[ -d "${CONFIG_DIR}" ] && cp -r "${CONFIG_DIR}" "${CURRENT_BACKUP_DIR}/config" || true

# Restore data
if [ -f "${EXTRACTED_DIR}/data.tar.gz" ]; then
    log "Restoring conversation history and data..."
    mkdir -p "${DATA_DIR}"
    tar -xzf "${EXTRACTED_DIR}/data.tar.gz" -C "${DATA_DIR}" || {
        error "Failed to restore data"
        exit 1
    }
    log "Data restored successfully"
fi

# Restore patterns
if [ -f "${EXTRACTED_DIR}/patterns.tar.gz" ]; then
    log "Restoring pattern learning database..."
    mkdir -p "${PATTERNS_DIR}"
    tar -xzf "${EXTRACTED_DIR}/patterns.tar.gz" -C "${PATTERNS_DIR}" || {
        error "Failed to restore patterns"
        exit 1
    }
    log "Patterns restored successfully"
fi

# Restore models
if [ -f "${EXTRACTED_DIR}/models.tar.gz" ]; then
    log "Restoring local models..."
    mkdir -p "${MODELS_DIR}"
    tar -xzf "${EXTRACTED_DIR}/models.tar.gz" -C "${MODELS_DIR}" || {
        error "Failed to restore models"
        exit 1
    }
    log "Models restored successfully"
fi

# Restore configuration
if [ -f "${EXTRACTED_DIR}/config.tar.gz" ]; then
    log "Restoring configuration..."
    mkdir -p "${CONFIG_DIR}"
    tar -xzf "${EXTRACTED_DIR}/config.tar.gz" -C "${CONFIG_DIR}" || {
        error "Failed to restore config"
        exit 1
    }
    log "Configuration restored successfully"
fi

# Set proper permissions
log "Setting permissions..."
chown -R insula:insula "${DATA_DIR}" "${PATTERNS_DIR}" "${CONFIG_DIR}" 2>/dev/null || true
[ -d "${MODELS_DIR}" ] && chown -R insula:insula "${MODELS_DIR}" 2>/dev/null || true

# Start Insula MCP service
if command -v systemctl &> /dev/null; then
    log "Starting Insula MCP service..."
    systemctl start insula-mcp || {
        error "Failed to start service"
        exit 1
    }
    
    # Wait for service to be ready
    log "Waiting for service to be ready..."
    for i in {1..30}; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log "Service is ready"
            break
        fi
        sleep 2
    done
fi

log "Restore completed successfully"
log "Pre-restore backup saved to: ${CURRENT_BACKUP_DIR}"
exit 0
