# Deployment Guide

This guide covers deploying the MHN TypeScript rewrite following the original MHN's self-hosted deployment model.

## Table of Contents

1. [Quick Start (Local Development)](#quick-start-local-development)
2. [Production Deployment](#production-deployment)
3. [Docker Compose Services](#docker-compose-services)
4. [Configuration Management](#configuration-management)
5. [Backup & Recovery](#backup--recovery)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)
8. [Scaling & HA](#scaling--ha)

---

## Quick Start (Local Development)

Get the entire MHN stack running in 5 minutes.

### Prerequisites

- Docker & Docker Compose (version 3.9+)
- 4GB RAM minimum (2GB per main service)
- 10GB disk space for databases
- Git

### Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd mhn

# 2. Copy environment template and customize (optional for dev)
cp .env.template .env

# 3. Build images
docker-compose build

# 4. Start all services
docker-compose up -d

# 5. Wait for services to be healthy
docker-compose ps
# All services should show "healthy" or "up"

# 6. Access application
# Frontend: http://localhost
# API: http://localhost/api
# API Docs: http://localhost/api/documentation
```

### Verify Installation

```bash
# Check service health
curl http://localhost/health

# View logs
docker-compose logs -f api

# Access database
docker-compose exec postgres psql -U api_user -d agave

# Access MongoDB
docker-compose exec mongodb mongosh -u mongodb_user -p
```

---

## Production Deployment

For self-hosted production on a single server.

### System Requirements

- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU:** 2+ cores (4+ recommended)
- **RAM:** 8GB minimum (12GB+ recommended)
- **Disk:** 50GB SSD minimum (100GB+ recommended)
- **Network:** Static IP, firewall rules for ports 80/443

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Add your user to docker group (requires login/logout)
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone Repository

```bash
# Clone to deployment directory
git clone <repo-url> /opt/mhn
cd /opt/mhn

# Set proper permissions
sudo chown -R $USER:$USER /opt/mhn
```

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.template .env

# Edit with production values
nano .env
```

**Key production settings:**

```env
# Database - Use strong passwords!
DATABASE_URL="postgresql://api_user:$(openssl rand -base64 24)@postgres:5432/agave"
MONGODB_URI="mongodb://mongodb_user:$(openssl rand -base64 24)@mongodb:27017/mhn?authSource=admin"

# Secrets - Generate new ones!
JWT_SECRET="$(openssl rand -base64 32)"
DEPLOY_KEY="$(openssl rand -hex 32)"

# Server URLs
NEXT_PUBLIC_API_URL="https://your-domain.com/api"

# Email - Configure your provider
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"

# Logging
NODE_ENV="production"
LOG_LEVEL="info"
PINO_PRETTY="false"

# Security
CORS_ORIGIN="https://your-domain.com"
```

### Step 4: Set Up HTTPS/SSL

Option A: Use Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates to mhn directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/mhn/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/mhn/ssl/key.pem
sudo chown $USER:$USER /opt/mhn/ssl/*

# Set up auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

Option B: Use Self-Signed Certificate (Development Only)

```bash
# Generate self-signed certificate
mkdir -p ssl
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

### Step 5: Enable HTTPS in Nginx

Edit `nginx.conf`:

```nginx
# Uncomment the HTTPS server block
# Update certificate paths to your SSL files
# Set your domain name in server_name directive
```

### Step 6: Build & Start Services

```bash
# Build images (one-time)
docker-compose build

# Start all services in background
docker-compose up -d

# Monitor startup
docker-compose logs -f

# Verify all services are healthy
docker-compose ps
```

Expected output:
```
NAME         STATUS              PORTS
postgres     Up (healthy)        5432
mongodb      Up (healthy)        27017
redis        Up (healthy)        6379
api          Up (healthy)        3000
web          Up (healthy)        3001
nginx        Up (healthy)        80, 443
```

### Step 7: Create Admin User

```bash
# Connect to API container
docker-compose exec api sh

# Create superuser (inside container)
npm run create-superuser admin@example.com password123

# Exit container
exit
```

### Step 8: Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct API access (use nginx reverse proxy)
# sudo ufw deny 3000/tcp
# sudo ufw deny 3001/tcp

# Enable firewall
sudo ufw enable
```

---

## Docker Compose Services

### Service Overview

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **postgres** | postgres:14 | 5432 | Relational database |
| **mongodb** | mongo:7.0 | 27017 | Attack data storage |
| **redis** | redis:7.2 | 6379 | Cache & job queue |
| **api** | custom | 3000 | Fastify API server |
| **web** | custom | 3001 | Next.js frontend |
| **nginx** | nginx:alpine | 80/443 | Reverse proxy & SSL |

### Service Health Checks

Each service has health checks configured:

```bash
# View health status
docker-compose ps

# Check specific service
docker-compose exec api curl http://localhost:3000/health

# View detailed logs
docker-compose logs postgres | grep "FATAL\|ERROR"
```

### Service Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart api

# View logs
docker-compose logs -f api

# Scale service (if applicable)
docker-compose up -d --scale api=2
```

---

## Configuration Management

### Environment Variables

All configuration is done via environment variables in `.env` file.

See `.env.template` for full list of options.

**Important variables:**

- `DATABASE_URL` - PostgreSQL connection
- `MONGODB_URI` - MongoDB connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing key (change in production!)
- `DEPLOY_KEY` - Sensor registration key (change in production!)
- `NEXT_PUBLIC_API_URL` - Frontend API URL
- `CORS_ORIGIN` - Allowed origins
- `NODE_ENV` - Environment (development/production)

### Updating Configuration

```bash
# Edit .env
nano .env

# Restart affected services
docker-compose restart api web nginx
```

### Secrets Management (Production)

For production, use Docker secrets instead of .env:

```bash
# Create Docker secret
echo "your-jwt-secret" | docker secret create jwt_secret -

# Reference in docker-compose.yml
secrets:
  jwt_secret:
    external: true
```

Or use external secret management:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault

---

## Backup & Recovery

### Automated Daily Backups

Create `/opt/mhn/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/mhn"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose exec -T postgres pg_dump -U api_user agave | gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# Backup MongoDB
docker-compose exec -T mongodb mongodump --uri "mongodb://mongodb_user:password@localhost:27017" --out $BACKUP_DIR/mongodb_$DATE

# Compress MongoDB backup
tar -czf $BACKUP_DIR/mongodb_$DATE.tar.gz $BACKUP_DIR/mongodb_$DATE
rm -rf $BACKUP_DIR/mongodb_$DATE

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR"
```

Schedule with cron:

```bash
# Add to crontab
crontab -e

# Daily backup at 2:00 AM
0 2 * * * /opt/mhn/backup.sh >> /var/log/mhn-backup.log 2>&1
```

### Restore from Backup

```bash
# Restore PostgreSQL
gunzip -c /backups/mhn/postgres_20240101_020000.sql.gz | \
  docker-compose exec -T postgres psql -U api_user agave

# Restore MongoDB
docker-compose exec -T mongodb mongorestore \
  --uri "mongodb://mongodb_user:password@localhost:27017" \
  /backup/mongodb_dump
```

### Backup to Remote Storage

Upload backups to S3, Google Cloud Storage, or similar:

```bash
# Add to backup.sh after backup creation
aws s3 cp $BACKUP_DIR/postgres_$DATE.sql.gz s3://your-bucket/mhn-backups/
```

---

## Monitoring & Logging

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api

# Since specific time
docker-compose logs --since 2024-01-01T00:00:00 api
```

### Centralized Logging (Optional)

Forward logs to ELK stack or similar:

1. Add Fluent-bit container to docker-compose.yml
2. Configure input (docker logs) and output (Elasticsearch)
3. View logs in Kibana

### Metrics & Monitoring (Optional)

1. **Prometheus:** Scrape metrics from `/metrics` endpoint
2. **Grafana:** Create dashboards for visualization
3. **AlertManager:** Configure alerts for errors/outages

Example Prometheus config:

```yaml
scrape_configs:
  - job_name: 'mhn-api'
    static_configs:
      - targets: ['localhost:9090']
```

### Health Check Monitoring

Set up monitoring for:
- `/health` endpoint (load balancer health)
- `/health/deep` endpoint (full service health)
- Database connectivity
- Disk usage
- CPU/RAM usage

---

## Troubleshooting

### Services Won't Start

```bash
# Check docker daemon
sudo systemctl status docker

# View detailed error logs
docker-compose logs api
docker-compose logs postgres

# Check resource usage
docker stats

# Increase log level for debugging
# Edit .env: LOG_LEVEL=debug
# Restart: docker-compose restart api
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker-compose exec api psql -h postgres -U api_user -d agave -c "SELECT 1"

# Check PostgreSQL logs
docker-compose logs postgres

# Verify credentials match docker-compose.yml
grep "POSTGRES_" docker-compose.yml
grep "DATABASE_URL" .env
```

### Frontend Can't Reach API

```bash
# Check API is running
curl http://localhost:3000/health

# Check API_URL in frontend
curl http://localhost:3001
# Browser should show correct NEXT_PUBLIC_API_URL

# Check nginx routing
docker-compose exec nginx curl http://api:3000/health

# Check CORS configuration
curl -H "Origin: http://localhost" -H "Access-Control-Request-Method: GET" \
     http://localhost/api/user
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Find large files
du -sh /var/lib/docker/volumes/*

# Clean up Docker data
docker system prune -a --volumes

# Or manually clean volumes
docker-compose down -v
```

### Service Crashes on Startup

```bash
# Check for errors
docker-compose logs api

# Common issues:
# 1. Port already in use: docker ps | grep -E "3000|3001"
# 2. Database not ready: Wait and retry
# 3. Invalid environment variables: Check .env syntax

# Solution: Kill conflicting process
sudo lsof -i :3000
sudo kill -9 <PID>
```

---

## Scaling & HA

### Single Server (Current)

Current docker-compose.yml supports single-server deployment with all services on one machine.

**Limitations:**
- No redundancy
- No load distribution
- Manual recovery from failures

### Docker Swarm (2-3 servers)

Scale to multiple servers with Docker Swarm:

```bash
# Initialize swarm on manager node
docker swarm init

# Join worker nodes
docker swarm join --token WORKER_TOKEN MANAGER_IP:2377

# Deploy stack
docker stack deploy -c docker-compose.yml mhn
```

**Improvements:**
- Service replication across nodes
- Automatic failover
- Load balancing via Swarm ingress

### Kubernetes (5+ servers, future)

For large-scale deployments:

1. Create Helm charts for each service
2. Configure StatefulSets for databases
3. Use PersistentVolumes for data
4. Set up ingress controller
5. Configure autoscaling policies

---

## Maintenance

### Regular Tasks

**Weekly:**
- Check disk usage: `docker system df`
- Verify backups: `ls -la /backups/mhn/`
- Review logs for errors: `docker-compose logs | grep ERROR`

**Monthly:**
- Update Docker images: `docker-compose pull`
- Test restore procedure (dry-run)
- Review resource utilization

**Quarterly:**
- Security updates for OS
- Database maintenance (VACUUM, ANALYZE)
- Disaster recovery drill

### Update Procedure

```bash
# 1. Backup current state
/opt/mhn/backup.sh

# 2. Pull latest code
cd /opt/mhn
git pull origin main

# 3. Rebuild images
docker-compose build

# 4. Restart services (zero-downtime)
docker-compose up -d --no-deps --build api web

# 5. Verify services are healthy
docker-compose ps
curl http://localhost/health
```

---

## Glossary

- **RTO (Recovery Time Objective)** - Max acceptable downtime
- **RPO (Recovery Point Objective)** - Max acceptable data loss
- **HA (High Availability)** - Continuous operation without single point of failure
- **Failover** - Automatic switch to backup system
- **Blue-Green Deployment** - Run two identical production environments

---

**Last Updated:** 2025-11-23
