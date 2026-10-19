# Deployment Verification Guide

## 📋 Overview

This guide provides step-by-step verification procedures for security fixes deployed to production. All critical security items from the audit have been implemented and must be verified in the production environment.

**Date:** 19 Oktober 2026
**Audit Completion:** ~75%
**Security Items:** 100% completed

---

## 🔒 Security Fixes to Verify

### SEC-02: PDF Endpoint Security
- ✅ Rate limiting (10 req/min)
- ✅ JWT authentication required
- ✅ Request validation
- ✅ Vercel configuration updated for API routing (2026-10-19)

### SEC-03: RLS Inactive Account Protection
- ✅ RLS policies check `is_active = true`
- ✅ Helper functions updated
- ✅ Migration deployed

### Security Headers
- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy: camera=(), microphone=(), geolocation=()
- ✅ HSTS (Strict-Transport-Security)
- ✅ CSP (Content-Security-Policy)

### Login Rate Limiting
- ✅ 5 failed attempts → 60 second lockout
- ✅ Exponential backoff (2s, 5s, 10s, 20s)

---

## 🚀 Pre-Deployment Checklist

### 1. Verify Build Success
```bash
# Frontend build
cd artifacts/laporan-kerja
pnpm build

# Backend build (if applicable)
cd artifacts/api-server
pnpm build
```

**Expected:** Build completes without errors

---

### 2. Verify Unit Tests Pass
```bash
cd artifacts/laporan-kerja
pnpm test:run
```

**Expected:** 64 tests pass

---

### 3. Verify Typecheck Pass
```bash
cd artifacts/laporan-kerja
pnpm typecheck
```

**Expected:** No TypeScript errors

---

### 4. Deploy to Staging

#### Frontend (Vercel)
1. Buka Vercel Dashboard
2. Pilih project `laporan-kerja`
3. Klik "Deploy"
4. Wait for build to complete
5. Verify deployment URL accessible

#### Backend (if applicable)
1. Deploy API server ke staging
2. Verify health endpoint responds
3. Check logs for errors

---

## 🔍 Production Verification Steps

### 1. Verify PDF Endpoint Security

#### Test 1.1: Unauthenticated Access (Should Fail)
```bash
# Test without authentication
curl -X POST https://your-domain.com/api/render-pdf \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Test</h1>"}'
```

**Expected:** `401 Unauthorized` or error message about missing auth

**Failure Action:** Check JWT middleware implementation in `api/render-pdf.ts`

---

#### Test 1.2: Rate Limiting (Should Block)
```bash
# Send 11 requests rapidly (10 is the limit)
for i in {1..11}; do
  curl -X POST https://your-domain.com/api/render-pdf \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN" \
    -d '{"html": "<h1>Test</h1>"}'
  echo "Request $i"
done
```

**Expected:** Request 11 returns `429 Too Many Requests`

**Failure Action:** Check rate limiting configuration in `api/render-pdf.ts`

---

#### Test 1.3: Request Validation (Should Block Large Payload)
```bash
# Send oversized payload (>1MB)
curl -X POST https://your-domain.com/api/render-pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN" \
  -d @large_file.json
```

**Expected:** `413 Payload Too Large` or validation error

**Failure Action:** Check payload size limit in `api/render-pdf.ts`

---

#### Test 1.4: Valid Request (Should Succeed)
```bash
# Send valid request with auth
curl -X POST https://your-domain.com/api/render-pdf \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN" \
  -d '{"html": "<h1>Test PDF</h1>"}' \
  --output test.pdf
```

**Expected:** PDF file downloaded successfully

**Failure Action:** Check PDF generation logic and auth validation

---

### 2. Verify RLS Inactive Account Protection

#### Test 2.1: Active Account Access (Should Succeed)
```sql
-- Set user as active
UPDATE public.profiles
SET is_active = true
WHERE email = 'test@example.com';

-- Login as active user
-- Access data via application
```

**Expected:** User can access data normally

**Failure Action:** Check RLS policies and helper functions

---

#### Test 2.2: Inactive Account Access (Should Fail)
```sql
-- Set user as inactive
UPDATE public.profiles
SET is_active = false
WHERE email = 'test@example.com';

-- Try to access data with existing token
-- (token obtained before deactivation)
```

**Expected:** Access denied (401/403) or no data returned

**Failure Action:** Check `current_access_role()`, `current_access_region()`, `current_access_team()` functions

---

#### Test 2.3: Verify Helper Functions
```sql
-- Test current_access_role function
SELECT public.current_access_role();

-- Should return role if is_active = true
-- Should return NULL if is_active = false
```

**Expected:** Returns correct role for active user, NULL for inactive

**Failure Action:** Check migration `20261014_add_is_active_check_to_rls.sql`

---

### 3. Verify Security Headers

#### Test 3.1: Check Frontend Headers
```bash
curl -I https://your-frontend-domain.com
```

**Expected Response Headers:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Failure Action:** Check `vercel.json` configuration

---

#### Test 3.2: Check Backend Headers
```bash
curl -I https://your-backend-domain.com/api/health
```

**Expected Response Headers:**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Failure Action:** Check Helmet middleware in `artifacts/api-server/src/app.ts`

---

#### Test 3.3: Verify CSP (Content-Security-Policy)
```bash
# Check CSP directives
curl -I https://your-domain.com | grep -i content-security-policy
```

