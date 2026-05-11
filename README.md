# Codex Components

Codex Components is a Codex++ tweak that makes Codex answers easier to read when they contain structured output: metrics, records, timelines, tables, recommendations, choices, media previews, and advanced bounded HTML components.

It is built on top of [Codex++](https://github.com/b-nnett/codex-plusplus). This repo is a bootstrapper: it installs Codex++, keeps the starter tweaks, installs the Codex Components tweak, and only changes Bennett's **Sidebar action grid** and **Sidebar project backgrounds** defaults on first-time Codex++ installs.

## Install

Paste this into Codex:

```text
Install Codex Components for me from GitHub:
https://github.com/moonmidas/codex-components

Please inspect the README and installer first, then run the macOS installer. It should install Codex++, install the Codex Components tweak, install the codex-components skill, preserve any existing Codex++ settings, and tell me when to restart Codex++.
```

Or run directly on macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/moonmidas/codex-components/main/install.sh | bash
```

The installer:

1. Clones and builds `b-nnett/codex-plusplus`.
2. Patches the local Codex app so it runs as Codex++.
3. Installs the Codex++ starter tweaks.
4. Installs the Codex Components tweak.
5. Installs the Codex Components skill so agents can emit components without manual prompting.
6. On first-time Codex++ installs only, disables Bennett's Sidebar action grid and Sidebar project backgrounds defaults. Existing Codex++ tweak settings are preserved.

## What It Adds

- A single `codex-component` fenced JSON contract for structured visual output.
- Theme-aware components for metrics, insights, funnels, bars, progress, callouts, records, alerts, comparisons, timelines, quotes, tags, tables, recommendations, actions, choices, and experimental HTML.
- Normal Markdown table polish.
- Native YouTube preview cards and Open Graph-style link cards outside tables.
- A Settings page under Tweaks with onboarding, update checks, and a copyable prompt contract.
- Startup and hourly update checks against the latest GitHub commit, with an update button when a newer commit exists.
- A `codex-components` skill that teaches Codex how to create components, video previews, and clean tables.

## Component Blocks

Codex Components renders fenced JSON blocks with language `codex-component`.

```codex-component
{
  "type": "metrics",
  "version": 1,
  "title": "Example Metrics",
  "subtitle": "One compact component",
  "items": [
    { "label": "Visitors", "value": "1.2K", "delta": "last 7 days", "tone": "blue" }
  ]
}
```

Every block uses:

| Field | Required | Notes |
| --- | --- | --- |
| `type` | Yes | One supported component type. |
| `version` | Yes | Use `1`. |
| `title` | Usually | Short visible heading. |
| `subtitle` | No | One-line context. |
| Type fields | Yes | Examples: `items`, `components`, `columns`, `rows`, `options`, or `code`. |

## Component Catalogue

| Type | Best For | Key Fields |
| --- | --- | --- |
| `group` | Combining several components in one surface | `components[]` |
| `metrics` | KPI strips and compact stat tiles | `items[]`: `label`, `value`, `delta`, `trend`, `sparkline`, `tone` |
| `insights` | Short explanation cards | `items[]`: `title`, `body` |
| `funnel` | Ordered conversion or process steps | `steps[]` or `items[]`: `label`, `value`, `tone` |
| `bars` | Horizontal comparisons | `items[]`: `label`, `value`, `tone` |
| `progress` | Percent completion and status | `items[]`: `label`, `percent` or `value`, `body`, `tone` |
| `callouts` | Ranked findings and recommendations | `items[]`: `rank`, `value`, `title`, `body`, `recommendation`, `tone` |
| `records` | People, accounts, issues, receipts | `items[]`: `title`, `subtitle`, `avatar`, `fields[]`, `pills[]`, `tone` |
| `alerts` | Notes, warnings, success states | `items[]`: `title`, `body`, `icon`, `tone` |
| `comparison` | Options, plans, variants | `items[]`: `title`, `badge`, `price` or `value`, `body`, `features[]`, `featured`, `tone` |
| `timeline` | Steps, status, history | `items[]`: `title`, `body`, `status`, `meta`, `tone` |
| `quote` | Quotes or testimonials | `quote`, `source`, `tone` |
| `tags` | Topics, labels, categories | `items[]`: strings or `{ "label": "...", "tone": "..." }` |
| `table` | Repeated rows and data grids | `columns[]`, `rows[]` |
| `recommendations` | Prioritized actions | `items[]`: `title`, `body` |
| `actions` | Follow-up prompt buttons | `items[]`: `label`, `prompt` |
| `choices` | Selectable follow-up options | `options[]`: `label`, `description`, `prompt` |
| `html` | Experimental custom visuals or mini-tools | `code`, optional `height`, optional `max_height` |

## Composition

Use `group` when several components should stay together.

```codex-component
{
  "type": "group",
  "version": 1,
  "title": "Launch Review",
  "components": [
    {
      "type": "metrics",
      "version": 1,
      "title": "Health",
      "items": [{ "label": "Pass rate", "value": "98%", "tone": "teal" }]
    },
    {
      "type": "recommendations",
      "version": 1,
      "title": "Next",
      "items": [{ "title": "Ship the update", "body": "All blocking checks are green." }]
    }
  ]
}
```

## HTML Component

`html` is advanced and experimental. Use it only when the visual cannot be expressed with declarative components.

```codex-component
{
  "type": "html",
  "version": 1,
  "title": "Compact Diagram",
  "height": 360,
  "code": "<svg role=\"img\" viewBox=\"0 0 400 180\"><title>Flow</title><desc>Simple process flow.</desc></svg>"
}
```

Rules:

- Write an HTML/SVG fragment in `code`, not a full document.
- Use local CSS only unless a chart library is genuinely needed.
- Keep backgrounds transparent unless a surface is truly needed.
- Avoid long repeated rows, nested panels, custom scroll containers, and `position: fixed`.
- Use `table`, `timeline`, `records`, `insights`, or `group` for tall or row-based content.

## Examples

See [docs/examples/all-components.md](docs/examples/all-components.md) for one copyable example of every component type.

## Updates

Codex Components checks for updates when the Codex++ tweak starts and then once every hour while Codex++ stays open. The live signal is the latest commit on the published branch:

```text
https://api.github.com/repos/moonmidas/codex-components/commits/main
```

If GitHub reports a commit different from the installed tweak commit, the Codex Components Settings page shows an **Update Codex Components** button. The button inserts a prompt that tells Codex to inspect this repo, run the installer, preserve existing Codex++ settings, and ask you to restart Codex++ when the update is complete.

## Development

```bash
npm run check
```

The tweak source lives in:

```text
tweaks/codex-components/
```

## Safety

Do not commit local Codex app bundles, runtime folders, logs, generated screenshots, tokens, or installer backups. The installer modifies a local Codex app copy through Codex++ and re-signs it on macOS.

### Existing Codex++ Installs

If Codex++ is already installed, this bootstrap uses the existing Codex++ home by default:

```text
~/Library/Application Support/codex-plusplus
```

It updates/builds a local Codex++ source checkout, runs `codexplusplus install` again, installs or replaces only the `com.codexmod.components` tweak folder, and installs or replaces the `codex-components` skill.

It preserves existing Codex++ tweak settings, including Bennett UI settings. The Codex app may still be re-patched and re-signed by Codex++ during install/repair, which is normal for Codex++ on macOS.

To test against a separate Codex++ home, set `CODEX_PLUSPLUS_HOME` before running the installer.
