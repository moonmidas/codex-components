# CodexMod Managed Mode Design

Date: 2026-05-08

Goal: combine CodexMod's safe launcher/product vision with Codex++-class preload/main-process power, without permanently patching the official Codex app.

## North Star

A user sends Codex one link and says:

> Follow these instructions and install CodexMod.

Codex performs the install with little human input, launches a new CodexMod-powered Codex window, and shows an onboarding experience that makes the value obvious:

- Command palette.
- Rich assistant UI components.
- Extension manager.
- "Ask Codex to create extensions for itself using CodexMod."
- Clear reassurance that vanilla Codex remains untouched.

The feeling should be: not a hack, but the official extension system OpenAI never shipped.

## Product Principle

Codex++ patched the user's app. CodexMod should patch a managed copy.

Official Codex remains the baseline/vanilla experience. CodexMod creates and owns a separate managed app bundle.

## Launch Modes

### Lite Mode

Current CDP injector.

- No app copy.
- No ASAR patching.
- Renderer-only.
- Fast prototyping and low trust barrier.
- Good for UI overlays, prompt helpers, command palette experiments, and debugging.

### Managed Mode

New mode.

- Copy official Codex app to a CodexMod-owned location.
- Patch the copy.
- Re-sign the copy.
- Launch `CodexMod.app`.
- Main/preload/renderer APIs available.

Managed Mode is required for:

- native windows/views
- reliable DevTools
- filesystem APIs
- deep Codex action APIs
- main-process background work
- preload-time React hooks
- richer UI components and Codex-native settings

## Proposed macOS Layout

```text
~/Library/Application Support/CodexMod/
├─ managed/
│  └─ Codex.app                  # copied and patched app bundle
├─ runtime/
│  ├─ main.js
│  ├─ preload.js
│  └─ renderer/
├─ mods/
│  └─ com.codexmod.command-palette/
│     ├─ manifest.json
│     └─ index.js
├─ mod-data/
├─ backup/
├─ logs/
├─ state.json
└─ config.json

~/Applications/CodexMod.app     # thin launcher, optional but ideal
```

Alternative: keep `CodexMod.app` in `/Applications` only if the user explicitly asks. Default should be user-owned paths to reduce permission prompts.

## Managed Install Flow

1. Locate official Codex:
   - `/Applications/Codex.app`
   - `/Applications/Codex (Beta).app`
   - `~/Applications/Codex.app`
   - explicit path

2. Read metadata:
   - bundle id
   - version
   - executable
   - ASAR path
   - Electron framework binary
   - ASAR integrity hash

3. Copy official app to managed path:
   - use `ditto` on macOS to preserve bundle metadata
   - remove quarantine xattr on managed copy
   - never modify official app

4. Patch managed copy:
   - inject loader into `app.asar`
   - update `package.json#main`
   - preserve original main in namespaced metadata
   - stage runtime outside app bundle
   - optionally patch specific Codex integration hook points after audit

5. Update integrity:
   - recompute ASAR header hash
   - update `ElectronAsarIntegrity` for managed copy
   - consider whether fuse flip is still needed for managed copy

6. Re-sign managed copy:
   - create/reuse stable local identity: `CodexMod Local Signing`
   - sign Mach-O files under `app.asar.unpacked`
   - sign bundle

7. Write state:
   - official app path/version/hash
   - managed app path/version/hash
   - CodexMod runtime version
   - signing identity hash/mode
   - original main entry
   - patched hash

8. Seed bundled mods:
   - command palette
   - onboarding
   - component showcase
   - extension builder skill/install helper

9. Launch managed app.

10. First-run onboarding opens automatically.

## Patch Strategy

Minimum patch:

- ASAR loader only.
- No performance patches.
- No minified renderer chunk patches.

Optional patch after deliberate review:

- window services hook for native Codex windows/views, if needed.

Avoid initially:

- startup performance string patches
- broad minified bundle edits
- patches whose failure would prevent launch

Reason: CodexMod's WOW should come from extension platform polish, not from opportunistic internal patches.

## Runtime Boot Sequence

1. Managed Codex launches normally.
2. Electron loads patched ASAR entrypoint.
3. Loader sets:
   - `CODEXMOD_USER_ROOT`
   - `CODEXMOD_RUNTIME`
   - `CODEXMOD_MODE=managed`
4. Loader requires CodexMod `runtime/main.js`.
5. Loader requires original Codex main entry.
6. CodexMod main runtime:
   - registers preload using `session.registerPreloadScript()`
   - falls back to `session.setPreloads()`
   - discovers mods
   - starts main-scoped mods
   - registers IPC
   - starts watcher/hot reload
7. Codex creates renderer windows.
8. CodexMod preload:
   - installs React hook early
   - starts renderer mod host
   - starts command registry bridge
   - starts settings/onboarding injector
9. First-run onboarding opens if not completed.

## Mod Manifest

```json
{
  "id": "com.codexmod.command-palette",
  "name": "Command Palette",
  "version": "0.1.0",
  "description": "A Raycast-style command palette for Codex.",
  "author": {
    "name": "CodexMod"
  },
  "main": "index.js",
  "scope": "both",
  "capabilities": [
    "commands",
    "renderer",
    "main",
    "codex.actions",
    "codex.navigation"
  ],
  "permissions": [
    "settings",
    "filesystem",
    "ipc"
  ]
}
```

## Capability Model

Capabilities describe what a mod needs. Permissions describe what a user should trust.

Suggested capabilities:

- `renderer`
- `preload`
- `main`
- `commands`
- `components`
- `settings`
- `storage`
- `filesystem`
- `network`
- `clipboard`
- `codex.actions`
- `codex.navigation`
- `codex.windows`
- `codex.views`
- `codex.models`
- `codex.skills`
- `codex.automations`
- `codex.plugins`
- `mcp`

