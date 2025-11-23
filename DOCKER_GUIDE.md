# MHN Docker Guide

Complete guide to running, managing, and troubleshooting MHN using Docker and Docker Compose.

## Prerequisites

- **Docker Engine** 20.10+
- **Docker Compose** 2.0+
- **System Resources:**
  - Minimum: 4GB RAM, 20GB disk
  - Recommended: 8GB RAM, 50GB disk
- **Ports:** 80 (HTTP), 443 (HTTPS), 3000 (API)

### Installation

#### macOS
```bash
# Install Docker Desktop (includes Docker and Docker Compose)
brew install --cask docker

# Or download from https://www.docker.com/products/docker-desktop

# Verify installation
docker --version
docker-compose --version
```

#### Linux (Ubuntu/Debian)
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group (optional, avoids needing sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### Windows
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Includes Docker and Docker Compose

# Verify in PowerShell
docker --version
docker-compose --version
```

---

## Starting and Stopping Services

### Start All Services

```bash
# Start in background
docker-compose up -d

# View output
docker-compose logs -f

# Expected output:
# postgres is up (5432/tcp)
# mongodb is up (27017/tcp)
# redis is up (6379/tcp)
# api is running (3000/tcp)
# web is running (3000/tcp)
# nginx is ready (80/tcp, 443/tcp)
```

### Verify Services Are Running

```bash
# Check all services
docker-compose ps

# Expected output:
# NAME          COMMAND                  STATUS
# api           node dist/index.js        Up 2 minutes
# web           npm start                 Up 2 minutes
# postgres      postgres                  Up 3 minutes
# mongodb       /opt/mongod               Up 3 minutes
# redis         redis-server              Up 3 minutes
# nginx         nginx -g daemon off;      Up 2 minutes
```

### Stop Services

```bash
# Graceful stop (preserves data)
docker-compose stop

# Stop specific service
docker-compose stop api

# Stop and remove containers (preserves volumes)
docker-compose down

# Complete cleanup (removes containers and volumes)
docker-compose down -v
```

---

## Building Images

### Build All Images

```bash
# Build from docker-compose.yml
docker-compose build

# Build with no cache (fresh build)
docker-compose build --no-cache

# Build specific service
docker-compose build api
```

### Verify Images Were Built

```bash
# List Docker images
docker images | grep mhn

# Expected output:
# mhn-api        latest    abc123...    5 minutes ago    500MB
# mhn-web        latest    def456...    5 minutes ago    200MB
```

### Push Images to Registry (Production)

```bash
# Login to registry
docker login registry.example.com

# Tag images
docker tag mhn-api registry.example.com/mhn-api:1.0.0
docker tag mhn-web registry.example.com/mhn-web:1.0.0

# Push images
docker push registry.example.com/mhn-api:1.0.0
docker push registry.example.com/mhn-web:1.0.0
```

---

## Container Management

### Access Container Shell

```bash
# API container
docker-compose exec api sh

# Exit shell
exit

# PostgreSQL shell
docker-compose exec postgres psql -U api_user -d mhn

# MongoDB shell
docker-compose exec mongodb mongosh

# Redis shell
docker-compose exec redis redis-cli
```

### View Container Logs

```bash
# All services
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f api

# Follow specific service
docker-compose logs -f --timestamps api

# Show logs from specific time
docker-compose logs --since 10m api
```

### Monitor Container Resources

```bash
# Real-time resource usage
docker stats

# Exit with Ctrl+C

# Save stats to file
docker stats --no-stream > stats.txt
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api

# Restart and check logs
docker-compose restart api && docker-compose logs -f api
```

---

## Configuration

### Environment Variables

#### Create .env File

```bash
# Copy template
cp .env.template .env

# Edit configuration
nano .env
```

#### Important Variables

```bash
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://api_user:password@postgres:5432/mhn"
MONGO_URL="mongodb://mongodb:27017/mhn"
REDIS_URL="redis://redis:6379"

# Security
JWT_SECRET=your-secret-key-min-32-chars
DEPLOY_KEY=your-deploy-key

# Apply changes
docker-compose restart api
```

### Docker Compose Configuration

#### Change Ports

```yaml
# docker-compose.yml
services:
  nginx:
    ports:
      - "8080:80"      # Access on http://localhost:8080
      - "8443:443"     # Access on https://localhost:8443

  api:
    ports:
      - "3001:3000"    # API on http://localhost:3001
```

#### Change Resource Limits

```yaml
# Limit memory per service
services:
  api:
    mem_limit: 1g

  postgres:
    mem_limit: 2g

  mongodb:
    mem_limit: 1g
```

#### Add Environment Variables

```yaml
# Override in compose file
services:
  api:
    environment:
      - LOG_LEVEL=debug
      - NODE_ENV=development
```

#### Volume Mounts (Persistent Data)

```bash
# Default volumes in docker-compose.yml
volumes:
  postgres_data:  # PostgreSQL data
  mongo_data:     # MongoDB data

# Backup volumes
docker-compose exec postgres pg_dump -U api_user mhn > backup.sql

# Restore from backup
docker-compose exec postgres psql -U api_user mhn < backup.sql
```

---

## Networking

### Container-to-Container Communication

```bash
# Containers can communicate using service names
# Examples from inside containers:
# - postgres:5432
# - mongodb:27017
# - redis:6379
# - api:3000

# Test connectivity
docker-compose exec api ping postgres
docker-compose exec api ping redis
```

### Port Mapping

```bash
# External:Internal port mapping
# "8080:80" means:
# - Port 8080 on host machine
# - Maps to port 80 inside container

# Example requests:
curl http://localhost:80    # Nginx
curl http://localhost:3000  # API (direct)
```

### Custom Networks

```bash
# Create custom network (optional)
docker network create mhn-network

# Connect containers to network
docker-compose -f docker-compose.yml up -d

# List networks
docker network ls

# Inspect network
docker network inspect mhn-network
```

---

## Database Management

### PostgreSQL Operations

```bash
# Connect to database
docker-compose exec postgres psql -U api_user -d mhn

# List databases
\l

# List tables
\dt

# Run SQL query
SELECT * FROM "User" LIMIT 5;

# Exit
\q
```

### MongoDB Operations

```bash
# Connect to MongoDB
docker-compose exec mongodb mongosh

# Show databases
show dbs

# Use database
use mhn

# Show collections
show collections

# Query data
db.attack_events.find().limit(5)

# Exit
exit
```

### Database Backup and Restore

```bash
# PostgreSQL backup
docker-compose exec postgres pg_dump -U api_user mhn > mhn-backup.sql

# PostgreSQL restore
docker-compose exec postgres psql -U api_user mhn < mhn-backup.sql

# MongoDB backup
docker-compose exec mongodb mongodump --uri "mongodb://mongodb:27017/mhn" \
  --out /backup

# MongoDB restore
docker-compose exec mongodb mongorestore --uri "mongodb://mongodb:27017" \
  /backup
```

---

## Monitoring and Troubleshooting

### Health Checks

```bash
# API health
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}

