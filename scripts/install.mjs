#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), "..");
const codexPlusPlusRepo = "https://github.com/b-nnett/codex-plusplus.git";
const sourceRoot = join(homedir(), ".codex-components", "codex-plusplus");
const codexPlusPlusHome = process.env.CODEX_PLUSPLUS_HOME || defaultCodexPlusPlusHome();
const hadExistingCodexPlusPlusInstall = hasExistingCodexPlusPlusInstall(codexPlusPlusHome);

if (process.argv[1] && scriptPath === resolve(process.argv[1])) {
  main();
}

function main() {
  requirePlatform();
  ensureCodexPlusPlusSource();
  try {
    installCodexPlusPlus();
  } catch (error) {
    if (!hadExistingCodexPlusPlusInstall) throw error;
    console.warn(`Codex++ app patch failed, but an existing install was found. Continuing with tweak refresh.\n${error.message}`);
  }
  installComponentsTweaks();
  installComponentsSkill();
  if (hadExistingCodexPlusPlusInstall) {
    console.log("Existing Codex++ install detected; preserving current tweak settings.");
  } else {
    applyBennettDefaults();
  }
  console.log("\nCodex++ + Codex Components installed.");
  console.log("Restart Codex++ and open Settings -> Tweaks -> Codex Components.");
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

function installComponentsTweaks() {
  for (const home of codexPlusPlusHomes()) {
    installComponentsTweak(home);
  }
}

function installComponentsTweak(home) {
  const homeTweaksDir = join(home, "tweaks");
  const target = join(homeTweaksDir, "com.codexmod.components");
  mkdirSync(homeTweaksDir, { recursive: true });
  removeDuplicateComponentsTweaks(homeTweaksDir, target);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(root, "tweaks", "codex-components"), target, { recursive: true });
  stampTweakCommit(target, installedComponentsCommit());
  console.log(`Installed Codex Components tweak -> ${target}`);
}

function installedComponentsCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return "unknown";
  return result.stdout.trim() || "unknown";
}

export function stampTweakCommit(tweakDir, commit) {
  const index = join(tweakDir, "index.js");
  if (!existsSync(index)) return;
  const source = readFileSync(index, "utf8");
  const stamped = source.replaceAll("__CODEX_COMPONENTS_COMMIT__", commit || "unknown");
  if (stamped !== source) writeFileSync(index, stamped);
}

function removeDuplicateComponentsTweaks(rootTweaksDir, keepTarget) {
  if (!existsSync(rootTweaksDir)) return;
  for (const name of readdirSync(rootTweaksDir)) {
    const candidate = join(rootTweaksDir, name);
    if (candidate === keepTarget) continue;
    const manifest = join(candidate, "manifest.json");
    const index = join(candidate, "index.js");
    const text = [
      existsSync(manifest) ? readFileSync(manifest, "utf8") : "",
      existsSync(index) ? readFileSync(index, "utf8") : "",
    ].join("\n");
    if (/com\.codexmod\.components|Codex Components|codexmod-component|codex-components/i.test(text)) {
      rmSync(candidate, { recursive: true, force: true });
      console.log(`Removed duplicate Codex Components tweak -> ${candidate}`);
    }
  }
}

function installComponentsSkill() {
  const codexHome = process.env.CODEX_HOME || join(homedir(), ".codex");
  const target = join(codexHome, "skills", "codex-components");
  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(join(root, "skills", "codex-components"), target, { recursive: true });
  console.log(`Installed Codex Components skill -> ${target}`);
}

function applyBennettDefaults() {
  const bennettIndex = join(tweaksDir, "co.bennett.ui-improvements", "index.js");
  if (existsSync(bennettIndex)) {
    const source = readFileSync(bennettIndex, "utf8");
    const patched = source
      .replace('"sidebar-action-grid": true,', '"sidebar-action-grid": false,')
      .replace('"sidebar-project-backgrounds": true,', '"sidebar-project-backgrounds": false,')
      .replace(
        "function readFlag(api, id, fallback) {\n  const v = api.storage.get(`feature:${id}`, undefined);",
        "function readFlag(api, id, fallback) {\n  if (id === \"sidebar-action-grid\" || id === \"sidebar-project-backgrounds\") return false;\n  const v = api.storage.get(`feature:${id}`, undefined);",
      );
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

function codexPlusPlusHomes(appSupport = join(homedir(), "Library", "Application Support"), primaryHome = codexPlusPlusHome) {
  const homes = [primaryHome];
  try {
    for (const name of readdirSync(appSupport)) {
      if (!name.startsWith("codex-plusplus")) continue;
      const candidate = join(appSupport, name);
      if (hasExistingCodexPlusPlusInstall(candidate)) homes.push(candidate);
    }
  } catch {
    // Ignore inaccessible app support directories; the explicit home still applies.
  }
  return Array.from(new Set(homes));
}

export function hasExistingCodexPlusPlusInstall(home) {
  return (
    existsSync(join(home, "tweaks")) ||
    existsSync(join(home, "storage")) ||
    existsSync(join(home, "config.json")) ||
    existsSync(join(home, "runtime"))
  );
}

export { codexPlusPlusHomes, removeDuplicateComponentsTweaks };

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