**Expected:** CSP headers present with appropriate directives

**Failure Action:** Check CSP configuration in backend

---

### 4. Verify Login Rate Limiting

#### Test 4.1: Failed Login Attempts
```bash
# Attempt 5 failed logins
for i in {1..5}; do
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "wrong@example.com", "password": "wrong"}'
  echo "Attempt $i"
  sleep 1
done
```

**Expected:**
- Attempts 1-4: Error message with exponential backoff (2s, 5s, 10s, 20s)
- Attempt 5: Lockout message "Terlalu banyak percobaan gagal. Coba lagi dalam 60 detik."

**Failure Action:** Check login rate limiting in `src/pages/Login.tsx`

---

#### Test 4.2: Lockout Verification
```bash
# Try to login during lockout period
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "correct"}'
```

**Expected:** Login blocked during lockout period

**Failure Action:** Check sessionStorage lockout logic

---

#### Test 4.3: Successful Login After Lockout
```bash
# Wait 60 seconds
sleep 60

# Try correct credentials
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "correct"}'
```

**Expected:** Login succeeds after lockout expires

**Failure Action:** Check lockout expiration logic

---

### 5. Verify Application Functionality

#### Test 5.1: Login Flow
1. Buka aplikasi di production URL
2. Login dengan valid credentials
3. Verify redirect ke dashboard/halaman utama
4. Verify session established

**Expected:** Login successful, redirect correct

**Failure Action:** Check Supabase auth configuration

---

#### Test 5.2: Create Report
1. Login sebagai user dengan permission
2. Navigate ke halaman laporan
3. Create new report
4. Fill required fields
5. Save report

**Expected:** Report created successfully

**Failure Action:** Check form validation and RLS policies

---

#### Test 5.3: Export Excel/PDF
1. Navigate ke recap page
2. Click export button
3. Verify file downloads

**Expected:** File downloads successfully

**Failure Action:** Check export functionality

---

## 🐛 Troubleshooting

### PDF Endpoint Not Working

**Symptoms:**
- 401 Unauthorized even with valid token
- Rate limiting not working
- PDF generation fails

**Solutions:**
1. Check JWT token validity
2. Verify Supabase auth configuration
3. Check rate limiting configuration
4. Verify Puppeteer/Chromium availability
5. Check logs for errors

---

### RLS Not Working

**Symptoms:**
- Inactive user can still access data
- Helper functions returning wrong values

**Solutions:**
1. Verify migration deployed correctly
2. Check `is_active` column value
3. Test helper functions in Supabase SQL Editor
4. Check RLS policy definitions
5. Verify Supabase auth context

---

### Security Headers Missing

**Symptoms:**
- Headers not present in response
- Headers have wrong values

**Solutions:**
1. Check `vercel.json` configuration
2. Check backend Helmet middleware
3. Verify CSP directives
4. Check HSTS configuration
5. Redeploy if config changed

---

### Login Rate Limiting Not Working

**Symptoms:**
- No lockout after 5 failed attempts
- Lockout doesn't expire

**Solutions:**
1. Check sessionStorage logic
2. Verify lockout duration
3. Test in different browsers
4. Check browser console for errors
5. Verify Supabase auth responses

---

## 📊 Verification Checklist

Print and use this checklist for production verification:

### Security
- [ ] PDF endpoint requires authentication
- [ ] PDF endpoint rate limiting works (10 req/min)
- [ ] PDF endpoint validates payload size
- [ ] RLS checks is_active for inactive accounts
- [ ] Helper functions updated and working
- [ ] Security headers present on frontend
- [ ] Security headers present on backend
- [ ] CSP configured correctly
- [ ] HSTS configured correctly
- [ ] Login rate limiting works (5 attempts → lockout)
- [ ] Lockout expires after 60 seconds

### Functionality
- [ ] Login flow works correctly
- [ ] Session management works
- [ ] Create report works
- [ ] Export Excel works
- [ ] Export PDF works
- [ ] RLS policies work correctly for active users
- [ ] RLS policies block inactive users

### Performance
- [ ] Page load time acceptable
- [ ] PDF generation time acceptable
- [ ] Excel export time acceptable
- [ ] No console errors in production

---

## 📝 Post-Deployment Actions

### 1. Monitor Logs
- Check Vercel logs for errors
- Check Supabase logs for RLS violations
- Monitor rate limiting metrics

### 2. Performance Monitoring
- Monitor page load times
- Monitor API response times
- Monitor error rates

### 3. Security Monitoring
- Monitor failed login attempts
- Monitor rate limiting triggers
- Monitor RLS policy violations
- Monitor unusual access patterns

### 4. Rollback Plan
If critical issues found:
1. Revert to previous deployment
2. Fix issues in staging
3. Re-test thoroughly
4. Re-deploy to production

---

## 📞 Contact

For issues or questions:
- Check `DEPLOYMENT.md` for deployment procedures
- Check `ARCHITECTURE.md` for system architecture
- Check `SECURITY_ASSESSMENT_AND_IMPLEMENTATION_PLAN.md` for security details

---

## ✅ Sign-off

**Verification Completed By:** _________________
**Date:** _________________
**Environment:** _________________ (Staging/Production)
**All Tests Passed:** [ ] Yes [ ] No
**Issues Found:** _________________
**Approved for Production:** [ ] Yes [ ] No
