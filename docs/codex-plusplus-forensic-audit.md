# Codex++ Forensic Audit

Date: 2026-05-08

Repo audited: `https://github.com/b-nnett/codex-plusplus`
Local clone: `/tmp/codex-plusplus-audit`
Audited commit: `2ed655a` (`2026-05-07`, "Merge 0.1.6 release into main")

## Executive Read

Codex++ is not just a quick DOM tweak. It is a TypeScript monorepo with installer, runtime, SDK, tests, release notes, a tweak store, safe mode, repair/update handling, local signing, and platform-specific install logic.

The core technical decision is invasive but coherent: patch Codex's Electron `app.asar` entrypoint once, then keep the real runtime outside the app bundle in the user's data directory. This gives them main-process and preload access while avoiding repeated source patching of Codex's minified React bundle.

The main product mismatch with CodexMod is philosophical: Codex++ patches the user's Codex app by default. CodexMod should keep the official app untouched and patch only a managed copy.

## Language And Stack

- Root language: TypeScript.
- Package manager: npm workspaces.
- Runtime target: Node 20+, Electron main/preload APIs.
- Packages:
  - `packages/installer`: CLI, patching, signing, repair, doctor, watcher, tweak creation.
  - `packages/runtime`: main-process runtime, preload runtime, settings injector, tweak lifecycle, store, storage, MCP sync.
  - `packages/sdk`: public tweak types and manifest validation.
  - `packages/loader`: tiny CJS loader injected into `app.asar`.
- Source count excluding generated assets/dist: 62 TypeScript files and 2 CJS files.
- Tests: 16 test files across installer/runtime/sdk.

Verdict: TypeScript is the right language for this class of tool. It matches Electron, keeps CLI/runtime/shared SDK types aligned, and makes agent-authored extensions easier to validate.

## Activity And Maintenance

The repo was active through May 7, 2026. The last 20 commits include release work, store entries, settings fixes, local signing hardening, and external contributor PRs. Public trend pages showed hundreds of stars and recent updates, but those are secondary signals. The local git log is the stronger evidence.

Green flag: recent commits are not only feature commits; they include fixes like "preserve signing mode during repair", "settings injector slash menu leakage", and "stable local signing identity". That suggests real-world feedback loops.

Yellow flag: it is still alpha (`0.1.6`) and the security policy says only latest release gets fixes.

## Architecture Decisions They Already Thought Through

### 1. Patch ASAR Entrypoint, Not React Bundle

They change `package.json#main` inside `app.asar` to `codex-plusplus-loader.cjs`, store the original main entry in `__codexpp.originalMain`, and copy a tiny loader into the asar.

Why:
- Codex is Vite/Rollup with no exposed module registry.
- String-patching minified React chunks would break every release.
- A main-process loader runs before Codex creates renderer windows.

CodexMod lesson: if we want deep power, the stable hook is the Electron startup path, not random renderer DOM injection.

### 2. Keep Runtime Outside The App

The patched loader reads user root from `package.json#__codexpp`, sets env vars, requires `<userRoot>/runtime/main.js`, then requires Codex's original main.

Why:
- The app bundle patch stays tiny.
- Runtime and tweaks can update without repeatedly editing `app.asar`.
- User data, logs, tweaks, config, and backups stay in one known location.

CodexMod lesson: managed mode should patch only a bootloader into the managed copy; everything else should live in CodexMod's user root.

### 3. Preload Over React Source Patching

Codex++ uses Electron preload injection, not React bundle modification.

It originally documented `session.setPreloads()`, but the current code prefers Electron 35's `session.registerPreloadScript()` because `setPreloads()` can silently no-op in sandboxed renderers.

Why:
- Additive preload avoids replacing Codex's own preload.
- Preload runs before the page app and can install React hook/fiber tools early.
- More resilient than patching hashed/minified Vite chunks.

CodexMod lesson: managed mode should use `registerPreloadScript()` first, with `setPreloads()` as fallback.

### 4. Stable Local Signing Identity

On macOS, Codex++ creates/reuses a local code signing identity named `Codex++ Local Signing`. It also signs Mach-O files under `app.asar.unpacked` before signing the parent bundle.

Why:
- Mutating Info.plist/framework/asar invalidates the original signature.
- Stable signer preserves macOS privacy permission continuity across repairs.
- Native modules under `app.asar.unpacked` can fail Library Validation if parent and native module team IDs mismatch.

CodexMod lesson: managed copy mode needs stable local signing and native-module signing. Ad-hoc signing should be fallback/dev-only.

### 5. Update Repair Is A First-Class Feature

Codex++ stores install state with original/patched asar hashes, signing mode, watcher kind, Codex version, channel, and source root. `repair` is idempotent and waits for app updates to settle before repatching.

Why:
- Sparkle updates replace the app bundle.
- Repair must avoid touching a half-updated app.
- Runtime updates can refresh without touching user tweaks.

CodexMod lesson: managed mode must be rebuild/repair oriented from day one.

### 6. Safe Mode

Safe mode disables all tweaks through config, touches a reload marker, and preserves per-tweak enabled flags.

Why:
- A bad tweak can break the UI.
- Users need a recovery path that does not require hand-editing files.

CodexMod lesson: safe mode is not optional.

### 7. Manifest-Based Tweaks

Tweaks are folders with `manifest.json` and entry JS. Manifest includes id, name, version, `githubRepo`, scope, main file, permissions, icon, tags, MCP server.

