# VirtueVulns3 — Free Public Hosting Guide
## Neon DB + Railway + GitHub

---

> [!IMPORTANT]
> **Key fact about this app:** The NestJS backend serves BOTH the API AND the React frontend from the same process on port 3000.
> You do **not** need Vercel or a separate frontend host. One Railway deployment = everything.

### Architecture

```
GitHub (code)
    │
    │  auto-deploy on push
    ▼
Railway (Docker container — port 3000)
    ├── NestJS API   → /api/*
    └── React App    → /* (static files served by NestJS)
    │
    │  PostgreSQL connection (SSL)
    ▼
Neon DB (free PostgreSQL)
```

---

## Step 1 — Set Up Neon DB

### 1a. Create the database schema

1. Log in to [neon.tech](https://neon.tech)
2. Open your project → click **SQL Editor**
3. Copy the **entire contents** of `core/pg.sql` from this repo and paste it into the editor
4. Click **Run** — this creates all tables and seeds default users + products

### 1b. Get your connection details

In Neon Dashboard → **Connection Details**, switch the view to **Parameters only**. Note these values:

| Neon Field | Maps to env var |
|---|---|
| Host | `DATABASE_HOST` |
| Database | `DATABASE_SCHEMA` |
| User | `DATABASE_USER` |
| Password | `DATABASE_PASSWORD` |
| Port | `DATABASE_PORT` (always `5432`) |

> [!NOTE]
> Neon host looks like: `ep-cool-name-123456.us-east-2.aws.neon.tech`
> The app auto-detects this host and enables SSL — no extra config needed.

---

## Step 2 — Push Code to GitHub

If not already done:

```bash
git add .
git commit -m "chore: remove AI chat, add Neon DB SSL support"
git push origin main
```

---

## Step 3 — Deploy on Railway

### 3a. Create a Railway account

1. Go to [railway.app](https://railway.app)
2. Sign up with your **GitHub account** (recommended — enables auto-deploy)
3. Railway gives **$5 free credit/month** — sufficient for this app

### 3b. Create a new project

1. Click **New Project**
2. Choose **Deploy from GitHub Repo**
3. Select your `VirtueVulns3` repository
4. Railway will scan for a Dockerfile

### 3c. Configure the build

In the Railway service settings:

| Setting | Value |
|---|---|
| **Root Directory** | `/` (leave default) |
| **Dockerfile Path** | `core/Dockerfile` |
| **Start Command** | *(leave empty — Dockerfile CMD handles it)* |

### 3d. Set Environment Variables

In Railway → your service → **Variables** tab, add each variable:

```
URL=https://<your-railway-domain>.up.railway.app

DATABASE_HOST=<paste from Neon>
DATABASE_SCHEMA=<paste from Neon>
DATABASE_USER=<paste from Neon>
DATABASE_PASSWORD=<paste from Neon>
DATABASE_PORT=5432
DATABASE_DEBUG=false

NODE_ENV=production
CLUSTER=0

JWT_PRIVATE_KEY_LOCATION=./config/keys/jwtRS256.key
JWT_PUBLIC_KEY_LOCATION=./config/keys/jwtRS256.key.pub
JWT_SECRET_KEY=123

JWK_PRIVATE_KEY_LOCATION=./config/keys/jwk.key.pem
JWK_PUBLIC_KEY_LOCATION=./config/keys/jwk.pub.key.pem
JWK_PUBLIC_JSON=./config/keys/jwk.pub.json

JKU_URL=https://<your-railway-domain>.up.railway.app/api/auth/jku
X5U_URL=https://<your-railway-domain>.up.railway.app/api/auth/x5u
AWS_BUCKET=https://<your-railway-domain>.up.railway.app/api/storage

GOOGLE_MAPS_API=DEMON_SLAYERS_MAPS_API_KEY
TESTCASE=true
```

> [!TIP]
> For `URL`, `JKU_URL`, `X5U_URL`, and `AWS_BUCKET` you need your Railway domain.
> Go to **Settings → Networking → Generate Domain** first, then come back and fill these in.
> You can set all other vars first, generate the domain, then add the URL-based vars.

### 3e. Deploy

Click **Deploy** (or push to GitHub if auto-deploy is on).

Railway will:
1. Pull your code from GitHub
2. Build the Docker image (installs npm deps, builds NestJS + Vite React)
3. Start the container on port 3000
4. Assign a public HTTPS URL

Watch the **Build Logs** tab — build takes about 3–5 minutes.

---

## Step 4 — Verify Everything Works

Once deployed, test these URLs in your browser:

| URL | Expected Result |
|---|---|
| `https://your-app.railway.app/` | React homepage loads |
| `https://your-app.railway.app/swagger` | Swagger API docs |
| `https://your-app.railway.app/api/config` | JSON with config info |
| `https://your-app.railway.app/userlogin` | Login page |

### Test login with seeded users

| Email | Password | Role |
|---|---|---|
| `admin@demonslayer.com` | `admin123` | super_admin |
| `user@demonslayer.com` | `user123` | people |
| `admin` | `admin` | super_admin |

---

## How the Three Services Connect

```
Browser
  │
  │  HTTPS request to railway domain
  ▼
Railway Container (NestJS on port 3000)
  │
  ├── GET /         → serves frontend/dist/index.html (React app)
  ├── GET /assets/* → serves React static assets
  ├── GET /api/*    → NestJS API handlers
  │                    │
  │                    │  MikroORM (PostgreSQL driver + SSL)
  │                    ▼
  │              Neon DB (cloud PostgreSQL)
  │
  └── The React app makes all API calls to /api/* (relative path)
      → same domain, no CORS issues
```

> [!NOTE]
> Because frontend and backend share the same origin (same Railway URL), the React app uses **relative paths** like `/api/auth/login` — not an absolute URL. This means no CORS configuration is needed.

---

## Auto-Deploy on Push

Once connected to GitHub, every `git push` to `main`:
1. Railway detects the push
2. Rebuilds the Docker image
3. Rolls over to the new version with zero downtime

---

## Troubleshooting

### "Application failed to start"
Check Railway **Deploy Logs**. Most common causes:
- Missing env var → check all vars above are set
- Database connection failed → verify Neon host/user/password are correct

### "Cannot connect to database"
- Confirm you ran `core/pg.sql` in Neon SQL Editor
- The Neon host must match exactly (copy-paste, don't retype)
- SSL is auto-enabled for neon.tech hosts — no extra config needed

### Build fails on `libxmljs`
If Railway's build fails compiling native modules, add this env var in Railway:
```
NPM_CONFIG_OPTIONAL=false
```
Or check Railway's build logs for the exact error.

### Login returns 401 after DB setup
The seeded passwords use argon2 hashes. If you're using the exact `pg.sql` file from this repo, the passwords are exactly as listed in the table above.
