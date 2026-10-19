# 📊 Laporan App

Aplikasi manajemen laporan kerja dengan fitur pelaporan harian, mingguan, bulanan, dan integrasi Google Drive.

## 🏗️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js + TypeScript (alternative) / Vercel Serverless Functions (PDF)
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS 4
- **PDF Generation**: Puppeteer + Chromium (Vercel Serverless)
- **Package Manager**: pnpm (workspace)

## 📁 Project Structure

```
laporan/
├── api/                     # Vercel Serverless Functions (PDF generation)
│   ├── lib/
│   │   └── auth-utils.ts    # Supabase auth utilities
│   └── render-pdf.ts        # PDF generation endpoint
├── artifacts/
│   ├── api-server/          # Express backend server (alternative)
│   ├── laporan-kerja/       # React frontend application
│   └── mockup-sandbox/      # UI mockup/prototyping
├── lib/
│   ├── api-client-react/    # React API client
│   ├── api-spec/            # OpenAPI specification
│   └── api-zod/             # Zod schemas
├── scripts/                 # Build and utility scripts
└── artifacts/laporan-kerja/supabase/ # Supabase migrations & functions
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (install dengan `npm install -g pnpm`)
- PostgreSQL database (via Supabase or local)
- Google Cloud account (untuk Google Drive integration)

### Installation

1. **Clone repository**
```bash
git clone <repository-url>
cd laporan
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Setup environment variables**

#### Frontend (laporan-kerja)
```bash
cp artifacts/laporan-kerja/.env.example artifacts/laporan-kerja/.env
```

Edit `artifacts/laporan-kerja/.env`:
```bash
# Supabase credentials
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Google Drive credentials (client-side)
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
VITE_GOOGLE_API_KEY=<your-google-api-key>
```

#### Backend (api-server)
```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

Edit `artifacts/api-server/.env`:
```bash
# Server
NODE_ENV=development
PORT=19762
LOG_LEVEL=info

# Google Drive credentials (server-side)
GOOGLE_CLIENT_ID=<your-server-side-google-client-id>
GOOGLE_API_KEY=<your-server-side-google-api-key>
```

4. **Database and migrations**

The application uses Supabase directly through its client and service modules. The SQL files in `artifacts/laporan-kerja/supabase/migrations` are the authoritative database change history. Apply only migrations that are pending for the intended Supabase project, in filename order, using the Supabase SQL Editor after checking that project's migration state. These files extend the existing application schema; they are not a blank-database bootstrap. Do not add a second schema-management path without an explicit architecture decision.

5. **Start development servers**

Terminal 1 - Backend:
```bash
cd artifacts/api-server
pnpm dev
```

Terminal 2 - Frontend:
```bash
cd artifacts/laporan-kerja
pnpm dev
```

Aplikasi akan tersedia di:
- Frontend: http://localhost:5173
- Backend API: http://localhost:19762

## 🔧 Google Cloud Console Setup

Untuk mengaktifkan fitur upload ke Google Drive:

### 1. Create Google Cloud Project

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih project yang sudah ada
3. Enable APIs:
   - Google Drive API
   - Google Picker API

### 2. Create OAuth 2.0 Client ID (Client-side)

1. Navigasi ke **API & Services** → **Credentials**
2. Klik **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`
5. Authorized redirect URIs: (opsional, tergantung use case)
6. Copy **Client ID** dan paste ke `VITE_GOOGLE_CLIENT_ID`

### 3. Create API Key (Client-side)

1. Di halaman yang sama, klik **Create Credentials** → **API Key**
2. Set **Application restrictions**:
   - HTTP referrers:
     - Development: `http://localhost:5173/*`
     - Production: `https://yourdomain.com/*`
3. Set **API restrictions**:
   - Google Drive API
   - Google Picker API
4. Copy **API Key** dan paste ke `VITE_GOOGLE_API_KEY`

### 4. Create Server-side Credentials (Optional, untuk security yang lebih baik)

Untuk implementasi server-side proxy (lebih secure):

1. Buat OAuth 2.0 Client ID tambahan untuk server
2. Buat API Key tambahan dengan IP restrictions:
   - IP addresses: IP server production Anda
