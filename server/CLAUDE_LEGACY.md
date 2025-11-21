# MHN Legacy Python Implementation (Reference Only)

## ⚠️ IMPORTANT: TypeScript Rewrite Status

**The TypeScript rewrite is approximately 5% complete as of 2025-11-20.**

**What's Implemented in TypeScript:**
- ✅ Basic user management (create, list)
- ✅ Password hashing with bcrypt
- ✅ JSON Schema validation
- ❌ Everything else (authentication, sensors, attacks, rules, deploy scripts)

**For current TypeScript status, see:** [/CLAUDE.md](../CLAUDE.md)

---

## Purpose of This Document

This documentation is for **REFERENCE ONLY** when porting features to the TypeScript rewrite.

**Active development happens in `/api` (TypeScript/Fastify).**

This document helps understand:
- What features exist in the legacy Python codebase
- How business logic currently works
- Database schema and relationships
- API endpoints and their behavior
- Integration points that must be preserved

**When implementing any feature, read this document first to ensure feature parity!**

---

## Architecture Overview

### Tech Stack

**Backend Framework:**
- **Flask 0.12.4** - Web framework with Jinja2 templating
- **Flask-SQLAlchemy 2.5.1** - ORM for database access
- **Flask-Security 1.7.5** - Authentication and authorization
- **Flask-Login 0.3.2** - Session management
- **Flask-Mail 0.9.1** - Email notifications
- **Flask-WTF 0.14.2** - Form handling and CSRF protection
- **uWSGI 2.0.18** - WSGI application server

**Database:**
- **SQLite** - Primary relational database
- **MongoDB** (via Mnemosyne) - Attack event storage
- **Redis 3.2.1** - Celery broker and result backend

**Task Queue:**
- **Celery 4.3.0** - Asynchronous background tasks
- **Redis** - Message broker and result backend

**Security:**
- **bcrypt 3.1.4** - Password hashing
- **Flask-Security** - Authentication decorators

**Data Processing:**
- **xmltodict 0.12.0** - XML/JSON conversion
- **pygal 2.4.0** - Chart generation
- **requests 2.21.0** - HTTP client
- **geoip2 2.9.0** - Geolocation services

**HPFeeds Integration:**
- **hpfeeds-threatstream 1.1** - Threat intelligence client
- **hpfeeds-logger 0.0.7.7** - Event logging

**Python Version:** 2.7 (legacy)

---

## Directory Structure

```
/server/mhn/
├── __init__.py              # Flask app initialization, blueprint registration
├── api/                     # REST API endpoints
│   ├── __init__.py
│   ├── models.py            # Sensor, Rule, DeployScript, RuleSource models
│   ├── views.py             # API routes (431 lines)
│   ├── decorators.py        # @deploy_auth, @sensor_auth, @token_auth
│   ├── errors.py            # API error messages
│   └── tests.py             # API unit tests
├── ui/                      # Web interface
│   ├── __init__.py
│   ├── views.py             # Dashboard, sensors, attacks, rules views
│   ├── utils.py             # UI utility functions
│   └── constants.py         # UI constants
├── auth/                    # Authentication & authorization
│   ├── __init__.py
│   ├── models.py            # User, Role, ApiKey, PasswdReset models
│   ├── views.py             # Login, logout, password reset routes
│   └── contextprocessors.py # User context injection
├── common/                  # Shared utilities
│   ├── __init__.py
│   ├── clio.py              # MongoDB interface (16,229 lines)
│   ├── ruleutils.py         # Snort rule parsing utilities
│   ├── utils.py             # Common helper functions
│   ├── contextprocessors.py # Jinja2 context processors
│   └── templatetags.py      # Template filters (date formatting)
├── tasks/                   # Celery background tasks
│   ├── __init__.py
│   └── rules.py             # Async rule fetching from sources
├── templates/               # Jinja2 HTML templates
│   ├── base.html            # Base layout with navigation
│   ├── ui/                  # Dashboard, sensors, attacks, rules, honeymap
│   ├── auth/                # Login, password reset forms
│   └── security/            # Flask-Security templates
└── static/                  # Frontend assets
    ├── css/                 # Foundation CSS framework
    ├── js/                  # jQuery, Foundation.js, custom scripts
    ├── img/                 # Country flags, logos
    ├── hpfeeds.py           # HPFeeds utilities
    ├── ihandlers.py         # Input handlers
    └── dionaea.conf         # Dionaea honeypot configuration
```

