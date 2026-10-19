# Laporan App - Architecture Documentation

## 📋 Overview

Aplikasi "Laporan" adalah sistem manajemen laporan harian/mingguan/bulanan untuk Dinas Lingkungan Hidup Kota Medan. Aplikasi ini memungkinkan pencatatan kegiatan, perencanaan kerja, dan tracking penggunaan BBM/oli/SPJ.

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│  artifacts/laporan-kerja/                              │
│  - React 19.x + TypeScript                            │
│  - Vite 7.x                                            │
│  - Supabase Auth                                       │
│  - React Router (Wouter)                               │
└─────────────────────────────────────────────────────────┘
                           │
                           │ HTTP/REST API
                           │
┌─────────────────────────────────────────────────────────┐
│                  Backend (Express + Node.js)                │
│  artifacts/api-server/                                 │
│  - Express 5.x                                         │
│  - Supabase Client                                   │
│  - Rate Limiting (express-rate-limit)                  │
│  - Security Headers (Helmet)                          │
└─────────────────────────────────────────────────────────┘
                           │
                           │ PostgreSQL + Supabase
                           │
┌─────────────────────────────────────────────────────────┐
│                    Database Layer                       │
│  - Supabase (PostgreSQL)                              │
│  - Row Level Security (RLS) with is_active check       │
│  - Storage (report-photos, nota-dinas)                │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

### Frontend (artifacts/laporan-kerja/)

```
src/
├── components/          # UI Components
│   ├── DriveUploadDialog.tsx
│   ├── ReportForm.tsx
│   ├── WorkPlanForm.tsx
│   ├── UserManagement.tsx
│   └── ...
├── pages/               # Page Components
│   ├── Login.tsx
│   ├── DailyRecap.tsx
│   ├── WeeklyRecap.tsx
│   ├── MonthlyRecap.tsx
│   └── ...
├── services/            # Data Services
│   ├── reportService.ts
│   ├── workPlanService.ts
│   ├── spjOliService.ts
│   └── ...
├── hooks/               # React Hooks
│   ├── useAuth.ts
│   ├── useRegionName.ts
│   └── ...
├── lib/                 # Utilities
│   ├── supabase.ts
│   ├── logger.ts
│   └── utils.ts
├── types/               # TypeScript Types
│   ├── report.ts
│   ├── workPlan.ts
│   └── ...
└── utils/               # Helper Functions
    ├── report-helpers.ts
    ├── pdf-preview.ts
    └── ...
```

### Backend (artifacts/api-server/)

```
src/
├── routes/              # API Routes
│   ├── pdf.ts
│   └── ...
├── lib/                 # Libraries
│   ├── auth-middleware.ts
│   └── ...
└── app.ts               # Express App
```

---

## 🔐 Security Architecture

### Authentication
- **Provider**: Supabase Auth
- **Method**: JWT (JSON Web Tokens)
- **Session**: Stored in browser localStorage via Supabase client
- **Inactivity Check**: RLS policies enforce `is_active = true`

### Authorization
- **Model**: Role-Based Access Control (RBAC)
- **Roles**:
  - `admin` - Full access
  - `pimpinan` - Read-only access
  - `admin_laporan` - Manage reports
  - `admin_rencana_kerja` - Manage work plans
  - `admin_bbm` - Manage BBM
  - `admin_spj_oli` - Manage SPJ Oli
  - `laporan` - Read-only reports
  - `rencana_kerja` - Read-only work plans
  - `bbm` - Read-only BBM
  - `spj_oli` - Read-only SPJ Oli
  - `operator` - Read/write access

### Row Level Security (RLS)
- **Enforcement**: Database-level via Supabase RLS policies
- **Helper Functions**:
  - `current_access_role()` - Returns user role if `is_active = true`
  - `current_access_region()` - Returns user region if `is_active = true`
  - `current_access_team()` - Returns user team if `is_active = true`
  - `has_record_access()` - Checks permissions based on role and action

### Security Headers
- **Frontend**: Configured in `vercel.json`
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
  - HSTS (Strict-Transport-Security)
  - Permissions-Policy (camera, microphone, geolocation)
- **Backend**: Helmet middleware with CSP

### Rate Limiting
- **PDF Endpoint**: 10 requests per minute per IP
- **Login**: 5 failed attempts → 30 second lockout

---

## 🗄️ Database Schema

### Main Tables

#### `reports`
- Daily activity reports
- Fields: `id`, `date`, `category`, `tasks`, `region_id`, `team_id`, `created_at`, `updated_at`, `deleted_at`

#### `work_plans`
- Weekly work plans
- Fields: `id`, `date`, `category`, `tasks`, `region_id`, `team_id`, `created_at`, `updated_at`, `deleted_at`

