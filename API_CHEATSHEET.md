# MHN API Cheatsheet

Quick reference for all MHN API endpoints with curl examples.

**Base URL:** `http://localhost:3000/api`
**Authentication:** Bearer token in `Authorization` header
**Content-Type:** `application/json`

## Authentication

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'

# Save the accessToken
export TOKEN="<accessToken>"
```

### Get Current User
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Refresh Token
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN"
```

---

## Users & Roles

### List Users
```bash
curl http://localhost:3000/api/user \
  -H "Authorization: Bearer $TOKEN"
```

### Get User Details
```bash
curl http://localhost:3000/api/user/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Create User (Admin)
```bash
curl -X POST http://localhost:3000/api/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "name": "newuser",
    "password": "securepassword123"
  }'
```

### Update User
```bash
curl -X PUT http://localhost:3000/api/user/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "name": "newname"
  }'
```

### Delete User (Admin)
```bash
curl -X DELETE http://localhost:3000/api/user/1 \
  -H "Authorization: Bearer $TOKEN"
```

### List Roles (Admin)
```bash
curl http://localhost:3000/api/role \
  -H "Authorization: Bearer $TOKEN"
```

### Create Role (Admin)
```bash
curl -X POST http://localhost:3000/api/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "analyst",
    "description": "Security analyst role"
  }'
```

---

## API Keys

### Create API Key
```bash
curl -X POST http://localhost:3000/api/apikey \
  -H "Authorization: Bearer $TOKEN"

# Save the apiKey for later use
```

### List API Keys
```bash
curl http://localhost:3000/api/apikey \
  -H "Authorization: Bearer $TOKEN"
```

### Delete API Key
```bash
curl -X DELETE http://localhost:3000/api/apikey/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Use API Key for Requests
```bash
# Set as Bearer token
API_KEY="<apiKey>"

curl http://localhost:3000/api/sensor \
  -H "Authorization: Bearer $API_KEY"
```

---

## Sensors

### Register Sensor (Deploy Key)
```bash
curl -X POST http://localhost:3000/api/sensor \
  -H "X-Deploy-Key: your-deploy-key" \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "honeypot-01",
    "hostname": "honeypot-01.example.com",
    "honeypot": "dionaea"
  }'
```

### List Sensors
```bash
curl http://localhost:3000/api/sensor \
  -H "Authorization: Bearer $API_KEY"

# With filters
curl "http://localhost:3000/api/sensor?type=dionaea" \
  -H "Authorization: Bearer $API_KEY"

curl "http://localhost:3000/api/sensor?active=true" \
  -H "Authorization: Bearer $API_KEY"
```

### Get Sensor Details
```bash
curl http://localhost:3000/api/sensor/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $API_KEY"
```

### Update Sensor
```bash
curl -X PUT http://localhost:3000/api/sensor/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "honeypot-01-updated",
    "hostname": "new-hostname.example.com"
  }'
```

### Sensor Check-in (Heartbeat)
```bash
# From sensor (using deploy_key)
curl -X POST http://localhost:3000/api/sensor/550e8400-e29b-41d4-a716-446655440000/connect \
  -H "X-Deploy-Key: your-deploy-key" \
  -H "Content-Type: application/json" \
  -d '{"ip": "192.168.1.100"}'
```

### Delete Sensor
```bash
curl -X DELETE http://localhost:3000/api/sensor/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $API_KEY"
```

---

## Attacks

### List Attacks
```bash
curl http://localhost:3000/api/attack \
  -H "Authorization: Bearer $API_KEY"

# With filters
curl "http://localhost:3000/api/attack?hours=24" \
  -H "Authorization: Bearer $API_KEY"

curl "http://localhost:3000/api/attack?sensor=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer $API_KEY"

curl "http://localhost:3000/api/attack?protocol=ssh" \
  -H "Authorization: Bearer $API_KEY"

curl "http://localhost:3000/api/attack?ip=192.168.1.100" \
  -H "Authorization: Bearer $API_KEY"
```

### Get Attack Details
```bash
curl http://localhost:3000/api/attack/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer $API_KEY"
```

### Attack Statistics
```bash
curl http://localhost:3000/api/attack/stats \
  -H "Authorization: Bearer $API_KEY"

# Response includes: total attacks, by protocol, by sensor, etc.
```

### Top Attackers
```bash
curl http://localhost:3000/api/attack/top-attackers \
  -H "Authorization: Bearer $API_KEY"

# Returns: IP addresses with attack counts
```

### Geographic Data
```bash
curl http://localhost:3000/api/attack/geo \
  -H "Authorization: Bearer $API_KEY"

# Returns: Attacks by country with coordinates
```

