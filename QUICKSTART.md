# MHN Quick Start Guide

Get the Modern Honey Network system up and running in minutes with this quick reference guide.

## ⚡ 5-Minute Docker Start

The fastest way to get MHN running with all services:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/mhn.git
cd mhn

# 2. Start all services
docker-compose up -d

# 3. Wait for services to initialize (about 60 seconds)
sleep 60

# 4. Create admin account
docker-compose exec api npm run seed

# 5. Access the system
echo "API:     http://localhost:3000"
echo "Web UI:  http://localhost"
echo "Admin:   admin@example.com / password123"
```

That's it! MHN is now running.

## ✅ Verify Everything is Working

```bash
# Check all services are running
docker-compose ps

# Expected output should show all services as "Up"
# postgres, mongodb, redis, api, web, nginx

# Test API health
curl http://localhost:3000/health

# Should return: {"status":"ok","timestamp":"..."}

# Test web UI
open http://localhost  # or visit in browser
# Login with: admin@example.com / password123
```

## 🚀 Common Tasks

### Register a Honeypot Sensor

```bash
# 1. Get your deploy key (check API key in database, or use default)
DEPLOY_KEY="your-deploy-key"
SERVER_URL="http://localhost"

# 2. Get a deployment script
curl -X POST http://localhost:3000/api/deployscript/1/render \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "server_url": "'$SERVER_URL'",
      "deploy_key": "'$DEPLOY_KEY'",
      "sensor_uuid": "550e8400-e29b-41d4-a716-446655440000"
    }
  }' > deploy.sh

# 3. Execute on target system
bash deploy.sh
```

### Create API Key

```bash
# Login first
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }' | jq -r .accessToken)

# Create API key
curl -X POST http://localhost:3000/api/apikey \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .apiKey
```

### View Attack Data

```bash
# Get your API key
API_KEY="your-api-key"

# List recent attacks
curl "http://localhost:3000/api/attack?hours=24" \
  -H "Authorization: Bearer $API_KEY" | jq .

# Get attack statistics
curl http://localhost:3000/api/attack/stats \
  -H "Authorization: Bearer $API_KEY" | jq .

# Get geographic data
curl http://localhost:3000/api/attack/geo \
  -H "Authorization: Bearer $API_KEY" | jq .
```

## 📁 Project Structure at a Glance

```
mhn/
├── api/              # Backend API (Fastify)
├── web/              # Frontend (Next.js)
├── scripts/          # Deployment scripts (Dionaea, Cowrie, etc)
├── docs/             # Full documentation
├── docker-compose.yml # Services configuration
├── README.md         # Full documentation
└── QUICKSTART.md     # This file
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Change port in docker-compose.yml
# Change the first number in ports: "8080:3000"
docker-compose down
docker-compose up -d
```

### Services Not Starting

```bash
# Check logs
docker-compose logs -f

# Restart specific service
docker-compose restart api

# Full restart
docker-compose down && docker-compose up -d
```

### Can't Access Web UI

```bash
# Wait a bit longer for services to fully start
sleep 30

# Check if web service is running
docker-compose ps web

# Check web service logs
docker-compose logs web
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check database exists
docker-compose exec postgres psql -U api_user -l

# If needed, delete everything and start fresh
docker-compose down -v
docker-compose up -d
sleep 60
```

## 📚 Next Steps

- **Full Setup**: See [README.md](README.md) for complete documentation
- **Development**: See [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)
- **Deployment**: See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **API Reference**: See [README.md#api-documentation](README.md#api-documentation)
- **Troubleshooting**: See [README.md#troubleshooting](README.md#troubleshooting)

## 🎯 Key URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Web UI | http://localhost | Dashboard & management UI |
| API | http://localhost:3000 | REST API endpoints |
| Health | http://localhost:3000/health | API health check |
| Readiness | http://localhost:3000/readiness | K8s readiness probe |
| PostgreSQL | localhost:5432 | Database |
| MongoDB | localhost:27017 | Attack data |
| Redis | localhost:6379 | Cache |

## 💡 Pro Tips

### Use jq for Pretty JSON
```bash
# Install jq
brew install jq  # macOS
sudo apt-get install jq  # Ubuntu

# Use with API calls
curl http://localhost:3000/api/sensor \
  -H "Authorization: Bearer $API_KEY" | jq .
```

### Export Data
```bash
# Export as JSON
curl http://localhost:3000/api/export/json \
  -H "Authorization: Bearer $API_KEY" > attacks.json

# Export as CSV
curl http://localhost:3000/api/export/csv \
  -H "Authorization: Bearer $API_KEY" > attacks.csv
```

### Monitor Logs
```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f api

# Last 50 lines
docker-compose logs --tail=50
```

### Check Performance
```bash
# Monitor container resources
docker stats

# Check database connections
docker-compose exec postgres psql -U api_user -d mhn \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

## 🔐 Security Reminders

- **Change the admin password** after first login
- **Generate new JWT_SECRET** in .env
- **Rotate API keys** regularly
- **Enable SSL/TLS** for production (see DEPLOYMENT.md)
- **Keep Docker images updated**
- **Review firewall rules**

## 📞 Need Help?

1. Check the [Troubleshooting](README.md#troubleshooting) section
2. Review [Known Issues](docs/KNOWN_ISSUES.md)
3. Check container logs: `docker-compose logs`
4. Enable debug mode: Set `LOG_LEVEL=debug` in .env

---

**Welcome to MHN! 🎉**

You now have a fully functional honeypot management platform. Start deploying honeypots and monitoring attacks!