# Readiness probe
curl http://localhost:3000/readiness
# {"status":"ready","checks":{"database":true,"mongodb":true,"redis":true}}

# Check each service
curl http://localhost:3000/liveness
```

### Common Issues

#### Port Already in Use

```bash
# Find process using port
lsof -i :3000
netstat -tulpn | grep 3000

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml and restart
```

#### Service Won't Start

```bash
# Check logs
docker-compose logs api

# Common causes:
# 1. Port conflict - change port in docker-compose.yml
# 2. Insufficient memory - increase Docker memory
# 3. Environment variables missing - check .env file
# 4. Database not ready - wait 30 seconds and retry

# Solution: Full restart
docker-compose down
docker-compose up -d
sleep 30
docker-compose ps
```

#### Database Connection Failed

```bash
# Check database service
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U api_user -d mhn -c "SELECT 1"

# If not working, recreate volume
docker-compose down -v
docker-compose up -d
```

#### Memory Issues

```bash
# Check memory usage
docker stats

# If API uses too much memory:
1. Reduce max heap size in docker-compose.yml
   environment:
     - NODE_OPTIONS=--max-old-space-size=512

2. Restart service
   docker-compose restart api

# Or increase Docker's total memory
# Settings → Resources → Memory (Docker Desktop)
```

#### Network Issues

```bash
# Test container connectivity
docker-compose exec api ping redis
docker-compose exec api ping postgres
docker-compose exec api ping mongodb

# Check network
docker network inspect mhn-network

# Restart networking
docker-compose restart
```

### Performance Optimization

#### Enable Caching

```bash
# Redis is already running
# Services use it automatically

# Check Redis is working
docker-compose exec redis redis-cli ping
# Should return: PONG

# View cache statistics
docker-compose exec redis redis-cli info stats
```

#### Database Query Optimization

```bash
# Check slow queries
docker-compose exec postgres psql -U api_user -d mhn

# Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

# View logs
docker-compose logs postgres | grep ERROR
```

#### Monitor API Performance

```bash
# Check API response times
docker-compose logs api | grep "response"

# Monitor API memory
docker stats api

