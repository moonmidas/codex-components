# Changelog

## 0.2.0 - 2026-05-10

- Reset the public component schema around direct component types: `group`, `metrics`, `insights`, `funnel`, `bars`, `progress`, `callouts`, `records`, `alerts`, `comparison`, `timeline`, `quote`, `tags`, `table`, `recommendations`, `actions`, `choices`, and `html`.
- Replaced the old container-first output model with direct component rendering and recursive `group` composition.
- Replaced guided option output with `choices`.
- Replaced custom visual output with the experimental `html` component and a single `code` field.
- Updated the settings prompt contract, onboarding copy, skill, README, and examples to teach the v0.2 schema.

## 0.1.1 - 2026-05-10

- Added a first-run Codex Components onboarding panel in the Codex++ Settings page.
- Added startup and hourly GitHub manifest update checks.
- Added an update button that appears when the published manifest version is newer than the installed tweak version and inserts a safe self-update prompt.

## 0.1.0 - 2026-05-09

- Converted the repo from the old CDP command-palette experiment into a Codex++ bootstrap for Codex Components.
- Added the native Codex++ `Codex Components` tweak with dashboard, intake card, HTML widget, table polish, link preview, video preview, theme-aware colors, and automatic prompt-contract injection controls.
- Added a macOS installer that installs Codex++, keeps the starter tweaks, installs Codex Components, and only applies Bennett sidebar default overrides for first-time Codex++ installs.
