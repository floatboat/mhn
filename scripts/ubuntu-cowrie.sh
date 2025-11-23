#!/bin/bash
# MHN Cowrie Honeypot Deployment Script (Ubuntu 18.04+)
# Usage: bash ubuntu-cowrie.sh <deploy_key> <server_url>
#
# This script deploys the Cowrie SSH/Telnet honeypot and configures it to report attacks to MHN.
# It creates an isolated user for Cowrie, installs dependencies, and configures HPFeeds output.
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
HONEYPOT_TYPE="cowrie"
COWRIE_PATH="/opt/cowrie"
COWRIE_USER="cowrie"

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

log_info "MHN Cowrie Deployment Script"
log_info "Server: $SERVER_URL"
log_info "Deploy Key: ${DEPLOY_KEY:0:10}..."

# Update system
log_info "Updating system packages..."
apt-get update
apt-get upgrade -y

# Install dependencies
log_info "Installing dependencies..."
apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-venv \
    libssl-dev \
    libffi-dev \
    build-essential \
    curl \
    netcat-openbsd \
    openssh-client \
    telnet

# Create Cowrie user
log_info "Creating cowrie user..."
useradd -m -d $COWRIE_PATH $COWRIE_USER || log_warn "User $COWRIE_USER already exists"

# Clone Cowrie
log_info "Cloning Cowrie repository..."
cd /opt || exit 1
if [ ! -d "cowrie" ]; then
    git clone https://github.com/cowrie/cowrie.git
    chown -R $COWRIE_USER:$COWRIE_USER cowrie
fi

cd cowrie || exit 1

# Install Cowrie dependencies
log_info "Installing Cowrie Python dependencies..."
sudo -u $COWRIE_USER python3 -m venv venv
sudo -u $COWRIE_USER /bin/bash -c "source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt"

# Generate sensor UUID if not provided
if [ -z "$SENSOR_UUID" ]; then
    log_info "Generating sensor UUID..."
    SENSOR_UUID=$(python3 -c "import uuid; print(str(uuid.uuid1()))")
fi

log_info "Sensor UUID: $SENSOR_UUID"

# Configure Cowrie
log_info "Configuring Cowrie..."
cat > $COWRIE_PATH/etc/cowrie.conf.d/mhn.conf << EOF
[output_hpfeeds]
enabled = true
host = ${SERVER_URL#https://}
port = 10000
ident = ${SENSOR_UUID}
secret = ${DEPLOY_KEY}
channel = cowrie.sessions

[output_file]
enabled = true

[output_jsonlog]
enabled = true
EOF

# Configure SSH settings
log_info "Configuring SSH honeypot..."
cat >> $COWRIE_PATH/etc/cowrie.conf.d/mhn.conf << EOF

[honeypot]
hostname = $(hostname)
ssh_port = 2222
telnet_port = 2223
listen_endpoints = 0.0.0.0

[backend_pool]
enabled = false
EOF

# Create systemd service
log_info "Creating systemd service..."
cat > /etc/systemd/system/cowrie.service << EOF
[Unit]
Description=Cowrie SSH/Telnet Honeypot
After=network.target

[Service]
Type=simple
User=$COWRIE_USER
WorkingDirectory=$COWRIE_PATH
ExecStart=$COWRIE_PATH/venv/bin/cowrie -c $COWRIE_PATH/etc/cowrie.conf start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
EOF

# Redirect standard SSH port traffic to Cowrie
log_info "Configuring port forwarding (22 -> 2222)..."
iptables -t nat -A PREROUTING -p tcp --dport 22 -j REDIRECT --to-port 2222 || log_warn "Could not configure iptables (may require manual setup)"

# Enable and start Cowrie
log_info "Enabling Cowrie service..."
systemctl daemon-reload
systemctl enable cowrie
systemctl start cowrie

# Wait for service to start
sleep 5

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
log_info "Cowrie deployment completed!"
log_info "Sensor UUID: $SENSOR_UUID"
log_info "SSH honeypot listening on port 2222"
log_info "Check logs: journalctl -u cowrie -f"
log_info ""
