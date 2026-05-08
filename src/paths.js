import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const runtimeDir = join(projectRoot, "runtime");
export const bundledModsDir = join(runtimeDir, "mods");
export const userRoot = join(homedir(), ".codexmod");
export const userModsDir = join(userRoot, "mods");

export async function ensureUserDirs() {
  await mkdir(userModsDir, { recursive: true });
}

export async function readText(file) {
  return readFile(file, "utf8");
}

export async function writeText(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, value, "utf8");
}

export async function listJsFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => join(dir, entry.name))
    .sort();
}