# Load test
k6 run load-test.js
```

---

## Production Deployment

### Security Hardening

```yaml
# docker-compose.yml - Production settings
services:
  api:
    restart: always        # Auto-restart on failure
    container_name: mhn-api
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn     # Reduce logging

  postgres:
    restart: always
    environment:
      - POSTGRES_PASSWORD=<STRONG_PASSWORD>  # Change!
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Persistent

  nginx:
    restart: always
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt  # SSL certificates
```

### Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)

# Backup PostgreSQL
docker-compose exec postgres pg_dump -U api_user mhn \
  > /backups/mhn-$DATE.sql

# Backup MongoDB
docker-compose exec mongodb mongodump \
  --uri "mongodb://mongodb:27017/mhn" \
  --out /backups/mhn-$DATE-mongo

# Cleanup old backups
find /backups -mtime +30 -delete  # Keep 30 days

# Compress
gzip /backups/mhn-$DATE.sql
```

### Update Services

```bash
# Check for image updates
docker-compose pull

# Rebuild and restart
docker-compose up -d --build

# Verify update
docker-compose ps
docker-compose logs -f api
```

### Multi-Instance Deployment

```yaml
# docker-compose.yml - Multiple API instances
services:
  api-1:
    image: mhn-api:latest
    ports:
      - "3001:3000"

  api-2:
    image: mhn-api:latest
    ports:
      - "3002:3000"

  nginx:
    # Routes to both instances
    upstream api {
      server api-1:3000;
      server api-2:3000;
    }
```

---

## Kubernetes Deployment

### Export to Kubernetes

```bash
# Convert docker-compose to k8s
kompose convert -f docker-compose.yml -o k8s/

# Create namespace
kubectl create namespace mhn

# Deploy services
kubectl apply -f k8s/ -n mhn

# Verify
kubectl get pods -n mhn
kubectl logs -n mhn -f deployment/api
```

### Health Checks for Kubernetes

```yaml
# Kubernetes deployment uses built-in health checks
livenessProbe:
  httpGet:
    path: /liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /readiness
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## Useful Docker Commands

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi mhn-api:latest

# Tag image
docker tag mhn-api:latest mhn-api:v1.0.0

# Build from Dockerfile
docker build -t mhn-api:latest -f api/Dockerfile api/
```

### Container Management

```bash
# List containers
docker ps -a

# Remove container
docker rm mhn-api

# Copy files from container
docker cp mhn-api:/app/logs ./logs

# Copy files to container
docker cp ./file.txt mhn-api:/app/
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect mhn_postgres_data

# Remove volume
docker volume rm mhn_postgres_data

# Backup volume
docker run --rm -v mhn_postgres_data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/volume.tar.gz -C /data .
```

### Network Management

```bash
# List networks
docker network ls

# Inspect network
docker network inspect mhn-network

# Create network
docker network create mhn-custom

# Connect container to network
docker network connect mhn-custom mhn-api
```

---

## Docker Compose Cheatsheet

```bash
# Build services
docker-compose build

# Build without cache
docker-compose build --no-cache

# Build specific service
docker-compose build api

# Start services
docker-compose up -d

# Start with build
docker-compose up -d --build

# Start single service
docker-compose up -d api

# Stop services
docker-compose stop

# Restart services
docker-compose restart

# Remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# View services
docker-compose ps

# View logs
docker-compose logs -f

# Execute command
docker-compose exec api npm test

# View configuration
docker-compose config

# Validate configuration
docker-compose config --quiet
```

---

## Environment Variables Reference

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database URLs (use service names in docker-compose)
DATABASE_URL=postgresql://api_user:password@postgres:5432/mhn
MONGO_URL=mongodb://mongodb:27017/mhn
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-secret-key-min-32-characters
JWT_EXPIRES_IN=7d
DEPLOY_KEY=your-deploy-key-min-20-chars

# HPFeeds Configuration
HPFEEDS_BROKER_HOST=localhost
HPFEEDS_BROKER_PORT=10000

# Email Configuration
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@mhn.example.com

# Splunk Integration
SPLUNK_HEC_URL=https://splunk.example.com:8088
SPLUNK_HEC_TOKEN=your-token

# Elasticsearch Integration
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
```

---

## Troubleshooting Checklist

- [ ] Docker is running: `docker ps`
- [ ] All services healthy: `docker-compose ps`
- [ ] .env file exists: `cat .env | head`
- [ ] API responds: `curl http://localhost:3000/health`
- [ ] Database connected: `docker-compose logs postgres`
- [ ] No port conflicts: `lsof -i :3000`
- [ ] Sufficient disk space: `df -h`
- [ ] Sufficient RAM: `docker stats`

---

**Last Updated:** 2025-11-23
**Docker Version:** 20.10+
**Docker Compose Version:** 2.0+