Lite Mode supports a subset:

- `renderer`
- `commands`
- `components`
- `settings`
- limited `clipboard`

Managed Mode supports the full set.

## SDK Shape

```ts
export interface CodexModApi {
  manifest: ModManifest;
  process: "main" | "renderer";
  log: Logger;
  storage: StorageApi;
  fs?: FsApi;
  ipc: IpcApi;
  commands?: CommandApi;
  components?: ComponentApi;
  settings?: SettingsApi;
  codex?: CodexApi;
}
```

Command API:

```ts
api.commands.register({
  id: "codex.newChat",
  title: "New Chat",
  category: "Codex",
  keywords: ["chat", "task", "conversation"],
  run: async (ctx) => ctx.codex.newChat()
});
```

Component API:

```ts
api.components.register({
  type: "codexmod.card",
  render(root, props) {
    // DOM or bundled framework render
  }
});
```

Codex API should eventually expose:

- `newChat()`
- `searchChats(query)`
- `listChats()`
- `openChat(id)`
- `setModel(modelId)`
- `setReasoningEffort(level)`
- `toggleAutoReview()`
- `openPlugins()`
- `openAutomations()`
- `openSkills()`
- `attachFile(path?)`
- `startVoiceInput()`
- `openSettings(section?)`

Initial implementation can use DOM/React heuristics behind these methods. The important product decision is that mods call stable CodexMod APIs, not brittle selectors.

## Built-In Mods

### Onboarding

First-run experience. Shows:

- CodexMod is active.
- Official Codex is untouched.
- Press Cmd/Ctrl+K.
- What mods can do.
- Component demos.
- How to ask Codex to build a mod.
- Safe mode and uninstall/vanilla path.

### Command Palette

Raycast-style interface. Sources:

- Codex actions.
- Recent chats.
- Workspaces/projects.
- Files.
- Plugins/connectors.
- Automations.
- Skills.
- Models.
- Thinking settings.
- Mod actions.
- User snippets.

### Component Showcase

Demonstrates:

- cards
- forms
- action panels
- progress views
- approval widgets
- tables
- tabbed panels
- assistant output components

### Extension Builder Skill

Codex skill that teaches Codex how to create CodexMod extensions.

The user prompt:

> Create a CodexMod extension that adds a command to summarize the current chat.

The skill should:

- create manifest
- create mod files
- register commands/components/settings
- validate
- reload
- test

## Agent-First Install

Repo should contain:

- `AGENT_INSTALL.md`
- `scripts/install-managed.ts`
- `scripts/doctor.ts`
- `scripts/launch.ts`
- `scripts/uninstall.ts`
- `scripts/create-mod.ts`
- `skills/codexmod-extension-builder/SKILL.md`

Agent install script should be explicit and automatable:

```text
1. Detect Codex.
2. Explain managed copy.
3. Copy official app.
4. Patch managed app.
5. Sign managed app.
6. Seed mods.
7. Launch.
8. Verify.
```

Human prompts should be rare and only for macOS permission dialogs or destructive cleanup.

## Safety And Recovery

Must-have:

- Safe mode CLI and UI.
- Doctor command.
- Repair/rebuild command.
- Uninstall command.
- Vanilla launch explanation.
- Persistent logs:
  - main
  - preload
  - mod load
  - installer
- Bad mod quarantine:
  - if a mod throws on load repeatedly, mark it failed and disable it.
- Last-known-good config.

## What To Borrow From Codex++

High confidence:

- ASAR helper logic.
- Header hash model.
- Loader pattern.
- Runtime-outside-app pattern.
- Signing flow concepts.
- Safe mode.
- Doctor/repair shape.
- Tweak/mod manifest validation.
- Main/preload/renderer lifecycle.
- File logging.
- Store provenance model.

Medium confidence:

- Settings injector strategy.
- React fiber hook utilities.
- Window services hook.
- MCP sync idea.
- Store implementation details.

Avoid:

- Patching official app.
- Startup performance patches at MVP.
- Codex++ product naming.
- Treating permissions as security if they are only advisory.

## MVP Milestones

### Milestone 1: Audit-Driven Foundation

- Rename concepts from tweak to mod.
- Define manifest schema.
- Define capability/permission schema.
- Create managed user-root paths.
- Create state file schema.

### Milestone 2: Managed Copy Installer

- Locate official Codex.
- Copy to managed app path.
- Patch ASAR loader.
- Stage runtime.
- Update integrity.
- Sign managed copy.
- Launch managed copy.
- Doctor verifies patch/signature/runtime.

### Milestone 3: Runtime Boot

- Main runtime registers preload.
- Preload starts renderer host.
- Mod discovery works.
- Main/renderer/both lifecycle works.
- Hot reload works.
- Safe mode works.

### Milestone 4: WOW First Run

- Onboarding mod.
- Command palette mod.
- Component showcase.
- CodexMod settings inside Codex settings.
- Fallback `CM` button.

### Milestone 5: Agent Extension Builder

- CodexMod skill.
- `create-mod` command.
- validation command.
- reload/test loop.

## Open Questions

1. Should managed `Codex.app` live in `~/Applications/CodexMod.app` or hidden under Application Support with a separate launcher?
2. Should first MVP support only macOS? Recommendation: yes.
3. Should we reuse Codex++ ASAR/signing code directly under MIT attribution or reimplement with the same architecture? Recommendation: reuse concepts and selectively port small low-level modules after tests.
4. Should CodexMod have a public mod store early? Recommendation: no. Start with local mods and bundled examples, then add curated registry later.
5. Should Lite Mode stay? Recommendation: yes, as dev/prototype mode and safe fallback.

