#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const codexPlusPlusRepo = "https://github.com/b-nnett/codex-plusplus.git";
const sourceRoot = join(homedir(), ".codexmod", "codex-plusplus");
const codexPlusPlusHome = process.env.CODEX_PLUSPLUS_HOME || defaultCodexPlusPlusHome();
const tweaksDir = join(codexPlusPlusHome, "tweaks");

main();

function main() {
  requirePlatform();
  ensureCodexPlusPlusSource();
  installCodexPlusPlus();
  installComponentsTweak();
  applyBennettDefaults();
  console.log("\nCodex++ + CodexMod Components installed.");
  console.log("Restart Codex++ and open Settings -> Tweaks -> CodexMod Components.");
}

function requirePlatform() {
  if (platform() !== "darwin") {
    throw new Error("This bootstrap currently targets macOS Codex.app installs.");
  }
}

function ensureCodexPlusPlusSource() {
  mkdirSync(dirname(sourceRoot), { recursive: true });
  if (!existsSync(join(sourceRoot, "package.json"))) {
    run("git", ["clone", codexPlusPlusRepo, sourceRoot], { label: "Clone Codex++" });
  }
  run("git", ["fetch", "--all", "--tags"], { cwd: sourceRoot, label: "Update Codex++ source" });
  run("npm", ["install", "--workspaces", "--include-workspace-root", "--ignore-scripts"], {
    cwd: sourceRoot,
    label: "Install Codex++ dependencies",
  });
  run("npm", ["run", "build"], { cwd: sourceRoot, label: "Build Codex++" });
}

function installCodexPlusPlus() {
  run("node", [join(sourceRoot, "bin", "codexplusplus.js"), "install"], {
    cwd: sourceRoot,
    env: { ...process.env, CODEX_PLUSPLUS_HOME: codexPlusPlusHome },
    label: "Patch Codex with Codex++",
  });
}

function installComponentsTweak() {
  const target = join(tweaksDir, "com.codexmod.components");
  mkdirSync(tweaksDir, { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(join(root, "tweaks", "codexmod-components"), target, { recursive: true });
  console.log(`Installed CodexMod Components tweak -> ${target}`);
}

function applyBennettDefaults() {
  const bennettIndex = join(tweaksDir, "co.bennett.ui-improvements", "index.js");
  if (existsSync(bennettIndex)) {
    const source = readFileSync(bennettIndex, "utf8");
    const patched = source
      .replace('"sidebar-action-grid": true,', '"sidebar-action-grid": false,')
      .replace('"sidebar-project-backgrounds": true,', '"sidebar-project-backgrounds": false,');
    if (patched !== source) writeFileSync(bennettIndex, patched);
  }

  const storageDir = join(codexPlusPlusHome, "storage");
  mkdirSync(storageDir, { recursive: true });
  const mainStorageFile = join(storageDir, "co.bennett.ui-improvements.json");
  const current = readJson(mainStorageFile);
  current["feature:sidebar-action-grid"] = false;
  current["feature:sidebar-project-backgrounds"] = false;
  writeFileSync(mainStorageFile, `${JSON.stringify(current, null, 2)}\n`);

  console.log("Disabled Bennett's Sidebar action grid and project backgrounds defaults.");
}

function defaultCodexPlusPlusHome() {
  return join(homedir(), "Library", "Application Support", "codex-plusplus");
}

function readJson(file) {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${options.label || command} failed with exit code ${result.status}`);
  }
}
