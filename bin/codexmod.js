#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const injectorPath = join(rootDir, "src", "injector.js");

const DEFAULT_PORT = Number(process.env.CODEXMOD_PORT || 9229);
const DEFAULT_MAC_APP = "/Applications/Codex.app/Contents/MacOS/Codex";

function parseArgs(argv) {
  const args = {
    port: DEFAULT_PORT,
    app: process.env.CODEXMOD_CODEX_PATH || "",
    userDataDir: process.env.CODEXMOD_USER_DATA_DIR || "",
    noLaunch: false,
    extra: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") args.port = Number(argv[++i]);
    else if (arg === "--app") args.app = argv[++i];
    else if (arg === "--user-data-dir") args.userDataDir = argv[++i];
    else if (arg === "--no-launch") args.noLaunch = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else args.extra.push(arg);
  }

  return args;
}

function printHelp() {
  console.log(`CodexMod

Usage:
  codexmod [--port 9229] [--app /path/to/Codex] [--user-data-dir path]
  codexmod --no-launch --port 9229

Options:
  --app             Path to Codex executable. macOS default: ${DEFAULT_MAC_APP}
  --port            Chrome DevTools Protocol port. Default: ${DEFAULT_PORT}
  --user-data-dir   Optional isolated Electron profile directory.
  --no-launch       Attach to an already-running Codex instance.
`);
}

async function isExecutable(file) {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultWindowsCandidates() {
  const home = homedir();
  return [
    join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), "Programs", "Codex", "Codex.exe"),
    join(process.env.PROGRAMFILES || "C:\\Program Files", "Codex", "Codex.exe")
  ];
}

async function resolveAppPath(requested) {
  if (requested) return requested;
  if (platform() === "darwin") return DEFAULT_MAC_APP;
  if (platform() === "win32") {
    const found = defaultWindowsCandidates().find((candidate) => existsSync(candidate));
    if (found) return found;
  }
  return "codex";
}

async function launchCodex(args) {
  if (args.noLaunch) return null;

  const appPath = await resolveAppPath(args.app);
  if (appPath.includes("/") && !(await isExecutable(appPath))) {
    throw new Error(`Codex executable was not found or is not executable: ${appPath}`);
  }

  const launchArgs = [
    `--remote-debugging-port=${args.port}`,
    "--remote-allow-origins=*"
  ];

  if (args.userDataDir) {
    launchArgs.push(`--user-data-dir=${args.userDataDir}`);
  }

  launchArgs.push(...args.extra);

  console.log(`[codexmod] Launching Codex: ${appPath}`);
  const child = spawn(appPath, launchArgs, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  return child;
}

function runInjector(args) {
  const child = spawn(process.execPath, [injectorPath, "--port", String(args.port)], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  });

  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await launchCodex(args);
  runInjector(args);
}

main().catch((error) => {
  console.error(`[codexmod] ${error.message}`);
  process.exit(1);
});
