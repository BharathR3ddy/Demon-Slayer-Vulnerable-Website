# VirtueVulns3 — Free Hosting Guide

## TL;DR Answer

| Service | Role | Works? | Why |
|---|---|---|---|
| **GitHub** | Code repository | ✅ Yes | Push code, trigger deploys |
| **Vercel** | Frontend (React) | ✅ Yes | Perfect for static React/Vite |
| **Vercel** | Backend (NestJS) | ❌ No | Read explanation below |
| **Neon DB** | PostgreSQL | ✅ Yes | Drop-in replacement for DB |
| **Railway** | Backend (NestJS) | ✅ Yes | Best free Docker host |
| **Render** | Backend (NestJS) | ✅ Yes | Free, sleeps after 15 min |
| **Fly.io** | Backend (NestJS) | ✅ Yes | Free 3 shared VMs |

---

## Why Vercel Cannot Run Your NestJS Backend

Vercel is a **serverless platform**. Here's what that means and why it breaks your app:

### What Vercel Actually Does
Vercel converts your code into **AWS Lambda functions**. Each API route becomes one function that:
- Spins up on demand (cold start: ~500ms–2s delay)
- Runs for max **10 seconds** (free tier), then kills the process
- Has **no persistent memory or state between requests**
- Has **no real filesystem** — ephemeral read-only `/tmp`

### Your App's Hard Blockers on Vercel

**1. Filesystem — JWT Keys Read From Disk**
```typescript
// auth.service.ts — this FAILS on Vercel
const privateKey = fs.readFileSync(
  './config/keys/jwtRS256.key',  // ← This file doesn't exist on Vercel
  'utf8'
);
```
Vercel doesn't persist files between deployments in a writable path.

**2. `child_process.spawn()` — RCE Endpoint**
```typescript
// app.service.ts — this FAILS on Vercel serverless sandbox
const ps = spawn(exec, args);  // ← No shell access in Lambda
```

**3. 5-Minute Timeout for AI Chat**
```typescript
// chat.service.ts
timeout: 300000  // 5 minutes ← Vercel free = 10 seconds max
```

**4. Native Modules Won't Compile**
- `libxmljs` — C++ native module, won't compile for Vercel's Lambda runtime
- `argon2` — Another native C++ module

**5. NestJS is a Persistent Server, Not Serverless**
NestJS boots, registers all modules, creates DB connections, reads keys — this happens **once** at startup. On Vercel, this entire bootstrap runs on **every single request** (cold start), making it slow and often hitting timeouts.

---

## The Working Architecture (Free)

```
┌─────────────┐     pushes to      ┌──────────────────┐
│   GitHub    │────────────────────▶│   Vercel         │
│ (code repo) │                     │  (React frontend)│
└─────────────┘                     └──────────────────┘
                                           │ API calls
                                           ▼
                                    ┌──────────────────┐
                                    │   Railway /      │
                                    │   Render /       │
                                    │   Fly.io         │
                                    │  (NestJS backend)│
                                    └──────────────────┘
                                           │ SQL
                                           ▼
                                    ┌──────────────────┐
                                    │   Neon DB        │
                                    │  (PostgreSQL)    │
                                    └──────────────────┘
```

---

## Free Backend Hosting Alternatives (Ranked)

### 🥇 Option 1: Railway (Recommended)

**Why it's best for your app:**
- Runs Docker containers directly (your `core/Dockerfile` works as-is)
- Always-on (no sleep on free tier)
- $5/month free credit — enough for a small app
- Automatic deploys from GitHub
- Environment variables UI

**Free tier limits:**
- $5 credit/month
- Estimated ~500 hours of compute (more than enough)
- Sleeps only if credit runs out

