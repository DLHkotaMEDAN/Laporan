import { spawn } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const processes = [
  spawn(pnpm, ["--dir", "artifacts/api-server", "dev"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "19762" },
  }),
  spawn(pnpm, ["--dir", "artifacts/laporan-kerja", "dev"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "5173", BASE_PATH: "/" },
  }),
];

const stop = () => processes.forEach((process) => process.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