---

## Database Schema (SQLAlchemy Models)

### User Model
**Location:** [server/mhn/auth/models.py](server/mhn/auth/models.py)

```python
class User(db.Model, APIModel, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True)
    password = db.Column(db.String(255))  # bcrypt hashed
    active = db.Column(db.Boolean())
    confirmed_at = db.Column(db.DateTime())
    roles = db.relationship('Role', secondary=roles_users)
```

**Features:**
- Email-based authentication
- bcrypt password hashing
- Many-to-many relationship with roles
- Active/inactive user status
- Email confirmation tracking

### Role Model
**Location:** [server/mhn/auth/models.py](server/mhn/auth/models.py)

```python
class Role(db.Model, RoleMixin):
    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(80), unique=True)
    description = db.Column(db.String(255))
```

**Default Roles:**
- `admin` - Full system access
- `user` - Limited access (read-only in most cases)

### ApiKey Model
**Location:** [server/mhn/auth/models.py](server/mhn/auth/models.py)

```python
class ApiKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    api_key = db.Column(db.String(32), unique=True)  # UUID without dashes
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"))
```

**Usage:**
- Used for API authentication via `?api_key=xxx` query parameter
- One API key per user
- Generated as UUID without dashes

### PasswdReset Model
**Location:** [server/mhn/auth/models.py](server/mhn/auth/models.py)

```python
class PasswdReset(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    hashstr = db.Column(db.String(40))  # Reset token
    created = db.Column(db.DateTime())
    active = db.Column(db.Boolean())
    user_id = db.Column(db.Integer, db.ForeignKey(User.id))
```

**Features:**
- Email-based password reset
- Timestamped reset tokens
- Active/inactive status for token expiration

### Sensor Model
**Location:** [server/mhn/api/models.py](server/mhn/api/models.py)

```python
class Sensor(db.Model, APIModel):
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True)
    name = db.Column(db.String(50))
    created_date = db.Column(db.DateTime())
    ip = db.Column(db.String(15))
    hostname = db.Column(db.String(50))
    identifier = db.Column(db.String(50), unique=True)
    honeypot = db.Column(db.String(50))  # Type: dionaea, cowrie, etc.
```

**Key Features:**
- UUID-based identification
- Tracks sensor IP address
- Hostname for human-readable reference
- Identifier links to HPFeeds authentication
- Honeypot type determines channel subscriptions

**Relationships:**
- Links to HPFeeds authkey (via Clio/Mnemosyne)
- Attack count retrieved from MongoDB

**Special Properties:**
- `attacks_count` - Property that queries MongoDB for attack count
- `authkey` - Property that retrieves HPFeeds credentials from Mnemosyne
- `new_auth_dict()` - Generates HPFeeds credentials with random secret

### Rule Model
**Location:** [server/mhn/api/models.py](server/mhn/api/models.py)

```python
class Rule(db.Model, APIModel):
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.String(140))
    references = db.relationship('Reference', backref='rule')
    classtype = db.Column(db.String(50))
    sid = db.Column(db.Integer)  # Snort rule ID
    rev = db.Column(db.Integer)  # Rule revision
    date = db.Column(db.DateTime())
    rule_format = db.Column(db.String(500))  # Rule template
    is_active = db.Column(db.Boolean)
    notes = db.Column(db.String(140))
```

**Key Features:**
- Stores Snort/Suricata rules
- Unique constraint on (sid, rev) - only latest revision kept active
- Template-based rule rendering
- References stored in separate table

**Important Methods:**
- `render()` - Converts rule to Snort format
- `renderall()` - Exports all active rules (latest revisions)
- `bulk_import(rulelist)` - Imports rules, disables older revisions

### Reference Model
**Location:** [server/mhn/api/models.py](server/mhn/api/models.py)

```python
class Reference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(140))
    rule_id = db.Column(db.Integer, db.ForeignKey('rules.id'))
```

**Purpose:** Stores rule references (CVE numbers, URLs, etc.)

### RuleSource Model
**Location:** [server/mhn/api/models.py](server/mhn/api/models.py)

```python
class RuleSource(db.Model, APIModel):
    id = db.Column(db.Integer, primary_key=True)
    uri = db.Column(db.String(140))  # URL to rule file
    note = db.Column(db.String(140))
    name = db.Column(db.String(40))
```