**Steps:**
1. Sign up at [railway.app](https://railway.app) with GitHub
2. New Project → Deploy from GitHub Repo → select `VirtueVulns3`
3. Set root directory to `.` (root), Dockerfile to `core/Dockerfile`
4. Add all env vars (see below)
5. Done — Railway gives you a public URL

---

### 🥈 Option 2: Render

**Why:**
- Free tier is genuinely free (no credit card)
- Supports Docker, Node.js
- Auto-deploy from GitHub

**Drawback:**
- Free tier **sleeps after 15 minutes of inactivity**
- First request after sleep takes ~30–60 seconds (cold start)
- For a security lab you demo occasionally → this is acceptable

**Steps:**
1. Sign up at [render.com](https://render.com) with GitHub
2. New → Web Service → Connect GitHub repo
3. Select Docker runtime, point to `core/Dockerfile`
4. Add env vars → Deploy

---

### 🥉 Option 3: Fly.io

**Why:**
- 3 shared VMs free, always-on
- Full Docker support
- Good global CDN

**Drawback:**
- Requires credit card to sign up (won't charge for free tier)
- CLI-based workflow is more complex

---

### ⚠️ Option 4: Koyeb / Cyclic / Adaptable.io

These work but have smaller free tiers and less community support. Use as last resort.

---

## Step-by-Step: Deploy on Railway + Vercel + Neon DB

### Step 1: Set Up Neon DB

1. Go to [neon.tech](https://neon.tech) → Sign up with GitHub → Free plan
2. Create a project → Select **PostgreSQL 17** → Region closest to you
3. Copy the **connection string** — looks like:
   ```
   postgresql://bc:abc123@ep-xxx.us-east-2.aws.neon.tech/bc?sslmode=require
   ```
4. In Neon's SQL editor, run the entire contents of `core/pg.sql` to create tables and seed data

---

### Step 2: Deploy Backend on Railway

1. Create account at [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub Repo** → authorize and select `VirtueVulns3`
3. Railway detects Docker → set **Dockerfile path** to `core/Dockerfile`
4. In **Variables** tab, add these environment variables:

```env
DATABASE_HOST=ep-xxx.us-east-2.aws.neon.tech
DATABASE_SCHEMA=bc
DATABASE_USER=bc
DATABASE_PASSWORD=<your neon password>
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
JKU_URL=https://<your-railway-url>.up.railway.app/api/auth/jku
X5U_URL=https://<your-railway-url>.up.railway.app/api/auth/x5u
AWS_BUCKET=https://<your-railway-url>.up.railway.app/api/storage
GOOGLE_MAPS_API=DEMON_SLAYERS_MAPS_API_KEY
TESTCASE=true
URL=https://<your-railway-url>.up.railway.app
```

> [!IMPORTANT]
> Neon DB requires SSL. Add `?sslmode=require` to your connection string OR set `DATABASE_SSL=true` in your ORM config.

5. Deploy → Railway builds the Docker image and starts the app
6. Go to **Settings → Networking → Generate Domain** → get your public URL

---

### Step 3: Deploy Frontend on Vercel

The frontend is a pure React/Vite static build — Vercel is perfect for this.

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select `VirtueVulns3` repo
3. Set:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variable:
   ```
   VITE_API_URL=https://<your-railway-url>.up.railway.app
   ```
5. Deploy → Vercel gives you a URL like `your-app.vercel.app`

> [!NOTE]
> Check your frontend API client files in `frontend/src/api/` to see if the base URL is hardcoded or uses an env variable. If hardcoded to `localhost:3000`, you'll need to update those files to use `import.meta.env.VITE_API_URL`.

---

## Neon DB — SSL Configuration for MikroORM

Neon requires SSL connections. You may need to update `backend/src/orm/` config to add SSL:

```typescript
// In your ORM config (orm.module.ts or mikro-orm.config.ts)
{
  type: 'postgresql',
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT,
  dbName: process.env.DATABASE_SCHEMA,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  driverOptions: {
    connection: {
      ssl: process.env.DATABASE_HOST?.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : false
    }
  }
}
```

---

## Summary Table

| Component | Service | Free? | Notes |
|---|---|---|---|
| Code / CI | **GitHub** | ✅ Free | Push → auto-deploy |
| Frontend (React) | **Vercel** | ✅ Free | Perfect fit, no changes needed |
| Backend (NestJS) | **Railway** | ✅ ~Free ($5 credit/mo) | Best option, Docker works |
| Backend (NestJS) | **Render** | ✅ Free | Sleeps after 15 min inactive |
| Database (PostgreSQL) | **Neon DB** | ✅ Free | Direct replacement, needs SSL |

**Total monthly cost: $0** (Railway $5 credit is usually sufficient for dev/demo workloads)

---

## What Still Won't Work in Cloud (By Design)

These are **intentional vulnerability features** that may behave differently in cloud:

| Feature | Issue | Workaround |
|---|---|---|
| RCE `/api/spawn` | Cloud container sandboxes often block shell exec | Test locally, or Railway allows it in full containers |
| File upload (`/api/upload`) | `/tmp/uploads` works but is ephemeral (cleared on restart) | Fine for the lab — files are deleted anyway |
| Path traversal simulation | Works fine — it's returning hardcoded fake data | No issue |
| AI Chat | Only works if you configure `CHAT_API_URL` to an accessible Ollama or OpenAI endpoint | Leave unconfigured or use OpenAI key |