3. Set ke environment variables server:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_API_KEY`

### 5. Testing

1. Restart development server
2. Coba upload file ke Google Drive dari aplikasi
3. Monitor API usage di Google Cloud Console

## 📦 Available Scripts

### Root workspace
```bash
pnpm build              # Build seluruh workspace
pnpm typecheck          # Type check seluruh workspace
pnpm dev                # Start development servers
pnpm start              # Start production server
```

### Frontend (laporan-kerja)
```bash
cd artifacts/laporan-kerja
pnpm dev                # Start Vite dev server
pnpm build              # Build untuk production
pnpm serve              # Preview production build
pnpm typecheck          # TypeScript type check
```

### Backend (api-server)
```bash
cd artifacts/api-server
pnpm dev                # Build dan start dev server
pnpm build              # Build TypeScript ke JavaScript
pnpm start              # Start production server
pnpm typecheck          # TypeScript type check
```

## 🔒 Security Best Practices

### Environment Variables

1. **Jangan pernah commit .env file** - sudah di-.gitignore
2. **Gunakan API key yang berbeda** untuk setiap environment (dev, staging, prod)
3. **Set proper restrictions** di Google Cloud Console:
   - HTTP referrers untuk client-side keys
   - IP addresses untuk server-side keys
   - API restrictions untuk membatasi akses
4. **Rotate API keys secara regular** (minimal setiap 6 bulan)
5. **Monitor API usage** untuk detect abnormal activity

### Database Security

1. Keep Supabase Row Level Security enabled for client-accessible tables.
2. Review migration policies whenever tables, roles, or region access rules change.
3. Never expose a Supabase service-role key in frontend environment variables.
4. Keep regular backups for the production project.

### Code Security

1. Jangan gunakan `any` type di TypeScript
2. Validasi semua input user
3. Sanitasi data sebelum render ke UI
4. Review dan update dependencies secara regular

## 🧪 Testing

Project memiliki test infrastructure dengan Vitest (unit testing) dan Playwright (e2e testing).

### Unit Testing (Vitest)

```bash
cd artifacts/laporan-kerja

# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage
```

### E2E Testing (Playwright)

```bash
cd artifacts/laporan-kerja

# Run e2e tests
pnpm test:e2e

# Run e2e tests with UI
pnpm test:e2e:ui

# Run e2e tests in headed mode
pnpm test:e2e:headed
```

### Test Files

- Unit tests: `src/test/*.test.ts` dan `src/test/*.test.tsx`
- E2E tests: `e2e/*.spec.ts`
- Test setup: `src/test/setup.ts`

### Coverage Target

Target minimum code coverage: 70% (lines, functions, branches, statements)

### Planned Improvements

- [ ] Add unit tests untuk komponen critical
- [ ] Add integration tests untuk API endpoints
- [ ] Add e2e tests untuk user flows penting
- [ ] Achieve 70% code coverage

## 📝 Development Guidelines

Lihat `AI_RULES.md` untuk panduan development lengkap, termasuk:

- Struktur folder
- Frontend rules (React, Tailwind)
- Backend rules (Supabase, async/await)
- Database rules (PostgreSQL, relations)
- Authentication rules (Supabase Auth)
- API rules (RESTful, error handling)
- Security rules (env vars, input sanitization)

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process yang menggunakan port 5173 atau 19762
npx kill-port 5173
npx kill-port 19762
```

### Supabase connection failed
1. Verify `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` benar
2. Check Supabase project status
3. Verify network connection

### Google Drive upload disabled
1. Verify `VITE_GOOGLE_CLIENT_ID` dan `VITE_GOOGLE_API_KEY` diset
2. Check Google Cloud Console API restrictions
3. Check browser console untuk error messages
4. Verify OAuth consent screen sudah dikonfigurasi

### Build errors
```bash
# Clear cache dan rebuild
rm -rf node_modules
rm -rf artifacts/*/node_modules
rm -rf artifacts/*/dist
pnpm install
pnpm build
```

## 📄 License

MIT

## 🤝 Contributing

1. Fork repository
2. Buat branch untuk fitur (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

Untuk pertanyaan atau issues, silakan:
- Open issue di repository
- Contact maintainer
- Check documentation di Supabase dan Google Cloud Console
