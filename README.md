# CodexMod

CodexMod is a user-installable modding framework for the OpenAI Codex desktop app. It launches Codex with Chrome DevTools Protocol enabled, attaches to the renderer, and injects a small runtime that loads JavaScript mods from `~/.codexmod/mods/`.

It does not unpack, patch, repackage, or modify `Codex.app`.

## Is Codex Electron-based?

Yes for the installed macOS app this repository targets. The local app at `/Applications/Codex.app/Contents/` identifies as an Electron app: `Info.plist` includes `NSPrincipalClass = AtomApplication`, `ElectronAsarIntegrity`, and an Electron-style `Resources/app.asar` entry. Public docs and app packaging can change, so CodexMod treats this as a runtime fact to verify per release rather than a permanent API contract.

## Architecture

1. `bin/codexmod.js` launches the official Codex executable with `--remote-debugging-port`.
2. `src/injector.js` polls `http://127.0.0.1:<port>/json`, finds Codex renderer targets, and attaches over CDP.
3. The injector installs `runtime/codexmod-runtime.js` and `runtime/codexmod.css` through `Runtime.evaluate` and `Page.addScriptToEvaluateOnNewDocument`.
4. The runtime creates `window.CodexMod`, binds `Cmd/Ctrl + K`, and loads every `.js` file in `~/.codexmod/mods/`.
5. Mods call the API to register commands, components, styles, DOM observers, and output rendering hooks.
6. The injector keeps polling so new renderer targets receive the runtime after reloads or navigation.

## Install

```bash
npm install
npm run seed
npm start
```

### macOS

The default app path is:

```bash
/Applications/Codex.app/Contents/MacOS/Codex
```

Run:

```bash
npm start
```

Custom path:

```bash
npm start -- --app /Applications/Codex.app/Contents/MacOS/Codex --port 9229
```

### Windows

Install Node.js 20 or newer, then run from this repo:

```powershell
npm install
npm run seed
npm start -- --app "$env:LOCALAPPDATA\Programs\Codex\Codex.exe" --port 9229
```

If Codex is already running with remote debugging:

```bash
npm start -- --no-launch --port 9229
```

## Usage

1. Put mods in `~/.codexmod/mods/`.
2. Launch Codex through CodexMod.
3. Press `Cmd + K` on macOS or `Ctrl + K` on Windows/Linux.
4. Search and run registered commands.

Seed the bundled command palette example:

```bash
npm run seed
```

## Files

- `bin/codexmod.js`: CLI launcher.
- `src/injector.js`: CDP target discovery and injection.
- `src/seed-mods.js`: copies bundled mods into the user mod folder.
- `runtime/codexmod-runtime.js`: browser-side framework.
- `runtime/codexmod.css`: native-feeling base UI.
- `runtime/mods/command-palette.js`: bundled Codex quick actions for the command palette.
- `examples/hello-mod.js`: minimal third-party mod template.

## Safety

CodexMod is intentionally external. It uses the same debugging interface Electron exposes for development and keeps all user mods outside the app bundle. If injection fails, Codex continues running normally.

Use mods you trust. Mods execute inside the Codex renderer and can read or change visible UI state.
