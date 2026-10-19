# Laporan App - Deployment Guide

## 📋 Overview

This guide covers deployment procedures for the Laporan App, including frontend, backend, and database components.

---

## 🏗️ Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Production Environment                 │
├─────────────────────────────────────────────────────────┤
│  Frontend: Vercel                                      │
│  Backend: Vercel Serverless Functions (optional)      │
│  Database: Supabase                                    │
│  Storage: Supabase Storage                            │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Frontend Deployment (Vercel)

### Prerequisites

1. **Vercel Account**
   - Sign up at https://vercel.com
   - Connect GitHub repository

2. **Environment Variables** (Vercel Dashboard)
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ffgksqjznamthsdbkstu.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Deployment Steps

#### Option 1: Via Vercel Dashboard (Recommended)

1. **Import Project**
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import from GitHub
   - Select `dyad-apps/laporan` repository
   - Select `artifacts/laporan-kerja` as root directory

2. **Configure Build Settings**
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`

3. **Set Environment Variables**
   - Go to Settings → Environment Variables
   - Add Supabase URL and anon key

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Access via Vercel-provided URL

#### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd artifacts/laporan-kerja
vercel --prod
```

---

## 🔧 Backend Deployment (Vercel Serverless)

### PDF Generation Endpoint

The PDF generation is implemented as a Vercel Serverless Function located in the `api/` directory at the workspace root.

**Prerequisites:**

1. **Environment Variables** (Vercel Dashboard)
   ```
   VITE_SUPABASE_URL=https://ffgksqjznamthsdbkstu.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. **Dependencies** (already in workspace root package.json)
   - `@sparticuz/chromium` - Chromium for serverless PDF generation
   - `puppeteer-core` - Headless browser control
   - `@supabase/supabase-js` - Supabase client for auth

### Deployment Steps

The API functions are automatically deployed by Vercel when the root directory is deployed. The `vercel.json` configuration ensures:

1. **Function Configuration** (vercel.json)
   ```json
   "functions": {
     "api/**/*.ts": {
       "memory": 2048,
       "maxDuration": 60
     }
   }
   ```

2. **Rewrite Rules** (vercel.json)
   - `/api/:path*` → `/api/:path*` (routes to serverless functions)
   - `/(.*)` → `/index.html` (fallback to SPA)

3. **Vercel Deployment**
   - Deploy from root directory of workspace
   - Vercel automatically detects `api/` directory as serverless functions
   - Functions are deployed at `/api/render-pdf`

### Alternative: Express API Server

For production, you may also deploy the Express API server (`artifacts/api-server`) separately:

1. **Deploy API Server as Serverless Function**
   - Currently backend is Express, may need refactoring for serverless
   - For now, backend can be deployed as a separate Vercel project or traditional server

2. **Recommended**: Keep backend on separate server (VPS or Vercel)
   - Backend can run on traditional server with Node.js
   - Frontend communicates via REST API

---

## 🗄️ Database Deployment (Supabase)

### Prerequisites

1. **Supabase Project**
   - Project: ffgksqjznamthsdbkstu
   - URL: https://ffgksqjnamthsdbkstu.supabase.co

### Migration Deployment

#### Manual Deployment (Recommended for Production)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select project: ffgksqjznamthsdbkstu

2. **SQL Editor**
   - Click "SQL Editor" in sidebar
   - Click "New query"

3. **Run Migration**
   - Copy migration SQL from `artifacts/laporan-kerja/supabase/migrations/`
   - Paste into SQL Editor
   - Click "Run"

4. **Verify**
   - Check "Database → Migrations" to confirm migration deployed

#### SEC-03 Migration (Already Deployed)

The following migration has been deployed:
- `20261014_add_is_active_check_to_rls.sql`

This ensures inactive accounts cannot access data via RLS.

---

## 🔐 Security Configuration

### Environment Variables

**Frontend (.env.local for development, Vercel Dashboard for production):**
```bash
VITE_SUPABASE_URL=https://ffgksqjznamthsdbkstu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Backend (.env for development, Vercel Dashboard for production):**
```bash
SUPABASE_URL=https://ffgksqznamthsdbkstu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=your_jwt_secret_here
```

### Security Headers

**Frontend (vercel.json):**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

**Backend (Helmet middleware):**
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

---

## 📝 Post-Deployment Checklist

### Frontend
- [ ] Verify build succeeds
- [ ] Test login functionality
- [ ] Test create report functionality
- [ ] Test export Excel/PDF functionality
- [ ] Verify security headers are applied
- [ ] Check console for errors

### Backend
- [ ] Verify build succeeds
- [ ] Test API endpoints
- [ ] Verify rate limiting works
- [ ] Check JWT validation
- [ ] Verify security headers are applied

### Database
- [ ] Verify migrations deployed
- [ ] Test with inactive account (should fail)
- [ ] Test with active account (should succeed)
- [ ] Verify RLS policies work correctly

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/ci.yml`

**Jobs:**
1. **Frontend**
   - Install dependencies
   - Typecheck (TypeScript)
   - Run tests (Vitest)
   - Build (Vite)

2. **Backend**
   - Install dependencies
   - Typecheck (TypeScript)
   - Build (ESBuild)

**Triggers:**
- Push to `main`, `master`, `develop`
- Pull requests to `main`, `master`, `develop`

### Manual Deployment Steps

1. **Merge PR to main**
2. **GitHub Actions runs CI**
3. **Verify CI passes**
4. **Pull latest changes**
5. **Deploy to Vercel** (automatic or manual)
6. **Run post-deployment checks**

---

## 🐛 Troubleshooting

### Build Failures

**TypeScript Errors:**
```bash
cd artifacts/laporan-kerja
pnpm typecheck
```

**Test Failures:**
```bash
cd artifacts/laporan-kerja
pnpm test:run
```

**Build Errors:**
```bash
cd artifacts/laporan-kerja
pnpm build
```

### Runtime Errors

**Supabase Connection Failed:**
- Check environment variables
- Verify Supabase project is active
- Check network connectivity

**Auth Errors:**
- Verify JWT token is valid
- Check user is active (`is_active = true`)
- Verify RLS policies are correct

**PDF Generation Failed:**
- Check rate limit (10 req/min)
- Verify JWT token is provided
- Check Chromium/Puppeteer availability

---

## 📚 Additional Resources

- [Architecture Documentation](ARCHITECTURE.md)
- [Security Assessment](SECURITY_ASSESSMENT_AND_IMPLEMENTATION_PLAN.md)
- [Audit Report](AUDIT_REPORT.md)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