### Sensor-Specific Attacks
```bash
curl http://localhost:3000/api/attack/sensor/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer $API_KEY"
```

### Search Attacks
```bash
curl "http://localhost:3000/api/attack/search?ip=192.168.1.100" \
  -H "Authorization: Bearer $API_KEY"
```

---

## Rules

### Create Rule (Admin)
```bash
curl -X POST http://localhost:3000/api/rule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "SQL Injection attempt detected",
    "classtype": "web-application-attack",
    "sid": 1000001,
    "rev": 1,
    "ruleFormat": "alert http any any -> any any ..."
  }'
```

### List Rules
```bash
curl http://localhost:3000/api/rule \
  -H "Authorization: Bearer $API_KEY"

# Filter by classtype
curl "http://localhost:3000/api/rule?classtype=web-application-attack" \
  -H "Authorization: Bearer $API_KEY"
```

### Get Rule Details
```bash
curl http://localhost:3000/api/rule/1 \
  -H "Authorization: Bearer $API_KEY"
```

### Update Rule (Admin)
```bash
curl -X PUT http://localhost:3000/api/rule/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Updated message",
    "isActive": true
  }'
```

### Delete Rule (Admin)
```bash
curl -X DELETE http://localhost:3000/api/rule/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Export Rules (Snort Format)
```bash
curl http://localhost:3000/api/rules.rules \
  -H "Authorization: Bearer $API_KEY" \
  -o rules.txt

# Returns: Snort rule format suitable for IDS
```

---

## Deploy Scripts

### List Deploy Scripts
```bash
curl http://localhost:3000/api/deployscript \
  -H "Authorization: Bearer $API_KEY"

# Search scripts
curl "http://localhost:3000/api/deployscript?search=Dionaea" \
  -H "Authorization: Bearer $API_KEY"
```

### Get Script Details
```bash
curl http://localhost:3000/api/deployscript/1 \
  -H "Authorization: Bearer $API_KEY"
```

### Create Custom Deploy Script
```bash
curl -X POST http://localhost:3000/api/deployscript \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ubuntu - Custom Honeypot",
    "script": "#!/bin/bash\necho \"Installing...\"",
    "notes": "Custom deployment script"
  }'
```

### Get Script with Variables Rendered
```bash
curl -X POST http://localhost:3000/api/deployscript/1/render \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "server_url": "https://mhn.example.com",
      "deploy_key": "your-deploy-key",
      "sensor_uuid": "550e8400-e29b-41d4-a716-446655440000"
    }
  }' > deploy.sh

# Execute script
bash deploy.sh
```

### Update Deploy Script
```bash
curl -X PUT http://localhost:3000/api/deployscript/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "script": "#!/bin/bash\n# Updated content\n...",
    "notes": "Updated notes"
  }'
```

### Delete Deploy Script
```bash
curl -X DELETE http://localhost:3000/api/deployscript/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Analytics

### Dashboard Summary
```bash
curl http://localhost:3000/api/dashboard/summary \
  -H "Authorization: Bearer $API_KEY"
```

### Sensor Status
```bash
curl http://localhost:3000/api/dashboard/sensors \
  -H "Authorization: Bearer $API_KEY"
```

### Current Threats
```bash
curl http://localhost:3000/api/dashboard/threats \
  -H "Authorization: Bearer $API_KEY"
```

### System Health
```bash
curl http://localhost:3000/api/dashboard/health \
  -H "Authorization: Bearer $API_KEY"
```

### Attack Timeline
```bash
curl http://localhost:3000/api/analytics/timeseries \
  -H "Authorization: Bearer $API_KEY"

# Optional parameters
curl "http://localhost:3000/api/analytics/timeseries?granularity=hourly&hours=24" \
  -H "Authorization: Bearer $API_KEY"
```

### Protocol Distribution
```bash
curl http://localhost:3000/api/analytics/protocols \
  -H "Authorization: Bearer $API_KEY"
```

### Top Attacked Countries
```bash
curl http://localhost:3000/api/analytics/countries \
  -H "Authorization: Bearer $API_KEY"
```

### Top Attacked Ports
```bash
curl http://localhost:3000/api/analytics/ports \
  -H "Authorization: Bearer $API_KEY"
```

---

## Integrations

### Configure Integration
```bash
# Splunk HEC
curl -X POST http://localhost:3000/api/integration/splunk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://splunk.example.com:8088",
    "token": "your-hec-token",
    "enabled": true
  }'

# Elasticsearch
curl -X POST http://localhost:3000/api/integration/elasticsearch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://elasticsearch.example.com:9200",
    "username": "elastic",
    "password": "changeme",
    "enabled": true
  }'
```

