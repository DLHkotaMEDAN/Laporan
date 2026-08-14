import express, { type Express } from "express";
import cors from "cors";
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
app.use(cors());
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
