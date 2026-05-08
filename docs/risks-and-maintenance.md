# Risks and Maintenance

## Terms and Policy

CodexMod changes the local UI through runtime injection. It does not modify OpenAI binaries, but it is still unofficial. Review OpenAI's current terms before distributing mods, especially mods that automate actions, collect data, or alter security-sensitive UI.

## Security

Mods run in the Codex renderer. A malicious mod can inspect visible content, modify UI, call browser APIs available to the renderer, and mislead the user. Install only trusted mods and review source code before use.

## Update Breakage

The CDP launcher is resilient to many app updates because it avoids ASAR patching, but DOM selectors and UI assumptions can break. Prefer stable browser primitives:

- `textarea`, `input`, `button`, `main`, and ARIA roles.
- Feature detection.
- Graceful fallback with `api.notify`.

## Remote Debugging Port

The debugging port is local-only by default in this launcher. Do not expose it to a network interface. Anyone who can access the port can control the renderer.

## Maintenance Checklist

After each Codex app update:

1. Launch with `npm start`.
2. Confirm `CodexMod loaded ...` appears.
3. Press `Cmd/Ctrl + K`.
4. Run `Focus New Task Composer`.
5. Check the terminal for CDP target errors.
6. Update selectors in mods if a command no longer works.
