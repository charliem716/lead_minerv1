#!/bin/bash

# Lead-Miner Agent Restore Script
# Restores database, configuration, and data from backup

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/opt/leadminer/backups"
RESTORE_DIR="/tmp/leadminer_restore"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] <backup_file>

Restore Lead-Miner Agent from backup

Options:
    -h, --help          Show this help message
    -f, --force         Force restore without confirmation
    -d, --database-only Restore database only
    -c, --config-only   Restore configuration only
    --dry-run          Show what would be restored without actually doing it

Examples:
    $0 /path/to/leadminer_backup_20250101_120000.tar.gz
    $0 --database-only backup.tar.gz
    $0 --force --config-only backup.tar.gz

EOF
}

# Parse command line arguments
FORCE=false
DATABASE_ONLY=false
CONFIG_ONLY=false
DRY_RUN=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -d|--database-only)
            DATABASE_ONLY=true
            shift
            ;;
        -c|--config-only)
            CONFIG_ONLY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Validate backup file
validate_backup() {
    if [ -z "$BACKUP_FILE" ]; then
        error "No backup file specified"
        usage
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    log "Validating backup file: $BACKUP_FILE"
    
    # Check if file is a valid tar.gz
    if ! tar -tzf "$BACKUP_FILE" >/dev/null 2>&1; then
        error "Invalid backup file format"
        exit 1
    fi
    
    # Check if backup contains expected files
    if ! tar -tzf "$BACKUP_FILE" | grep -q "MANIFEST.txt"; then
        error "Backup file does not contain manifest"
        exit 1
    fi
    
    log "Backup file validation passed"
}

# Extract backup
extract_backup() {
    log "Extracting backup to temporary directory..."
    
    # Clean up any existing restore directory
    rm -rf "$RESTORE_DIR"
    mkdir -p "$RESTORE_DIR"
    
    # Extract backup
    tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"
    
    # Find the extracted directory
    EXTRACTED_DIR=$(find "$RESTORE_DIR" -name "leadminer_backup_*" -type d | head -n1)
    
    if [ -z "$EXTRACTED_DIR" ]; then
        error "Could not find extracted backup directory"
        exit 1
    fi
    
    log "Backup extracted to: $EXTRACTED_DIR"
}

# Display backup information
show_backup_info() {
    log "Backup Information:"
    echo "===================="
    
    if [ -f "$EXTRACTED_DIR/MANIFEST.txt" ]; then
        cat "$EXTRACTED_DIR/MANIFEST.txt"
    else
        warn "Manifest file not found"
    fi
    
    echo "===================="
}