**Default Source:**
- Emerging Threats ruleset
- Fetched periodically via Celery task

### DeployScript Model
**Location:** [server/mhn/api/models.py](server/mhn/api/models.py)

```python
class DeployScript(db.Model, APIModel):
    id = db.Column(db.Integer, primary_key=True)
    script = db.Column(db.String(102400))  # Shell script content
    date = db.Column(db.DateTime())
    notes = db.Column(db.String(140))
    name = db.Column(db.String(140))  # e.g., "Ubuntu - Dionaea"
    user_id = db.Column(db.Integer, db.ForeignKey(User.id))
```

**Key Features:**
- Stores shell scripts for honeypot deployment
- Scripts contain template variables filled at runtime
- One script per honeypot type
- Created by admin users

---

## API Endpoints

**Base URL:** `/api`

### Authentication Decorators

**Location:** [server/mhn/api/decorators.py](server/mhn/api/decorators.py)

1. **`@deploy_auth`** - Validates deploy key from query parameter
   - Used for sensor registration
   - Checks `deploy_key` against config

2. **`@sensor_auth`** - Validates sensor credentials
   - Used for sensor check-in/updates
   - Authenticates via UUID and IP

3. **`@token_auth`** - Validates API key
   - Checks `api_key` query parameter
   - Used for most API endpoints

### Sensor Endpoints

**POST `/api/sensor/`** - Create new sensor
- **Auth:** `@deploy_auth` (deploy key required)
- **Request Body:**
  ```json
  {
    "name": "sensor-name",
    "hostname": "sensor-hostname",
    "honeypot": "dionaea"
  }
  ```
- **Response:**
  ```json
  {
    "uuid": "generated-uuid",
    "name": "sensor-name",
    "honeypot": "dionaea",
    "ip": "auto-detected-ip",
    "secret": "generated-hpfeeds-secret",
    "publish": ["dionaea.connections", "dionaea.capture"]
  }
  ```
