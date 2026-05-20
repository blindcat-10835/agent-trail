#!/usr/bin/env node
// CLI entry shipped to npm. Launches the ingest service and the Next.js
// standalone server in the same Node process tree, mirroring scripts/start.sh
// but without a bash dependency.

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const pkgRoot = path.resolve(__dirname, "..");
const standaloneRoot = path.join(pkgRoot, ".next", "standalone");
const serverEntry = path.join(standaloneRoot, "server.js");
const ingestEntry = path.join(pkgRoot, "ingest", "dist", "index.js");

for (const [label, entry] of [
  ["Next.js standalone server", serverEntry],
  ["ingest service", ingestEntry],
]) {
  if (!fs.existsSync(entry)) {
    console.error(`[agents-tracing] missing ${label} at ${entry}`);
    console.error("[agents-tracing] the package may be installed incorrectly.");
    process.exit(1);
  }
}

const port = process.env.PORT || "3030";
const ingestPort = process.env.INGEST_PORT || "8078";
const ingestDbPath =
  process.env.INGEST_DB_PATH ||
  path.join(os.homedir(), ".agents-tracing", "ingest.db");

fs.mkdirSync(path.dirname(ingestDbPath), { recursive: true });

const baseEnv = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  INGEST_PORT: ingestPort,
  INGEST_DB_PATH: ingestDbPath,
};

console.log(`[agents-tracing] starting ingest on port ${ingestPort}`);
const ingest = spawn(process.execPath, [ingestEntry], {
  stdio: "inherit",
  env: baseEnv,
});

console.log(`[agents-tracing] starting dashboard on http://localhost:${port}`);
const server = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  cwd: standaloneRoot,
  env: { ...baseEnv, PORT: port, HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[agents-tracing] received ${signal}, shutting down`);
  for (const child of [ingest, server]) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

let exiting = false;
function exitWith(code) {
  if (exiting) return;
  exiting = true;
  process.exitCode = code ?? 0;
  shutdown("SIGTERM");
}

server.on("exit", (code, signal) => {
  if (signal) {
    exitWith(0);
  } else {
    exitWith(code ?? 0);
  }
});

ingest.on("exit", (code, signal) => {
  if (shuttingDown || exiting) return;
  console.error(
    `[agents-tracing] ingest exited unexpectedly (code=${code} signal=${signal})`,
  );
  exitWith(code ?? 1);
});
