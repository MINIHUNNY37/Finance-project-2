# CI/CD Setup: Local → GitHub → Vercel Auto-Deploy

## Current Status

| Check | Status |
|---|---|
| GitHub remote connected | ✅ (via MINIHUNNY37/Finance-project-2) |
| Vercel config (`vercel.json`) | ❌ Missing |
| GitHub Actions workflow | ❌ Missing |
| Auto-deploy on push | ❌ Not configured |

---

## Option A: Vercel Git Integration (Recommended — No GitHub Actions needed)

Vercel has a native GitHub integration that watches your repo and auto-deploys on every push. This is the simplest path and requires **zero config files**.

### Step 1: Import the repo into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select `MINIHUNNY37/Finance-project-2`
4. Vercel auto-detects Next.js — no framework config needed

### Step 2: Set environment variables in Vercel dashboard

Go to **Project → Settings → Environment Variables** and add:

```
NEXTAUTH_SECRET          = <generate with: openssl rand -base64 32>
NEXTAUTH_URL             = https://your-app.vercel.app
GOOGLE_CLIENT_ID         = <from Google Cloud Console>
GOOGLE_CLIENT_SECRET     = <from Google Cloud Console>
DATABASE_URL             = postgresql://user:pass@host/db?sslmode=require
ANTHROPIC_API_KEY        = <from console.anthropic.com>
```

> Set each variable for **Production**, **Preview**, and **Development** environments as needed.

### Step 3: Configure Google OAuth redirect URI

In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth client:

Add to **Authorized redirect URIs**:
```
https://your-app.vercel.app/api/auth/callback/google
```

### Step 4: Push to main

From this point on, every push to `main` triggers an automatic Vercel deployment:

```bash
git push origin main
```

Pull requests automatically get **preview deployments** at a unique URL.

---

## Option B: Add GitHub Actions for Pre-Deploy Checks (Optional)

Use this if you want lint/type-check to run before Vercel deploys.

### Step 1: Create the workflow file

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit
```

### Step 2: Block Vercel deploys on CI failure (optional)

In Vercel dashboard → **Project → Settings → Git**:
- Enable **"Require checks to pass before deploying"**
- Select the `CI / check` workflow

---

## Deployment Flow (after setup)

```
Local change
    │
    ▼
git push origin main
    │
    ▼
GitHub receives push
    │
    ├─► GitHub Actions runs lint + type-check (if configured)
    │       └─► ✅ Pass → continues
    │           ❌ Fail → Vercel deploy blocked
    │
    ▼
Vercel detects push
    │
    ▼
Vercel builds (next build)
    │
    ▼
Auto-deployed to production URL ✅
```

---

## vercel.json (Optional — for custom config)

Only needed if you want to override Vercel defaults. For this Next.js project, Vercel auto-detects everything correctly. But if you need it:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "regions": ["iad1"]
}
```

Create this at the project root if you need custom regions or commands.

---

## Database Note (Prisma + PostgreSQL)

After deployment, run the Prisma migration against your production DB:

```bash
# From local, pointed at production DATABASE_URL
DATABASE_URL="your-prod-url" npx prisma db push
```

Or hit the seed endpoints after deploy:
```
POST /api/admin/seed-markets   # Seeds NASDAQ-100 + S&P 500 universe
POST /api/admin/seed-history   # Seeds historical OHLC + quarterly stats
```

---

## CLAUDE.md Note

The `CLAUDE.md` in this repo describes a **Vite + React 19** project, but this repo is **Next.js 15**. The CLAUDE.md should be updated — see below for the correct version.

---

## Correct CLAUDE.md for This Project

```markdown
## Commands
\`\`\`bash
npm run dev       # Start dev server (Next.js HMR on localhost:3000)
npm run build     # Type-check + production build
npm run lint      # ESLint
\`\`\`

## Architecture
**Stack:** Next.js 15 (App Router) + TypeScript, `@xyflow/react` for the canvas,
Zustand for state, PostgreSQL via Prisma, NextAuth for auth, Anthropic SDK for AI.

**Branch:** Always develop on `claude/stock-scenario-mapper-3vPPY`

## Key Files
| File | Purpose |
|---|---|
| `app/types/index.ts` | All shared TypeScript types (Entity, Relationship, GeoEvent, etc.) |
| `app/components/MapCanvas.tsx` | Main interactive canvas |
| `app/components/StockFlashcard.tsx` | 5-page stock analysis modal |
| `app/components/ScenarioPropagator.tsx` | AI scenario impact UI |
| `app/api/scenario/route.ts` | Claude AI scenario endpoint |
| `app/api/stocks/[ticker]/flashcard/route.ts` | Claude flashcard endpoint |
| `prisma/schema.prisma` | Full DB schema |

## Adding a New Entity Feature
1. Add types to `app/types/index.ts`
2. Update `EntityDialog.tsx` for the edit form
3. Update `EntityCard.tsx` for the canvas display
4. Update `MapCanvas.tsx` if new canvas behaviour is needed

## Environment Variables Required
See `.env.example` — need NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, DATABASE_URL, ANTHROPIC_API_KEY
\`\`\`
```
