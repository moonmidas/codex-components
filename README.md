# Codex Components

Codex Components is a Codex++ tweak that makes Codex answers easier to read when they contain structured output: dashboards, metric cards, polished tables, link cards, YouTube previews, guided intake cards, and sandboxed HTML widgets.

It is built on top of [Codex++](https://github.com/b-nnett/codex-plusplus). This repo is a bootstrapper: it installs Codex++, keeps the starter tweaks, installs the Codex Components tweak, and disables Bennett's **Sidebar action grid** and **Sidebar project backgrounds** defaults.

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
6. Disables Bennett's Sidebar action grid and Sidebar project backgrounds defaults.

## What It Adds

- `codex-component` dashboards for tool/plugin/skill output.
- Theme-aware Claude Cowork-style metric cards, insight grids, funnels, bar charts, tables, recommendations, and action chips.
- Normal Markdown table polish.
- Native YouTube preview cards and Open Graph-style link cards outside tables.
- A Settings page under Tweaks where each renderer can be enabled or disabled.
- Automatic prompt-contract injection for tool/plugin-like prompts, with an opt-out toggle.
- A `codex-components` skill that teaches Codex how to create component dashboards, intake cards, video previews, and clean tables.

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

## Component Catalogue

Top-level component blocks:

| Component | Fence / Type | Subcomponents |
| --- | --- | --- |
| Dashboard | `codex-component`, `type: "dashboard"` | `sections[]` using the dashboard section types below |
| Intake card | `codex-component`, `type: "intake"` | `options[]` with `label`/`title`, optional `description`, and `prompt` |
| HTML widget | `codex-component`, `type: "html_widget"` or `codex-widget` | `html` or `content`, optional `height` and `max_height` |
| Show widget | `show_widget`, `show-widget`, or `type: "show_widget"` | `widget_code`, optional `html`/`content`, `height`, `max_height`, and `loading_messages` |
| YouTube preview | Normal YouTube Markdown link outside tables | Thumbnail, title overlay, domain, and play affordance |
| Link preview | Normal Markdown URL outside tables | Compact title/domain preview card |
| Table polish | Normal Markdown table | Restyled table wrapper, header, and rows; disabled by default |

Dashboard section types:

| Section | Best For | Items / Subcomponents |
| --- | --- | --- |
| `metric_strip` | KPI rows | `items`/`metrics`: `label`, `value`, `delta`, `trend`, `sparkline`, `tone` |
| `insight_grid` | Short explanation cards | `items`/`insights`: `title`, `body` |
| `funnel` | Ordered conversion steps | `steps`/`items`: `label`, `value`, `tone` |
| `bar_chart` | Horizontal comparisons | `items`/`bars`: `label`, `value`, `tone` |
| `progress_bars` | Percent completion | `items`: `label`, `percent`/`value`, optional `body`, `tone` |
| `numbered_callouts` | Ranked findings | `items`: `rank`, `value`, `title`, `body`, `recommendation`, `tone` |
| `record_cards` | People, accounts, issues, receipts | `items`/`records`: `title`, `subtitle`, `avatar`, `fields[]`, `pills[]`, `tone` |
| `alert_blocks` | Notes, warnings, success states | `items`/`alerts`: `title`, `body`, `icon`, `tone`/`status` |
| `comparison_cards` | Options, plans, variants | `items`/`cards`: `title`, `badge`, `price`/`value`, `body`, `features[]`, `featured`, `tone` |
| `timeline` | Steps, status, history | `items`/`steps`: `title`, `body`, `status`, `meta`, `tone` |
| `pull_quote` | Quotes or testimonials | `quote`, `source`, `tone` |
| `tag_cloud` | Tags, topics, categories | `items`/`tags`: strings or `{ label, tone }` |
| `table` | Repeated rows and data grids | `columns[]`, `rows[]` |
| `recommendations` | Prioritized actions | `items`: `title`, optional `body` |
| `action_chips` | Follow-up prompts | `items`/`actions`: `label`, `prompt` |

## Component Standard

Prefer `codex-component` dashboard sections for transcript output:

- Use `table` for repeated rows, logs, inventories, and verification grids.
- Use `timeline` for step trackers and workflow status.
- Use `record_cards` for small sets of rich records.
- Use `insight_grid` for short explanation cards.
- Use `intake` for choice prompts.

Use `show_widget` only for compact custom visuals or real interaction that dashboard sections cannot express. Avoid long repeated row markup, nested card layouts, custom scroll containers, and large 1280px widgets except for renderer stress tests. The outer Codex Components frame owns widget scrolling.

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
