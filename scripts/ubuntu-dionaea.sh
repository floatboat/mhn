#!/bin/bash
# MHN Dionaea Honeypot Deployment Script (Ubuntu 18.04+)
# Usage: bash ubuntu-dionaea.sh <deploy_key> <server_url>
#
# This script deploys the Dionaea honeypot and configures it to report attacks to your MHN instance.
# It will install dependencies, compile Dionaea from source, configure HPFeeds, and register the sensor.
#
# Template Variables:
#   {deploy_key}   - Deployment key for sensor registration
#   {server_url}   - MHN server URL (e.g., https://mhn.example.com)
#   {sensor_uuid}  - Optional: Pre-assigned sensor UUID (generated if not provided)

set -e

# Configuration
DEPLOY_KEY="{deploy_key}"
SERVER_URL="{server_url}"
SENSOR_UUID="{sensor_uuid:-}"
HONEYPOT_TYPE="dionaea"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

# Validate inputs
if [ -z "$DEPLOY_KEY" ] || [ "$DEPLOY_KEY" = "{deploy_key}" ]; then
    log_error "Deploy key not provided. Please provide {deploy_key} variable."
    exit 1
fi

if [ -z "$SERVER_URL" ] || [ "$SERVER_URL" = "{server_url}" ]; then
    log_error "Server URL not provided. Please provide {server_url} variable."
    exit 1
fi

log_info "MHN Dionaea Deployment Script"
log_info "Server: $SERVER_URL"
log_info "Deploy Key: ${DEPLOY_KEY:0:10}..."

# Update system
log_info "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install dependencies
log_info "Installing dependencies..."
apt-get install -y \
    build-essential \
    python3-dev \
    python3-pip \
    git \
    libssl-dev \
    libffi-dev \
    libc6-dev \
    libcurl4 \
    libcurl4-openssl-dev \
    curl \
    libpcap-dev \
    libnl-dev \
    libnetfilter-queue-dev \
    libnetfilter-conntrack-dev \
    g++ \
    flex \
    bison \
    pkg-config \
    automake \
    autoconf \
    libtool \
    ethtool

# Clone Dionaea
log_info "Cloning Dionaea repository..."
cd /opt || exit 1
if [ ! -d "dionaea" ]; then
    git clone https://github.com/dionaea/dionaea.git
fi
cd dionaea || exit 1

# Build Dionaea
log_info "Building Dionaea from source..."
autoreconf -i
./configure --prefix=/opt/dionaea --with-python=/usr/bin/python3 --with-nl
make -j4
make install

# Create Dionaea user
log_info "Creating dionaea user..."
useradd -m -d /opt/dionaea dionaea || log_warn "User dionaea already exists"
chown -R dionaea:dionaea /opt/dionaea

# Generate sensor UUID if not provided
if [ -z "$SENSOR_UUID" ]; then
    log_info "Generating sensor UUID..."
    SENSOR_UUID=$(python3 -c "import uuid; print(str(uuid.uuid1()))")
fi

log_info "Sensor UUID: $SENSOR_UUID"

# Configure HPFeeds
log_info "Configuring HPFeeds..."
cat > /opt/dionaea/etc/dionaea/ihandlers/hpfeeds.conf << EOF
{
  "hpfeeds": {
    "enabled": true,
    "host": "${SERVER_URL}",
    "port": 10000,
    "ident": "${SENSOR_UUID}",
    "secret": "${DEPLOY_KEY}",
    "channels": ["dionaea.capture"]
  }
}
EOF

# Create systemd service
log_info "Creating systemd service..."
cat > /etc/systemd/system/dionaea.service << EOF
[Unit]
Description=Dionaea Honeypot
After=network.target

[Service]
Type=simple
User=dionaea
ExecStart=/opt/dionaea/bin/dionaea -c /opt/dionaea/etc/dionaea/dionaea.conf
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Enable and start Dionaea
log_info "Enabling Dionaea service..."
systemctl daemon-reload
systemctl enable dionaea
systemctl start dionaea

# Register with MHN
log_info "Registering sensor with MHN..."
curl -X POST "${SERVER_URL}/api/sensor" \
    -H "Content-Type: application/json" \
    -H "X-Deploy-Key: ${DEPLOY_KEY}" \
    -d "{
        \"uuid\": \"${SENSOR_UUID}\",
        \"name\": \"$(hostname)\",
        \"hostname\": \"$(hostname -f)\",
        \"honeypot\": \"${HONEYPOT_TYPE}\"
    }" \
    || log_warn "Failed to register sensor (this is OK if MHN is not yet configured)"

log_info ""
log_info "Dionaea deployment completed!"
log_info "Sensor UUID: $SENSOR_UUID"
log_info "Check logs: journalctl -u dionaea -f"
log_info ""