Why:
- Enables UI manager, validation, update checks, permissions display, store integration, and future capability gating.

CodexMod lesson: single-file mods are fine for Lite prototype, but managed CodexMod needs manifests.

### 8. Main/Renderer/Both Scopes

Codex++ supports `renderer`, `main`, and `both` tweak scopes. Main tweaks are `require()`d in main process. Renderer tweaks are fetched over IPC and evaluated in preload context due to sandbox restrictions.

Why:
- Many useful extensions require native access.
- Renderer-only mods can stay safer and simpler.

CodexMod lesson: our capability system should distinguish mode and process.

### 9. Settings Integration

Codex++ injects a section into Codex's real settings sidebar. The current implementation is not modal-based; it recognizes the settings page/sidebar by visible text and layout classes, then appends "Codex++", "Config", "Tweaks", and "Tweak Store".

Why:
- Native-feeling placement.
- Lets each tweak register sections/pages.

CodexMod lesson: we should integrate into Settings for WOW, but keep a fallback `CM` affordance for recovery.

### 10. Tweak Store Is Advisory And Reviewed

Store entries include approved commit SHA, repo, manifest, approval time, approver. Runtime checks GitHub releases but does not auto-install updates blindly.

Why:
- Tweak code is arbitrary local code.
- Automatic silent updates would be dangerous.

CodexMod lesson: agent-first install should still show provenance and permissions, even if Codex performs the work.

## Green Flags

- TypeScript monorepo with coherent package boundaries.
- MIT license.
- Tests exist for installer/runtime/sdk behavior.
- Clear architecture docs explaining decisions and failure modes.
- Uses `@electron/asar` instead of hand-parsing ASAR.
- Preserves original ASAR unpacked-file set during repack.
- Stable local signing identity and explicit Mach-O signing under `app.asar.unpacked`.
- Repair mode handles Sparkle update settling.
- Safe mode exists.
- Doctor command exists.
- Tweak manifests are validated.
- Renderer filesystem access is sandboxed through main IPC.
- IPC channels are namespaced per tweak.
- Logs are mirrored to files for debugging without DevTools.
- Recent maintenance and contributor activity.
- Store has reviewed commit SHAs and advisory updates.
- Current runtime uses `session.registerPreloadScript()` where available.

## Yellow Flags

- Still alpha and moving quickly.
- Settings injection depends on Codex's current settings layout/text/classes.
- Tweak runtime uses `new Function` for renderer tweak source. This is normal for local extensions, but it is still arbitrary code execution.
- Permissions are declared and shown/validated, but not deeply enforced as a security sandbox.
- Main-process tweaks are very powerful.
- Main runtime is large and combines many responsibilities.
- Store install can download/install tweak archives, which increases supply-chain pressure even with reviewed commit metadata.
- Cross-platform code exists, but macOS is clearly the most polished path.
- The installer patches extra Codex internals beyond the loader for window services and startup performance.

## Red Flags

- Default design mutates the official Codex app bundle.
- It flips Electron's embedded ASAR integrity validation fuse.
- It updates `ElectronAsarIntegrity` and re-signs the app.
- It includes string patches against minified Codex code for startup performance. These are brittle and outside the minimal extension-host requirement.
- Targeted anti-tamper is explicitly out of scope.
- A bad main-process tweak can compromise the user's local Codex environment.
- Trust model still depends heavily on users choosing safe tweak sources.

## Quality Assessment

This is not purely "vibecoded." There are signs of hard-won operational fixes:

- Preserving ASAR unpack globs to avoid `MODULE_NOT_FOUND`.
- Signing Mach-O files under `app.asar.unpacked`.
- Stable local signing identity.
- Waiting for Sparkle updates to settle.
- Moving from `setPreloads()` to `registerPreloadScript()`.
- File logging from preload because DevTools may be unavailable.
- Safe mode, doctor, repair, watcher health.

There are also places that feel product-expedient rather than clean-platform:

- Large settings injector with many DOM heuristics.
- Startup performance patches that match minified strings.
- Built-in store/install/self-update complexity in the runtime.

Verdict: strong reference implementation for the hard plumbing. Not the final product architecture for CodexMod.

## What To Reuse

Reuse or adapt with attribution:

- ASAR patching approach.
- Header hash calculation.
- Preserve unpacked-file metadata.
- Loader stub pattern.
- External runtime directory pattern.
- Stable local signing identity.
- Mach-O recursive signing.
- Repair/idempotent install state shape.
- Safe mode semantics.
- Manifest validation concepts.
- Main/renderer/both lifecycle.
- `registerPreloadScript()` first, `setPreloads()` fallback.
- File logs for main/preload.
- Tweak store provenance model.

Do not blindly reuse:

- Patching official app by default.
- Startup performance string patches.
- Codex++ naming/product language.
- Store install UX without our agent-first permission/provenance layer.
- Settings UI wholesale; use its lessons, but design a CodexMod-native WOW onboarding.

## CodexMod Positioning

Codex++ is a tweak system.

CodexMod should be an agent-first extension platform:

- Official app stays untouched.
- Managed copy gets deep powers.
- First launch feels magical.
- Codex can install and extend itself.
- Command palette is first-class.
- UI component system is first-class.
- Mods declare capabilities and permissions.
- Safe mode and doctor are visible, not hidden.

