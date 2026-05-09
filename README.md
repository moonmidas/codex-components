# Codex Components

Codex Components is a Codex++ tweak that makes Codex answers easier to read when they contain structured output: dashboards, metric cards, polished tables, link cards, YouTube embeds, guided intake cards, and sandboxed HTML widgets.

It is built on top of [Codex++](https://github.com/b-nnett/codex-plusplus). This repo is a bootstrapper: it installs Codex++, keeps the starter tweaks, installs the Codex Components tweak, and disables Bennett's **Sidebar action grid** and **Sidebar project backgrounds** defaults.

## Install

Paste this into Codex and ask it to inspect and run it:

```text
Install this Codex++ tweak bootstrap for me:
https://github.com/moonmidas/codex-components
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
6. Disables Bennett's Sidebar action grid and Sidebar project backgrounds defaults.

## What It Adds

- `codex-component` dashboards for tool/plugin/skill output.
- Theme-aware Claude Cowork-style metric cards, insight grids, funnels, bar charts, tables, recommendations, and action chips.
- Normal Markdown table polish.
- YouTube embeds and Open Graph-style link cards outside tables.
- A Settings page under Tweaks where each renderer can be enabled or disabled.
- Automatic prompt-contract injection for tool/plugin-like prompts, with an opt-out toggle.
- A `codex-components` skill that teaches Codex how to create component dashboards, intake cards, embeds, and clean tables.

## Tweak Blocks

Codex Components renders fenced JSON blocks:

```codex-component
{
  "type": "dashboard",
  "version": 1,
  "title": "Example Dashboard",
  "sections": [
    {
      "type": "metric_strip",
      "items": [
        { "label": "Visitors", "value": "1.2K", "delta": "last 7 days" }
      ]
    }
  ]
}
```

Supported section types:

- `metric_strip`
- `insight_grid`
- `funnel`
- `bar_chart`
- `table`
- `recommendations`
- `action_chips`

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