# Confirm restore operation
confirm_restore() {
    if [ "$FORCE" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi
    
    echo
    warn "This will restore the Lead-Miner Agent from backup."
    warn "Current data will be replaced!"
    echo
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

# Stop services
stop_services() {
    log "Stopping Lead-Miner services..."
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would stop services with: docker-compose down"
        return 0
    fi
    
    if command -v docker-compose &> /dev/null; then
        docker-compose down || warn "Could not stop services gracefully"
    else
        warn "docker-compose not found, skipping service stop"
    fi
}

# Restore database
restore_database() {
    log "Restoring database..."
    
    if [ ! -f "$EXTRACTED_DIR/database.sql.gz" ]; then
        error "Database backup not found in backup"
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would restore database from: $EXTRACTED_DIR/database.sql.gz"
        return 0
    fi
    
    # Start only PostgreSQL service
    log "Starting PostgreSQL service..."
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Check if PostgreSQL is ready
    for i in {1..30}; do
        if docker-compose exec postgres pg_isready -U leadminer >/dev/null 2>&1; then
            log "PostgreSQL is ready"
            break
        fi
        
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to start within timeout"
            return 1
        fi
        
        sleep 2
    done
    
    # Restore database
    log "Restoring database from backup..."
    gunzip -c "$EXTRACTED_DIR/database.sql.gz" | docker-compose exec -T postgres psql -U leadminer -d leadminer
    
    if [ $? -eq 0 ]; then
        log "Database restored successfully"
    else
        error "Database restore failed"
        return 1
    fi
}

# Restore configuration
restore_config() {
    log "Restoring configuration files..."
    
    if [ ! -d "$EXTRACTED_DIR/config" ]; then
        error "Configuration backup not found in backup"
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would restore configuration from: $EXTRACTED_DIR/config"
        return 0
    fi
    
    # Restore Docker configuration
    if [ -f "$EXTRACTED_DIR/config/docker-compose.yml" ]; then
        cp "$EXTRACTED_DIR/config/docker-compose.yml" . || warn "Could not restore docker-compose.yml"
        log "Docker Compose configuration restored"
    fi
    
    if [ -f "$EXTRACTED_DIR/config/nginx.conf" ]; then
        cp "$EXTRACTED_DIR/config/nginx.conf" . || warn "Could not restore nginx.conf"
        log "Nginx configuration restored"
    fi
    
    if [ -f "$EXTRACTED_DIR/config/Dockerfile" ]; then
        cp "$EXTRACTED_DIR/config/Dockerfile" . || warn "Could not restore Dockerfile"
        log "Dockerfile restored"
    fi
    
    # Restore source configuration
    if [ -d "$EXTRACTED_DIR/config/config" ]; then
        mkdir -p src/
        cp -r "$EXTRACTED_DIR/config/config" src/ || warn "Could not restore source configuration"
        log "Source configuration restored"
    fi
    
    # Restore database schema
    if [ -f "$EXTRACTED_DIR/config/schema.sql" ]; then
        mkdir -p src/database/
        cp "$EXTRACTED_DIR/config/schema.sql" src/database/ || warn "Could not restore database schema"
        log "Database schema restored"
    fi
    
    # Show environment template
    if [ -f "$EXTRACTED_DIR/config/env.template" ]; then
        warn "Environment template found. You need to create .env.production manually:"
        echo "Template location: $EXTRACTED_DIR/config/env.template"
    fi
}

# Restore data
restore_data() {
    log "Restoring application data..."
    
    if [ ! -d "$EXTRACTED_DIR/data" ]; then
        warn "Data backup not found in backup"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would restore data from: $EXTRACTED_DIR/data"
        return 0
    fi
    
    # Create data directory
    mkdir -p data/
    
    # Restore data files
    if [ -d "$EXTRACTED_DIR/data" ]; then
        cp -r "$EXTRACTED_DIR/data/"* data/ 2>/dev/null || warn "Could not restore some data files"
        log "Application data restored"
    fi
    
    # Restore Redis data if Redis is running
    if [ -f "$EXTRACTED_DIR/data/redis.rdb" ]; then
        log "Redis data backup found"
        # Note: Redis data restoration requires Redis to be stopped
        # This is typically handled by the Redis container restart
    fi
}

# Start services
start_services() {
    log "Starting Lead-Miner services..."
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would start services with: docker-compose up -d"
        return 0
    fi
    
    # Start all services
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 15
    
    # Check service health
    log "Checking service health..."
    docker-compose ps
}

# Verify restore
verify_restore() {
    log "Verifying restore..."
    
    if [ "$DRY_RUN" = true ]; then
        info "DRY RUN: Would verify restore"
        return 0
    fi
    
    # Check if services are running
    if ! docker-compose ps | grep -q "Up"; then
        error "Services are not running properly"
        return 1
    fi
    
    # Check database connectivity
    if docker-compose exec postgres pg_isready -U leadminer >/dev/null 2>&1; then
        log "Database connectivity verified"
    else
        error "Database connectivity check failed"
        return 1
    fi
    
    # Check application health (if health endpoint exists)
    sleep 5
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log "Application health check passed"
    else
        warn "Application health check failed (this may be normal if health endpoint is not configured)"
    fi
    
    log "Restore verification completed"
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$RESTORE_DIR"
    log "Cleanup completed"
}

# Main restore function
main() {
    log "Starting Lead-Miner Agent restore process..."
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi
    
    # Validate backup file
    validate_backup
    
    # Extract backup
    extract_backup
    
    # Show backup information
    show_backup_info
    
    # Confirm restore
    confirm_restore
    
    # Stop services
    stop_services
    
    # Perform restore based on options
    if [ "$CONFIG_ONLY" = true ]; then
        restore_config
    elif [ "$DATABASE_ONLY" = true ]; then
        restore_database
    else
        # Full restore
        restore_database || exit 1
        restore_config
        restore_data
    fi
    
    # Start services (unless database-only or config-only)
    if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ]; then
        start_services
        verify_restore
    fi
    
    # Cleanup
    cleanup
    
    log "Restore process completed successfully!"
    
    if [ "$DRY_RUN" = false ]; then
        echo
        info "Next steps:"
        info "1. Update .env.production with your API keys and configuration"
        info "2. Check service logs: docker-compose logs -f"
        info "3. Verify system functionality"
        echo
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Run main function
main "$@" 