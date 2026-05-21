#!/usr/bin/env node
// CLI entry shipped to npm. Launches the ingest service and the Next.js
// standalone server in the same Node process tree without a shell dependency.

const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const pkgRoot = path.resolve(__dirname, "..");
const standaloneCandidates = [path.join(pkgRoot, ".next", "standalone"), pkgRoot];
const standaloneRoot =
  standaloneCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "server.js")),
  ) || standaloneCandidates[0];
const serverEntry = path.join(standaloneRoot, "server.js");
const ingestEntry = path.join(pkgRoot, "ingest", "dist", "index.js");
const logLevel = (
  process.env.AGENTS_TRACING_LOG_LEVEL ||
  process.env.INGEST_LOG_LEVEL ||
  "warn"
).toLowerCase();
const verboseLogs = logLevel === "debug";
const silentLogs = logLevel === "silent";
const maxBufferedLines = Number.parseInt(
  process.env.AGENTS_TRACING_LOG_BUFFER_LINES || "200",
  10,
);
const recentLogs = [];

function keyLog(message) {
  if (!silentLogs) console.log(message);
}

function rememberLog(label, stream, chunk) {
  const text = chunk.toString();
  if (verboseLogs) {
    const output = stream === "stderr" ? process.stderr : process.stdout;
    output.write(text);
  }

  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    recentLogs.push(`[${label}:${stream}] ${line}`);
    while (recentLogs.length > maxBufferedLines) recentLogs.shift();
  }
}

function flushRecentLogs(reason) {
  if (silentLogs || recentLogs.length === 0) return;
  console.error(`[agents-tracing] ${reason}`);
  console.error(`[agents-tracing] recent child logs:`);
  for (const line of recentLogs) {
    console.error(line);
  }
}

function spawnManaged(label, command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => rememberLog(label, "stdout", chunk));
  child.stderr.on("data", (chunk) => rememberLog(label, "stderr", chunk));
  child.on("error", (err) => {
    console.error(`[agents-tracing] failed to start ${label}: ${err.message}`);
    flushRecentLogs(`${label} failed to spawn`);
    exitWith(1);
  });
  return child;
}

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
  AGENTS_TRACING_LOG_LEVEL: logLevel,
  INGEST_LOG_LEVEL: process.env.INGEST_LOG_LEVEL || logLevel,
  INGEST_PORT: ingestPort,
  INGEST_DB_PATH: ingestDbPath,
};

const ingest = spawnManaged("ingest", process.execPath, [ingestEntry], {
  env: baseEnv,
});

keyLog(`[agents-tracing] dashboard: http://localhost:${port}`);
const server = spawnManaged("dashboard", process.execPath, [serverEntry], {
  cwd: standaloneRoot,
  env: { ...baseEnv, PORT: port, HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (verboseLogs) keyLog(`[agents-tracing] received ${signal}, shutting down`);
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
  if (shuttingDown || signal) {
    exitWith(0);
  } else {
    if ((code ?? 0) !== 0) {
      flushRecentLogs(`dashboard exited unexpectedly (code=${code})`);
    }
    exitWith(code ?? 0);
  }
});

ingest.on("exit", (code, signal) => {
  if (shuttingDown || exiting) return;
  flushRecentLogs(
    `ingest exited unexpectedly (code=${code} signal=${signal})`,
  );
  exitWith(code ?? 1);
});