#### `spj_oli`
- SPJ Oli records
- Fields: `id`, `date`, `region_id`, `team_id`, `spj_number`, `oil_name`, `quantity`, `created_at`, `updated_at`

#### `profiles`
- User profiles
- Fields: `id`, `email`, `role`, `roles` (array), `region_id`, `team_id`, `is_active`, `created_at`, `updated_at`

#### `audit_logs`
- Audit trail
- Fields: `id`, `user_id`, `action`, `entity_type`, `details`, `created_at`

---

## 🔧 Key Integrations

### Supabase
- **Auth**: Authentication and user management
- **Database**: PostgreSQL with RLS
- **Storage**: File storage for report photos and nota dinas
- **Realtime**: (if used in future)

### Google Drive
- **Purpose**: Backup nota dinas PDFs
- **Method**: OAuth + Google Picker API
- **Implementation**: `DriveUploadDialog.tsx`

### PDF Generation
- **Library**: jsPDF, pdfjs-dist
- **Backend**: Puppeteer/Chromium (Vercel serverless function)
- **Rate Limiting**: 10 req/min

### Excel Export
- **Library**: ExcelJS
- **Features**: Recap harian/mingguan/bulanan
- **Format**: Custom Excel with formatting

---

## 📦 Technology Stack

### Frontend
- **Framework**: React 19.x
- **Build Tool**: Vite 7.x
- **Language**: TypeScript
- **Routing**: Wouter 3.x
- **UI**: Radix UI + Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts 2.x
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express 5.x
- **Security**: Helmet, express-rate-limit
- **Database**: Supabase (PostgreSQL)

### Testing
- **Unit Tests**: Vitest 2.x
- **Component Tests**: React Testing Library
- **E2E Tests**: Playwright (configured, not implemented)
- **Coverage**: Vitest Coverage v8

### CI/CD
- **Platform**: GitHub Actions
- **Jobs**: Frontend (typecheck, test, build), Backend (typecheck, build)
- **Triggers**: Push/PR to main/master/develop

---

## 🚀 Deployment

### Frontend
- **Platform**: Vercel
- **Build Command**: `pnpm build`
- **Environment Variables**: Vercel Dashboard
- **Config**: `vercel.json`

### Backend
- **Platform**: Vercel (or Node.js server)
- **Build Command**: `pnpm build` (artifacts/api-server)
- **Environment Variables**: Vercel Dashboard or .env

### Database
- **Platform**: Supabase
- **Project**: ffgksqjznamthsdbkstu
- **URL**: https://ffgksqjznamthsdbkstu.supabase.co

---

## 🔄 Data Flow

### 1. User Login
```
User → Login.tsx → Supabase Auth → JWT Token → localStorage → AuthContext
```

### 2. Create Report
```
User → ReportForm.tsx → reportService.save() → Supabase (reports table) → RLS check → Insert/Update
```

### 3. Generate PDF
```
User → Preview Button → api/render-pdf.ts → Puppeteer → HTML → PDF → Download
```

### 4. Export Excel
```
User → Export Button → ExcelJS → File Download
```

---

## 🧪 Testing Strategy

### Unit Tests
- **Coverage**: 64 tests (utilities, helpers, components)
- **Framework**: Vitest
- **Location**: `src/test/`

### Integration Tests
- **Status**: Not implemented
- **Recommended**: Service layer tests with mocked Supabase

### E2E Tests
- **Framework**: Playwright (configured)
- **Status**: Not implemented
- **Recommended**: Critical user flows (login, create report, export)

---

## 📝 Development Guidelines

### Code Style
- **Language**: TypeScript with strict mode
- **Linting**: ESLint (if configured)
- **Formatting**: Prettier (if configured)
- **Type Safety**: No `any` types (use `unknown` for errors)

### Best Practices
- Use centralized logger (`src/lib/logger.ts`) instead of console
- Use domain types from `src/types/` instead of ad-hoc interfaces
- Follow existing patterns for new components
- Add tests for new features

### Security
- Never commit secrets or API keys
- Use environment variables for sensitive data
- Validate all user inputs
- Use RLS for database access control
- Implement rate limiting for public endpoints

---

## 🐛 Known Issues & Limitations

### Testing
- Coverage is still low (~5% estimated)
- No E2E tests implemented
- Service layer tests need complex mocking

### Dependencies
- Some packages are outdated (see `pnpm outdated`)
- Major version updates pending (Vite 8, Vitest 5, Zod 4, etc.)

### Documentation
- Component documentation (Storybook) not implemented
- API documentation (Swagger UI) not implemented
- ERD diagram not created

---

## 📚 Related Documentation

- [Security Assessment](SECURITY_ASSESSMENT_AND_IMPLEMENTATION_PLAN.md)
- [Audit Report](AUDIT_REPORT.md)
- [README](README.md)
