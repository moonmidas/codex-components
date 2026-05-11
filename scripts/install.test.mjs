import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { codexPlusPlusHomes, hasExistingCodexPlusPlusInstall, removeDuplicateComponentsTweaks, stampTweakCommit } from "./install.mjs";

test("detects an existing Codex++ home from user tweak state", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-components-install-"));
  try {
    const home = join(root, "codex-plusplus");
    mkdirSync(join(home, "tweaks"), { recursive: true });

    assert.equal(hasExistingCodexPlusPlusInstall(home), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not treat a missing Codex++ home as an existing install", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-components-install-"));
  try {
    assert.equal(hasExistingCodexPlusPlusInstall(join(root, "missing")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("removes duplicate Codex Components tweak folders before install", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-components-install-"));
  try {
    const tweaks = join(root, "tweaks");
    const keep = join(tweaks, "com.codexmod.components");
    const duplicate = join(tweaks, "codex-components-old");
    const unrelated = join(tweaks, "com.example.other");
    mkdirSync(keep, { recursive: true });
    mkdirSync(duplicate, { recursive: true });
    mkdirSync(unrelated, { recursive: true });
    writeFileSync(join(duplicate, "manifest.json"), JSON.stringify({ name: "Codex Components" }));
    writeFileSync(join(unrelated, "manifest.json"), JSON.stringify({ name: "Other" }));

    removeDuplicateComponentsTweaks(tweaks, keep);

    assert.equal(existsSync(keep), true);
    assert.equal(existsSync(duplicate), false);
    assert.equal(existsSync(unrelated), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discovers copied Codex++ homes for tweak refresh", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-components-install-"));
  try {
    const defaultHome = join(root, "codex-plusplus");
    const copyHome = join(root, "codex-plusplus-copy");
    const unrelated = join(root, "codex-plusplus-source");
    mkdirSync(join(defaultHome, "tweaks"), { recursive: true });
    mkdirSync(join(copyHome, "storage"), { recursive: true });
    mkdirSync(unrelated, { recursive: true });

    assert.deepEqual(
      codexPlusPlusHomes(root, defaultHome).sort(),
      [defaultHome, copyHome].sort(),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stamps installed tweak with the source Git commit", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-components-install-"));
  try {
    writeFileSync(join(root, "index.js"), 'const CURRENT_COMMIT = "__CODEX_COMPONENTS_COMMIT__";\n');

    stampTweakCommit(root, "abc123def456");

    assert.equal(existsSync(join(root, "index.js")), true);
    assert.match(readFileSync(join(root, "index.js"), "utf8"), /abc123def456/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
