# Cyber Tabletop — Setup Guide

## Quick start (local dev, no auth/DB needed)

```bash
npm install
npm run dev
```

Opens on http://localhost:3000. Auth is **disabled** locally — just go to `/admin`.  
Sessions are in-memory (reset on restart). Templates stored in localStorage.

---

## Production setup on Vercel

### Step 1 — Deploy
Push to GitHub, import in Vercel, deploy.

### Step 2 — Auth secret
In Vercel → Project → Settings → Environment Variables, add:

```
AUTH_SECRET          = <run: openssl rand -base64 32>
NEXTAUTH_URL         = https://your-deployment.vercel.app
ADMIN_EMAIL          = admin@your-org.nl
ADMIN_PASSWORD       = your-strong-password
```

### Step 3 — Database (Vercel KV)
1. Vercel Dashboard → **Storage** → **Create Database** → **KV**
2. Name it anything (e.g. `cyber-tabletop-kv`)
3. **Connect to Project** → select your project
4. Vercel auto-injects: `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

That's it. Sessions and templates now persist across restarts and deploys.

### Step 4 — AI generation (optional)
```
ANTHROPIC_API_KEY    = sk-ant-...
```

Get from: https://console.anthropic.com → API Keys

---

## Access model

| Who           | How                    | Needs account? |
|---------------|------------------------|----------------|
| Facilitator   | `/login` → `/admin`    | ✅ Yes          |
| Admin         | `/login` → `/admin`    | ✅ Yes          |
| Participant   | `/join` → join code    | ❌ No           |

### Add facilitator accounts
After first deploy, go to `/admin/users` to create facilitator accounts.

Or via API:
```bash
curl -X POST https://your-app.vercel.app/api/users \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"name":"Jan","email":"jan@org.nl","password":"secret123","role":"facilitator"}'
```

---

## Environment variables reference

| Variable                      | Required | Description                              |
|-------------------------------|----------|------------------------------------------|
| `AUTH_SECRET`                 | ✅ prod   | NextAuth signing secret (32 random bytes)|
| `NEXTAUTH_URL`                | ✅ prod   | Full URL of your deployment              |
| `ADMIN_EMAIL`                 | ✅ prod   | Email for auto-seeded admin account      |
| `ADMIN_PASSWORD`              | ✅ prod   | Password for auto-seeded admin account   |
| `KV_URL`                      | ⭐ rec'd  | Vercel KV connection string              |
| `KV_REST_API_URL`             | ⭐ rec'd  | Vercel KV REST URL (auto from KV)        |
| `KV_REST_API_TOKEN`           | ⭐ rec'd  | Vercel KV auth token (auto from KV)      |
| `ANTHROPIC_API_KEY`           | Optional | Enables AI scenario generation           |