- **Location:** [server/mhn/api/views.py:27](server/mhn/api/views.py#L27)
- **Business Logic:**
  1. Validates required fields (name, hostname, honeypot)
  2. Generates UUID
  3. Auto-detects IP from request
  4. Creates HPFeeds authkey via Clio
  5. Saves sensor to database
  6. Returns sensor info with HPFeeds credentials

**GET `/api/sensor/`** - List sensors
- **Auth:** `@token_auth` (API key required)
- **Query Parameters:** Any sensor field for filtering
- **Response:** Array of sensor objects
- **Location:** [server/mhn/api/views.py:49](server/mhn/api/views.py#L49)

**PUT `/api/sensor/<uuid>/`** - Update sensor
- **Auth:** `@token_auth`
- **Editable Fields:** `name`, `hostname`
- **Location:** [server/mhn/api/views.py:59](server/mhn/api/views.py#L59)

**DELETE `/api/sensor/<uuid>/`** - Delete sensor
- **Auth:** `@login_required` (web session)
- **Side Effect:** Deletes HPFeeds authkey from Mnemosyne
- **Location:** [server/mhn/api/views.py:82](server/mhn/api/views.py#L82)

**POST `/api/sensor/<uuid>/connect/`** - Sensor check-in
- **Auth:** `@sensor_auth`
- **Purpose:** Updates sensor IP address
- **Location:** [server/mhn/api/views.py:92](server/mhn/api/views.py#L92)

### Rule Endpoints

**GET `/api/rule/`** - List rules
- **Auth:** `@token_auth`
- **Query Parameters:** Filtering by sid, classtype, etc.
- **Response:** Array of rule objects

**POST `/api/rule/`** - Create rule
- **Auth:** `@login_required`
- **Request Body:** Rule fields (message, sid, rev, classtype, rule_format)

**GET `/api/rule/<rule_id>/`** - Get single rule
- **Auth:** `@token_auth`

**PUT `/api/rule/<rule_id>/`** - Update rule
- **Auth:** `@login_required`
- **Editable Fields:** `message`, `classtype`, `rev`, `is_active`, `notes`

**DELETE `/api/rule/<rule_id>/`** - Delete rule
- **Auth:** `@login_required`

**GET `/api/rules.rules`** - Export active rules in Snort format
- **Auth:** `@token_auth`
- **Response:** Plain text Snort rules file
- **Purpose:** Sensors download this for IDS configuration

### RuleSource Endpoints

**GET `/api/rulesource/`** - List rule sources
- **Auth:** `@token_auth`

**POST `/api/rulesource/`** - Add rule source
- **Auth:** `@login_required`
- **Request Body:** `{ "name": "...", "uri": "...", "note": "..." }`

**DELETE `/api/rulesource/<source_id>/`** - Delete rule source
- **Auth:** `@login_required`

### DeployScript Endpoints

**GET `/api/script/`** - List deploy scripts
- **Auth:** `@token_auth`

**POST `/api/script/`** - Create deploy script
- **Auth:** `@login_required`
- **Request Body:** `{ "name": "...", "script": "...", "notes": "..." }`

**GET `/api/script/<script_id>/`** - Get deploy script
- **Auth:** `@token_auth`
- **Purpose:** Used by deployment to download script

**PUT `/api/script/<script_id>/`** - Update deploy script
- **Auth:** `@login_required`

**DELETE `/api/script/<script_id>/`** - Delete deploy script
- **Auth:** `@login_required`

### Attack Data Endpoints

**GET `/api/session/`** - List attack sessions
- **Auth:** `@token_auth`
- **Query Parameters:**
  - `source_ip` - Filter by attacker IP
  - `identifier` - Filter by sensor UUID
  - `honeypot` - Filter by honeypot type
  - `protocol` - Filter by protocol
  - `limit` - Limit results (default: varies)
  - `hours_ago` - Filter by time range
- **Response:** Array of attack session objects from MongoDB
- **Location:** Uses Clio to query Mnemosyne

**GET `/api/session/<session_id>/`** - Get single attack session
- **Auth:** `@token_auth`
- **Response:** Detailed attack session data

**GET `/api/top_attackers/`** - Top attacking IPs
- **Auth:** `@token_auth`
- **Query Parameters:** `hours_ago`, `limit`
- **Response:** Array of IPs with attack counts

**GET `/api/attacks_count/`** - Total attack count
- **Auth:** `@token_auth`
- **Query Parameters:** `hours_ago`
- **Response:** `{ "count": 12345 }`

**GET `/api/attacker_stats/`** - Geolocation stats
- **Auth:** `@token_auth`
- **Response:** Attack counts by country

### Feed Endpoints

**GET `/feed.json`** - JSON feed of recent attacks
- **Auth:** Optional (configurable via `FEED_AUTH_REQUIRED`)
- **Format:** Atom feed converted to JSON
- **Location:** [server/mhn/__init__.py:76](server/mhn/__init__.py#L76)

**GET `/feed.xml`** - XML Atom feed
- **Auth:** Optional
- **Location:** [server/mhn/__init__.py:82](server/mhn/__init__.py#L82)

---

## Authentication & Authorization System

### Authentication Methods

1. **Web Session Authentication**
   - Uses Flask-Login and Flask-Security
   - Session cookies
   - Used for web UI

2. **API Key Authentication**
   - Query parameter: `?api_key=xxx`
   - Validated by `@token_auth` decorator
   - Used for API access

3. **Deploy Key Authentication**
   - Query parameter: `?deploy_key=xxx`
   - Validated by `@deploy_auth` decorator
   - Used for sensor registration only
   - Key stored in config

4. **Sensor Authentication**
   - Validates sensor UUID and IP
   - Used by `@sensor_auth` decorator
   - For sensor check-in endpoints

### Authorization (RBAC)

**Roles:**
- **admin** - Full access (create, edit, delete)
- **user** - Read-only access

**Flask-Security Integration:**
- `@login_required` - Requires authenticated user
- `@roles_required('admin')` - Requires admin role
- `@roles_accepted('admin', 'user')` - Requires one of the roles

### Password Management

**Hashing:**
- Uses bcrypt via Flask-Security
- `encrypt_password()` function wraps bcrypt

**Reset Flow:**
1. User requests reset via email
2. System generates unique hash token
3. Email sent with reset link
4. User clicks link, enters new password
5. Token marked inactive after use

### TypeScript Implementation Status

**❌ NOT IMPLEMENTED:** Authentication is the #1 priority for the TypeScript rewrite (Phase 2).

See [/CLAUDE.md - Phase 2: Authentication & Authorization](../CLAUDE.md#phase-2-authentication--authorization-next---blocker) for implementation plan.

**Critical for TypeScript:**
- Must implement JWT tokens (not sessions)
- Must preserve API key authentication
- Must implement RBAC with Role model
- Must preserve deploy key authentication for sensors

---

## HPFeeds Integration

### What is HPFeeds?

HPFeeds is a publish-subscribe protocol for sharing honeypot data in real-time.

**Components:**
- **Broker** - Central message router (hpfeeds3 server)
- **Publishers** - Sensors send attack data
- **Subscribers** - MHN server receives attack data

### Clio Library

**Location:** [server/mhn/common/clio.py](server/mhn/common/clio.py) (16,229 lines)

**Purpose:** Python interface to Mnemosyne (MongoDB storage for HPFeeds)

**Key Classes:**
- `Clio()` - Main interface
- `Clio().authkey` - Manage sensor credentials
  - `new(**kwargs)` - Create new authkey
  - `get(identifier=uuid)` - Retrieve authkey
  - `delete(identifier=uuid)` - Remove authkey
- `Clio().session` - Query attack sessions
  - `get(options={})` - Retrieve attack data
- `Clio().counts` - Attack statistics
  - `get_count(identifier=uuid)` - Count attacks per sensor

### Sensor Authentication Flow

1. **Registration:**
   - Sensor POSTs to `/api/sensor/`
   - MHN generates UUID and HPFeeds secret
   - MHN calls `Clio().authkey.new()` to create credentials
   - Credentials returned to sensor

2. **HPFeeds Connection:**
   - Sensor connects to HPFeeds broker
   - Authenticates with `identifier` (UUID) and `secret`
   - Subscribes to channels based on honeypot type

3. **Publishing:**
   - Sensor publishes attack events to channels
   - Example channels:
     - `dionaea.connections`
     - `dionaea.capture`
     - `cowrie.sessions`
     - `conpot.events`

4. **Ingestion:**
   - Mnemosyne (MongoDB) subscribes to all channels
   - Stores events with geolocation data
   - MHN queries Mnemosyne via Clio

### Channel Configuration

**Location:** Flask config `HONEYPOT_CHANNELS`

**Example:**
```python
HONEYPOT_CHANNELS = {
    'dionaea': ['dionaea.connections', 'dionaea.capture', 'dionaea.dcerpcrequests'],
    'cowrie': ['cowrie.sessions'],
    'conpot': ['conpot.events'],
    'snort': ['snort.alerts'],
    # ... etc
}
```

---

## Deploy Scripts System

### How Deploy Scripts Work

**Purpose:** Automate honeypot installation on remote servers

**Flow:**
1. Admin creates deploy script via web UI
2. Script contains template variables: `{server_url}`, `{deploy_key}`, `{honeypot}`
3. User downloads script for specific honeypot type
4. Variables are filled in at download time
5. User runs script on target server
6. Script installs honeypot and registers with MHN

### Script Template Variables

Available in deploy scripts:

- `{server_url}` - MHN server URL
- `{deploy_key}` - Authentication key for registration
- `{honeypot}` - Honeypot type name

### Default Deploy Scripts

**Location:** [scripts/](../../scripts/)

Initial scripts loaded in database:
- `deploy_conpot.sh` - ICS/SCADA honeypot
- `deploy_cowrie.sh` - SSH honeypot
- `deploy_dionaea.sh` - Multi-protocol honeypot
- `deploy_snort.sh` - Snort IDS
- `deploy_suricata.sh` - Suricata IDS
- `deploy_glastopf.sh` - Web app honeypot
- `deploy_p0f.sh` - Passive OS fingerprinting
- `deploy_wordpot.sh` - WordPress honeypot
- `deploy_conpot.sh` - ICS honeypot
- Plus 10+ more...

### Script Execution Flow

1. Script installs dependencies (Python, libraries, etc.)
2. Installs honeypot software
3. Configures honeypot with MHN server details
4. Registers sensor with MHN via `/api/sensor/` endpoint
5. Starts honeypot service
6. Sets up HPFeeds connection for data transmission

### TypeScript Implementation Status

**❌ NOT IMPLEMENTED:** Deploy scripts are planned for Phase 5 of the TypeScript rewrite.

See [/CLAUDE.md - Phase 5: Rules & Deploy Scripts](../CLAUDE.md#phase-5-rules--deploy-scripts-4-6-weeks) for implementation plan.

**What needs to be ported:**
- DeployScript model with script storage
- CRUD API for script management
- Template variable replacement system
- All 20+ default scripts from `/scripts` folder
- Script download endpoint with variable injection

---

## Rules Management System

### Rule Fetching (Celery Task)

**Location:** [server/mhn/tasks/rules.py](server/mhn/tasks/rules.py)

**Task:** `fetch_sources()`

**Schedule:** Periodic (configurable via Celery beat)

**Process:**
1. Queries all RuleSource records
2. Downloads rules from each URI
3. Parses Snort/Suricata rule format
4. Imports rules via `Rule.bulk_import()`
5. Disables older rule revisions

**Default Rule Source:**
- Emerging Threats Community Rules
- URL configured in Flask config

### Rule Format

**Snort Rule Example:**
```
alert tcp any any -> any any (msg:"Example attack"; classtype:trojan-activity; sid:12345; rev:1; reference:url,example.com;)
```

**Parsed Fields:**
- `message` - Human-readable description
- `classtype` - Attack category
- `sid` - Snort ID (unique)
- `rev` - Revision number
- `references` - CVE, URL references
- `rule_format` - Template with placeholders

### Rule Distribution

**Endpoint:** `/api/rules.rules`

**Purpose:** Sensors download active rules

**Format:** Plain text Snort rules file

**Usage:**
- Snort/Suricata sensors fetch this file
- Apply rules to IDS configuration
- Detect attacks matching signatures

---

## UI Routes (Web Interface)

**Blueprint:** `ui`
**Location:** [server/mhn/ui/views.py](server/mhn/ui/views.py)

### Main Pages

**GET `/ui/dashboard/`** - Main dashboard
- Attack statistics
- Recent attacks
- Sensor status
- Charts (pygal)

**GET `/ui/sensors/`** - Sensor management
- List all sensors
- Add/edit/delete sensors
- View sensor details

**GET `/ui/attacks/`** - Attack log
- Searchable attack list
- Filter by IP, sensor, honeypot
- Export to CSV

**GET `/ui/rules/`** - Rule management
- List rules
- Import rules from sources
- Enable/disable rules
- Export rules

**GET `/ui/deploy/`** - Deploy scripts
- List available deploy scripts
- Download scripts with pre-filled variables
- Create custom scripts (admin)

**GET `/ui/honeymap/`** - Real-time attack map
- Geographical visualization
- WebSocket updates
- Country flags

**GET `/ui/settings/`** - System settings
- User management
- API key management
- Configuration

---

## Business Logic to Preserve

### Critical Workflows

These workflows **MUST** work identically in the TypeScript rewrite:

1. **Sensor Registration**
   - UUID generation
   - IP auto-detection
   - HPFeeds credential creation
   - Channel assignment by honeypot type

2. **HPFeeds Authentication**
   - Identifier = sensor UUID
   - Secret = random 16-char string
   - Publish channels based on honeypot type

3. **Attack Data Storage**
   - All events stored in MongoDB via Mnemosyne
   - Geolocation added to events
   - Queryable by sensor, IP, time range, protocol

4. **Rule Management**
   - Only latest revision of each SID is active
   - Bulk import disables older revisions
   - Rule rendering follows Snort format

5. **API Key Authentication**
   - API key = UUID without dashes (32 chars)
   - Passed as query parameter
   - One key per user

6. **Deploy Script Variables**
   - Variables replaced at download time
   - Must include: server_url, deploy_key

### Data Integrity Rules

1. **Unique Constraints**
   - User email must be unique
   - Sensor UUID must be unique
   - Sensor identifier must be unique
   - Rule (sid, rev) combination must be unique

2. **Cascading Deletes**
   - Deleting sensor must delete HPFeeds authkey
   - Deleting user should NOT delete their created deploy scripts

3. **Default Values**
   - Sensor UUID: generated UUID v1
   - Sensor IP: auto-detected from request
   - Rule is_active: true by default
   - Timestamps: current UTC time

---

## Security Patterns

### Input Validation

**Pattern:** Check required fields before processing

```python
missing = Sensor.check_required(request.json)
if missing:
    return error_response(errors.API_FIELDS_MISSING.format(missing), 400)
```

### CSRF Protection

**Pattern:** Flask-WTF CSRF tokens on all forms

**Exemptions:** API endpoints that use token auth (`@csrf.exempt`)

### SQL Injection Prevention

**Pattern:** SQLAlchemy ORM (parameterized queries)

**Never:** String concatenation in queries

### Password Security

**Pattern:** bcrypt hashing with automatic salt

```python
from flask_security.utils import encrypt_password
user.password = encrypt_password(plain_password)
```

### API Authentication

**Pattern:** Decorator-based auth checks

```python
@token_auth  # Validates API key
def get_sensors():
    # ... secure endpoint
```

### Sensitive Data Exposure

**Pattern:** Exclude password from API responses

```python
def to_dict(self):
    return dict(email=self.email, ...)  # No password field
```

---

## Configuration

**Location:** [server/config.py.template](server/config.py.template)

### Key Configuration Variables

```python
# Server
SERVER_BASE_URL = 'http://mhn-server.example.com'
SECRET_KEY = 'random-secret-key'

# Database
SQLALCHEMY_DATABASE_URI = 'sqlite:////path/to/mhn.db'

# Security
SECURITY_PASSWORD_HASH = 'bcrypt'
SECURITY_PASSWORD_SALT = 'random-salt'

# Authentication
DEPLOY_KEY = 'random-deploy-key'  # For sensor registration

# Superuser (initial admin)
SUPERUSER_EMAIL = 'admin@localhost'
SUPERUSER_PASSWORD = 'admin-password'

# HPFeeds
HPFEEDS_HOST = 'localhost'
HPFEEDS_PORT = 10000

# Mnemosyne (MongoDB)
MNEMOSYNE_URL = 'http://localhost:8181'

# Rules
SNORT_RULES_SOURCE = {
    'name': 'Emerging Threats',
    'uri': 'https://rules.emergingthreats.net/open/snort-2.9.0/emerging.rules.tar.gz'
}

# Honeypot Channels
HONEYPOT_CHANNELS = {
    'dionaea': ['dionaea.connections', 'dionaea.capture'],
    'cowrie': ['cowrie.sessions'],
    # ... etc
}

# Email (for password reset)
MAIL_SERVER = 'smtp.example.com'
MAIL_PORT = 587
MAIL_USERNAME = 'mhn@example.com'
MAIL_PASSWORD = 'password'

# Logging
LOG_FILE_PATH = '/var/log/mhn/mhn.log'
```

---

## Integration Points

### HPFeeds Broker

**Component:** hpfeeds3 server
**Port:** 10000 (default)
**Purpose:** Message routing between sensors and MHN

### Mnemosyne

**Component:** MongoDB + HPFeeds subscriber
**Port:** 8181 (HTTP API)
**Purpose:** Attack data storage and retrieval
**API:** RESTful interface via Clio library

### Geolocation (GeoIP2)

**Library:** geoip2
**Database:** MaxMind GeoLite2
**Purpose:** Add country/city data to attack events

### Splunk Integration

**Script:** [scripts/install_hpfeeds-logger-splunk.sh](../../scripts/install_hpfeeds-logger-splunk.sh)
**Purpose:** Forward HPFeeds data to Splunk

### ArcSight Integration

**Script:** [scripts/install_hpfeeds-logger-arcsight.sh](../../scripts/install_hpfeeds-logger-arcsight.sh)
**Purpose:** Forward HPFeeds data to ArcSight SIEM

### ELK Stack Integration

**Script:** [scripts/install_elk.sh](../../scripts/install_elk.sh)
**Purpose:** Store and visualize attack data in Elasticsearch

---

## Celery Background Tasks

### Task: `fetch_sources()`

**Location:** [server/mhn/tasks/rules.py](server/mhn/tasks/rules.py)

**Purpose:** Download and import Snort rules from configured sources

**Schedule:** Periodic (daily recommended)

**Process:**
1. Query all RuleSource records
2. Download rule files (tar.gz)
3. Extract and parse rules
4. Import via `Rule.bulk_import()`
5. Log import statistics

**Error Handling:**
- Network errors: Logged, task retries
- Parse errors: Skipped, logged
- Database errors: Rolled back, logged

### Task Broker

**Backend:** Redis
**Result Backend:** Redis

**Configuration:**
```python
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
```

---

## Frontend (Jinja2 Templates)

### Template Structure

**Base Template:** [server/mhn/templates/base.html](server/mhn/templates/base.html)

**Features:**
- Foundation CSS framework
- jQuery
- Top navigation with user menu
- Flash message display
- Page-specific content blocks

### JavaScript Libraries

**Location:** [server/mhn/static/js/](server/mhn/static/js/)

**Libraries:**
- jQuery 2.1.1
- Foundation 5.x
- Datatables (for sortable tables)
- Pygal.js (for charts)
- Custom MHN scripts

### Key UI Features

1. **Dashboard Charts**
   - Attack count over time
   - Top attackers
   - Top targeted sensors
   - Attack protocol distribution

2. **Real-time Updates**
   - WebSocket connection for live data
   - Honeymap updates every few seconds

3. **Data Export**
   - CSV export of attack logs
   - Rule file download

4. **Pagination**
   - Large datasets paginated
   - Configurable page size

---

## Testing

**Location:** [server/mhn/api/tests.py](server/mhn/api/tests.py)

**Framework:** Flask-Testing (extends unittest)

**Coverage:**
- API endpoint tests
- Authentication decorator tests
- Model validation tests

**Pattern:**
```python
class APITestCase(FlaskTestCase):
    def test_create_sensor(self):
        response = self.client.post('/api/sensor/',
                                     data=json.dumps(sensor_data),
                                     query_string={'deploy_key': DEPLOY_KEY})
        self.assertEqual(response.status_code, 200)
```

---

## Known Limitations

1. **Python 2.7**
   - End of life (deprecated)
   - Security vulnerabilities

2. **SQLite**
   - Not ideal for concurrent writes
   - No built-in replication

3. **Session-based Auth**
   - Doesn't scale across multiple servers
   - Not mobile-friendly

4. **Synchronous Request Handling**
   - Blocking I/O
   - Limited concurrency

5. **Monolithic Architecture**
   - Hard to scale components independently

6. **Limited API Documentation**
   - No OpenAPI/Swagger spec

7. **No Rate Limiting**
   - Vulnerable to abuse

8. **No Request Validation**
   - Basic error handling

---

## Migration Notes for TypeScript Rewrite

### What to Keep

✅ **Business Logic:**
- Sensor registration flow
- HPFeeds credential generation
- Rule versioning (sid/rev)
- Attack data schema
- Deploy script template system

✅ **API Behavior:**
- Endpoint paths (for compatibility)
- Response formats (if needed for backward compatibility)
- Authentication methods (API key, deploy key)

✅ **Security Patterns:**
- bcrypt password hashing
- CSRF protection on forms
- API key authentication

### What to Improve

🔄 **Database:**
- Migrate to PostgreSQL
- Normalize schema
- Add indexes for performance
- Use Prisma ORM

🔄 **Authentication:**
- Replace sessions with JWT
- Add refresh tokens
- Implement rate limiting

🔄 **API Design:**
- RESTful consistency
- Structured error responses
- OpenAPI documentation
- Input validation with JSON Schema

🔄 **Architecture:**
- Separate API from frontend
- Microservices potential
- Real-time with WebSockets
- Better logging and monitoring

### What to Replace

❌ **Clio Library:**
- Direct MongoDB access via Prisma or Mongoose
- Replace with TypeScript MongoDB driver

❌ **Celery:**
- Replace with Bull queues (Node.js)
- Or use AWS Lambda for scheduled tasks

❌ **Jinja2 Templates:**
- Build React/Next.js frontend
- API-first architecture

---

## Glossary

**HPFeeds** - Honeypot Feeds - Publish/subscribe protocol for sharing honeypot data

**Mnemosyne** - MongoDB storage system for HPFeeds data with HTTP API

**Clio** - Python library for querying Mnemosyne

**Sensor** - Deployed honeypot instance that reports to MHN

**Deploy Script** - Shell script for automated honeypot installation

**Rule** - Snort/Suricata IDS signature

**SID** - Snort ID - Unique identifier for a rule

**UUID** - Universally Unique Identifier - Used for sensor identification

**Deploy Key** - Authentication key for sensor registration

**API Key** - Authentication token for API access

---

**Last Updated:** 2025-11-20
**Status:** Reference documentation for legacy Python Flask implementation
**Purpose:** Guide TypeScript rewrite and ensure feature parity