### List Integrations
```bash
curl http://localhost:3000/api/integration \
  -H "Authorization: Bearer $API_KEY"
```

### Get Integration Details
```bash
curl http://localhost:3000/api/integration/splunk \
  -H "Authorization: Bearer $API_KEY"
```

### Test Integration
```bash
curl -X POST http://localhost:3000/api/integration/splunk/test \
  -H "Authorization: Bearer $TOKEN"
```

### Toggle Integration
```bash
curl -X PUT http://localhost:3000/api/integration/splunk/toggle \
  -H "Authorization: Bearer $TOKEN"
```

### Get Integration Logs
```bash
curl http://localhost:3000/api/integration/splunk/logs \
  -H "Authorization: Bearer $API_KEY"
```

### Delete Integration
```bash
curl -X DELETE http://localhost:3000/api/integration/splunk \
  -H "Authorization: Bearer $TOKEN"
```

---

## Alerts

### Create Alert
```bash
curl -X POST http://localhost:3000/api/alert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Volume DDoS Alert",
    "trigger": "ATTACK_COUNT",
    "condition": "gt",
    "threshold": 100,
    "window": 3600,
    "enabled": true
  }'
```

### List Alerts
```bash
curl http://localhost:3000/api/alert \
  -H "Authorization: Bearer $API_KEY"
```

### Update Alert
```bash
curl -X PUT http://localhost:3000/api/alert/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 150,
    "enabled": true
  }'
```

### Toggle Alert
```bash
curl -X PUT http://localhost:3000/api/alert/1/toggle \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Alert
```bash
curl -X DELETE http://localhost:3000/api/alert/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Data Export

### Export as JSON
```bash
curl http://localhost:3000/api/export/json \
  -H "Authorization: Bearer $API_KEY" > data.json
```

### Export as CSV
```bash
curl http://localhost:3000/api/export/csv \
  -H "Authorization: Bearer $API_KEY" > data.csv
```

### Export as NDJSON
```bash
curl http://localhost:3000/api/export/ndjson \
  -H "Authorization: Bearer $API_KEY" > data.ndjson
```

### Export Statistics
```bash
curl http://localhost:3000/api/export/stats \
  -H "Authorization: Bearer $API_KEY" > stats.json
```

---

## Health Checks

### API Health
```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"2025-11-23T..."}
```

### Readiness Probe (K8s)
```bash
curl http://localhost:3000/readiness
# {"status":"ready","checks":{"database":true,"mongodb":true,"redis":true}}
```

### Liveness Probe (K8s)
```bash
curl http://localhost:3000/liveness
# {"status":"alive"}
```

---

## Useful Tips

### Save Token to Variable
```bash
export TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r .accessToken)
```

### Pretty Print JSON
```bash
curl ... | jq .

# Specific field
curl ... | jq .attacks

# Array length
curl ... | jq 'length'
```

### Filter Results
```bash
# Get only active sensors
curl http://localhost:3000/api/sensor \
  -H "Authorization: Bearer $API_KEY" | jq '.[] | select(.active==true)'
```

### Pagination
```bash
curl "http://localhost:3000/api/attack?limit=10&offset=0" \
  -H "Authorization: Bearer $API_KEY"
```

### Error Handling
```bash
# Check HTTP status
curl -w "\n%{http_code}\n" http://localhost:3000/api/user \
  -H "Authorization: Bearer $TOKEN"

# Suppress output on success
curl -f -s http://localhost:3000/api/user \
  -H "Authorization: Bearer $TOKEN" || echo "Request failed"
```

---

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 200 | Success | Great! |
| 201 | Created | Resource was created |
| 204 | No Content | Successful deletion |
| 400 | Bad Request | Check your JSON syntax |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | You don't have permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 500 | Server Error | Check server logs |

---

## Quick Reference Tables

### Query Parameters
| Parameter | Endpoint | Example |
|-----------|----------|---------|
| `hours` | /api/attack | `?hours=24` |
| `limit` | /api/attack | `?limit=100` |
| `offset` | /api/attack | `?offset=0` |
| `search` | /api/deployscript | `?search=Dionaea` |
| `type` | /api/sensor | `?type=dionaea` |
| `active` | /api/sensor | `?active=true` |

### Common Status Codes in Responses
| Status | Meaning |
|--------|---------|
| active/inactive | Sensor status |
| online/offline | Sensor connection |
| success/failed | Operation result |

---

**Last Updated:** 2025-11-23
**API Version:** v1
**Status:** Production-Ready
