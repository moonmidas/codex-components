import { copyFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { bundledModsDir, ensureUserDirs, listJsFiles, userModsDir } from "./paths.js";

export async function seedBundledMods() {
  await ensureUserDirs();
  const files = await listJsFiles(bundledModsDir);
  for (const file of files) {
    await copyFile(file, join(userModsDir, basename(file)));
  }
  return files.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedBundledMods()
    .then((count) => console.log(`[codexmod] Seeded ${count} bundled mod(s) into ${userModsDir}`))
    .catch((error) => {
      console.error(`[codexmod] ${error.message}`);
      process.exit(1);
    });
}
