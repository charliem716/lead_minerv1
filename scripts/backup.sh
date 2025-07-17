#!/bin/bash

# Lead-Miner Agent Backup Script
# Performs comprehensive backup of database, configuration, and logs

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/opt/leadminer/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="leadminer_backup_${TIMESTAMP}"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory: ${BACKUP_DIR}/${BACKUP_NAME}"
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
}

# Backup database
backup_database() {
    log "Backing up PostgreSQL database..."
    
    if docker-compose ps postgres | grep -q "Up"; then
        docker-compose exec -T postgres pg_dump -U leadminer -d leadminer --clean --no-owner > "${BACKUP_DIR}/${BACKUP_NAME}/database.sql"
        
        if [ $? -eq 0 ]; then
            log "Database backup completed successfully"
            
            # Compress database backup
            gzip "${BACKUP_DIR}/${BACKUP_NAME}/database.sql"
            log "Database backup compressed"
        else
            error "Database backup failed"
            return 1
        fi
    else
        error "PostgreSQL container is not running"
        return 1
    fi
}

# Backup configuration files
backup_config() {
    log "Backing up configuration files..."
    
    # Create config backup directory
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}/config"
    
    # Backup environment files (excluding sensitive data)
    if [ -f ".env.production" ]; then
        # Create sanitized version of env file
        grep -v "PASSWORD\|KEY\|SECRET" .env.production > "${BACKUP_DIR}/${BACKUP_NAME}/config/env.template" || true
        log "Environment template backed up"
    fi
    
    # Backup docker-compose and configuration
    cp docker-compose.yml "${BACKUP_DIR}/${BACKUP_NAME}/config/" 2>/dev/null || warn "docker-compose.yml not found"
    cp nginx.conf "${BACKUP_DIR}/${BACKUP_NAME}/config/" 2>/dev/null || warn "nginx.conf not found"
    cp Dockerfile "${BACKUP_DIR}/${BACKUP_NAME}/config/" 2>/dev/null || warn "Dockerfile not found"
    
    # Backup source configuration
    if [ -d "src/config" ]; then
        cp -r src/config "${BACKUP_DIR}/${BACKUP_NAME}/config/"
        log "Source configuration backed up"
    fi
    
    # Backup database schema
    if [ -f "src/database/schema.sql" ]; then
        cp src/database/schema.sql "${BACKUP_DIR}/${BACKUP_NAME}/config/"
        log "Database schema backed up"
    fi
}

# Backup logs
backup_logs() {
    log "Backing up application logs..."
    
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}/logs"
    
    # Backup docker logs
    if docker-compose ps leadminer-app | grep -q "Up"; then
        docker-compose logs --no-color leadminer-app > "${BACKUP_DIR}/${BACKUP_NAME}/logs/app.log" 2>/dev/null || warn "Could not backup app logs"
        docker-compose logs --no-color postgres > "${BACKUP_DIR}/${BACKUP_NAME}/logs/postgres.log" 2>/dev/null || warn "Could not backup postgres logs"
        docker-compose logs --no-color redis > "${BACKUP_DIR}/${BACKUP_NAME}/logs/redis.log" 2>/dev/null || warn "Could not backup redis logs"
        docker-compose logs --no-color nginx > "${BACKUP_DIR}/${BACKUP_NAME}/logs/nginx.log" 2>/dev/null || warn "Could not backup nginx logs"
    fi
    
    # Backup log files if they exist
    if [ -d "logs" ]; then
        cp -r logs/* "${BACKUP_DIR}/${BACKUP_NAME}/logs/" 2>/dev/null || warn "Could not backup log files"
    fi
    
    log "Logs backup completed"
}

# Backup application data
backup_data() {
    log "Backing up application data..."
    
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}/data"
    
    # Backup any data files
    if [ -d "data" ]; then
        cp -r data/* "${BACKUP_DIR}/${BACKUP_NAME}/data/" 2>/dev/null || warn "Could not backup data files"
    fi
    
    # Backup Redis data (if accessible)
    if docker-compose ps redis | grep -q "Up"; then
        docker-compose exec -T redis redis-cli --rdb - > "${BACKUP_DIR}/${BACKUP_NAME}/data/redis.rdb" 2>/dev/null || warn "Could not backup Redis data"
    fi
    
    log "Data backup completed"
}

# Create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    cat > "${BACKUP_DIR}/${BACKUP_NAME}/MANIFEST.txt" << EOF
Lead-Miner Agent Backup
=======================

Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Hostname: $(hostname)
Docker Compose Version: $(docker-compose --version)

Contents:
- database.sql.gz: PostgreSQL database dump
- config/: Configuration files and templates
- logs/: Application and system logs
- data/: Application data and cache files

Restoration Instructions:
1. Stop all services: docker-compose down
2. Restore database: gunzip -c database.sql.gz | docker-compose exec -T postgres psql -U leadminer -d leadminer
3. Restore configuration files to appropriate locations
4. Start services: docker-compose up -d
5. Verify system health: docker-compose logs -f

Notes:
- Environment variables with sensitive data are not included
- SSL certificates are not included in this backup
- Restore on same or compatible system architecture
EOF

    log "Backup manifest created"
}

# Compress backup
compress_backup() {
    log "Compressing backup..."
    
    cd "${BACKUP_DIR}"
    tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
    
    if [ $? -eq 0 ]; then
        # Remove uncompressed backup
        rm -rf "${BACKUP_NAME}"
        log "Backup compressed successfully: ${BACKUP_NAME}.tar.gz"
    else
        error "Backup compression failed"
        return 1
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
    
    find "${BACKUP_DIR}" -name "leadminer_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
    
    log "Old backups cleaned up"
}

# Upload to cloud storage (optional)
upload_to_cloud() {
    # This function can be customized based on your cloud storage provider
    # Example for AWS S3:
    # aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" s3://your-backup-bucket/leadminer/
    
    log "Cloud upload not configured (optional)"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    if [ -f "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" ]; then
        tar -tzf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" >/dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            log "Backup integrity verified successfully"
        else
            error "Backup integrity check failed"
            return 1
        fi
    else
        error "Backup file not found"
        return 1
    fi
}

# Send notification (optional)
send_notification() {
    # This function can be customized to send notifications
    # Example: Send email, Slack message, etc.
    
    log "Backup completed successfully at $(date)"
    log "Backup location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    log "Backup size: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)"
}

# Main backup function
main() {
    log "Starting Lead-Miner Agent backup process..."
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        error "docker-compose is not installed or not in PATH"
        exit 1
    fi
    
    # Create backup directory
    create_backup_dir
    
    # Perform backups
    backup_database || exit 1
    backup_config
    backup_logs
    backup_data
    
    # Create manifest
    create_manifest
    
    # Compress backup
    compress_backup || exit 1
    
    # Verify backup
    verify_backup || exit 1
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Optional: Upload to cloud
    upload_to_cloud
    
    # Send notification
    send_notification
    
    log "Backup process completed successfully!"
}

# Run main function
main "$@" 