import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers dengan Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "https://*.supabase.co", "https://*.googleapis.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Batasi CORS hanya ke origin yang dikenal.
// Request same-origin (frontend di Replit/Dyad yang sama) tidak butuh CORS
// karena origin === undefined — sudah otomatis diizinkan.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",  // Vite dev server
  "http://localhost:4173",  // Vite preview
  "http://localhost:19762", // Dyad/Replit dev port
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin requests: origin header tidak dikirim browser (undefined)
      if (!origin) return callback(null, true);
      // Izinkan semua subdomain *.replit.app dan *.replit.dev (production Dyad)
      if (/\.replit\.(app|dev)$/.test(origin)) return callback(null, true);
      // Izinkan origin lokal yang terdaftar
      if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      // Tolak semua origin lain
      callback(new Error(`CORS: origin tidak diizinkan — ${origin}`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
// A print-ready report contains the rendered table and its styles, so it can
// legitimately be larger than Express' default 100 KB JSON body limit.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In deployment the API server also hosts the compiled React app. This keeps
// the PDF endpoint on the same origin as the app, so file sharing works on
// Android and Windows without a CORS or popup-origin mismatch.
const frontendDir = path.resolve(import.meta.dirname, "../../laporan-kerja/dist/public");
if (existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(frontendDir, "index.html")));
}

export default app;
