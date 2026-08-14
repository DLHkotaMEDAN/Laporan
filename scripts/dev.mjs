import { spawn } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const forwardedArgs = process.argv.slice(2);
const processes = [
  spawn(pnpm, ["--dir", "artifacts/api-server", "dev"], {
    stdio: "inherit",
    env: { ...process.env, PORT: "19762" },
    shell: process.platform === "win32",
  }),
  spawn(pnpm, ["--dir", "artifacts/laporan-kerja", "dev", ...forwardedArgs], {
    stdio: "inherit",
    env: { ...process.env, PORT: "5173", BASE_PATH: "/" },
    shell: process.platform === "win32",
  }),
];

const stop = () => processes.forEach((process) => process.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
