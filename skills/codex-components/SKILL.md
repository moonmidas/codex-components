---
name: codex-components
description: Use when creating Codex Components, structured visual summaries, choices, experimental HTML components, polished tables, video previews, or link-preview-friendly responses for Codex++.
---

# Codex Components

Use Codex Components when an answer is clearer as a compact visual surface: analytics, tool output, comparisons, funnels, tables, recommendations, video previews, or guided choices.

## Default Response Rule

Prefer fenced `codex-component` JSON blocks for structured results. Keep prose short and put the scannable result in the component.

```codex-component
{
  "type": "metrics",
  "version": 1,
  "title": "Short Title",
  "subtitle": "One-line context",
  "items": [
    { "label": "Active", "value": "12", "delta": "+3" }
  ]
}
```

Every component uses the same top-level shape:

- `type`: one supported component type.
- `version`: `1`.
- `title`: short visible title.
- `subtitle`: optional one-line context.
- Component-specific fields such as `items`, `columns`, `rows`, `options`, `components`, or `code`.

Use `group` when several components belong together in one surface:

```codex-component
{
  "type": "group",
  "version": 1,
  "title": "Launch Review",
  "components": [
    { "type": "metrics", "version": 1, "title": "Health", "items": [{ "label": "Pass", "value": "98%" }] },
    { "type": "timeline", "version": 1, "title": "Next", "items": [{ "title": "Ship", "body": "Release the update.", "status": "done" }] }
  ]
}
```

## Component Types

- `group`: container for multiple `components`.
- `metrics`: KPI strip with `items` containing `label`, `value`, optional `delta`, `trend`, `sparkline`, and `tone`.
- `insights`: explanation cards with `title` and `body`.
- `funnel`: ordered conversion steps with `label` and `value`.
- `bars`: horizontal comparison bars with `label` and `value`.
- `progress`: labeled percentages with `percent` or `value`.
- `callouts`: ranked findings with `rank`, `value`, `title`, `body`, `recommendation`, and `tone`.
- `records`: rich record cards with `title`, `subtitle`, `avatar`, `fields`, `pills`, and `tone`.
- `alerts`: success/warning/danger/info notes with `title`, `body`, `tone`, and optional `icon`.
- `comparison`: side-by-side options with `title`, `value` or `price`, `body`, `features`, `badge`, `featured`, and `tone`.
- `timeline`: vertical step trackers with `title`, `body`, `status`, `meta`, and `tone`.
- `quote`: serif quote block with `quote`, `source`, and `tone`.
- `tags`: colored pill collections using `items`.
- `table`: small tables with `columns` and `rows`.
- `recommendations`: prioritized actions with `title` and `body`.
- `actions`: follow-up prompt buttons with `label` and `prompt`.
- `choices`: selectable follow-up options with `label`, optional `description`, and `prompt`.
- `html`: experimental custom HTML/SVG for bounded visuals or advanced mini-tools.

## Output Standard

Prefer declarative components over hand-rolled HTML:

- Use `table` for repeated rows, log output, inventories, and verification grids.
- Use `timeline` for step trackers and workflow status.
- Use `records` for small sets of rich records.
- Use `insights` for short explanation cards.
- Use `progress`, `bars`, or `funnel` for quantitative comparisons.
- Use `choices` when the user needs to pick a follow-up path.
- Use `html` only for compact custom visuals or genuine interaction.

Do not use `html` for long lists, repeated row cards, tables, record grids, or nested panel/card layouts. Those create scroll traps and visual nesting in transcript UIs. If content is tall or row-based, express it with `table`, `timeline`, `records`, `insights`, or `group`.

## HTML Component

`html` is advanced and experimental. Use it only when the visual cannot be expressed with the declarative component types.

```codex-component
{
  "type": "html",
  "version": 1,
  "title": "Compact Diagram",
  "height": 360,
  "code": "<svg role=\"img\" viewBox=\"0 0 400 180\"><title>Flow</title><desc>Simple process flow.</desc></svg>"
}
```

HTML rules:

- Write an HTML/SVG fragment in `code`, not a full document.
- Use inline CSS or a local `<style>` block and host CSS variables.
- Keep backgrounds transparent unless a surface is truly needed.
- Use explicit `height`, usually 360-720px. Avoid 1280px except for renderer stress tests.
- Avoid custom scroll containers, `overflow:auto`, `overflow:scroll`, and giant repeated row markup. The outer Codex Components frame owns scrolling.
- Call `sendPrompt(text)` from buttons when the component should continue the chat.
- Call `openLink(url)` instead of direct `window.open`.
- Load external scripts only from `cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, or `unpkg.com`.
- Do not use `localStorage`, `sessionStorage`, `position: fixed`, full-page white backgrounds, gradients, heavy shadows, or browser-default fonts.
- Include an `sr-only` heading when the visual has no visible heading.
- For SVG visuals, include `role="img"`, `<title>`, and `<desc>`.

## Visual Vocabulary

Use these primitives before custom HTML:

- Callouts for ranked findings and funnel leaks.
- Metrics for compact stat tiles.
- Badges and pills through `records`, `comparison`, and `tags`.
- Alerts for important notes, risks, warnings, and success states.
- Progress for percentage and completion comparisons.
- Records for users, accounts, receipts, contacts, issues, or sessions.
- Comparison for pricing, plan selection, A/B variants, or tradeoffs. Mark the preferred card with `featured: true`.
- Timeline for step trackers, launches, user journeys, or incident states.
- Quote for testimonials, interview excerpts, or sharp findings.
- Tags for topics, categories, labels, or segments.
- Actions and choices for follow-up prompts.

Tone values: `blue`, `teal`, `amber`, `red`, `purple`, `coral`, `pink`, `green`, `gray`. Choose colors semantically: blue neutral, teal good, amber caution, red problem.

## Style

- Use short labels, one-line interpretations, and readable numbers.
- Match the host typography: inherited/system sans for UI, compact headings, mostly 400/500 weights, tabular numerals for metrics, serif italic only for quotes.
- Prefer 12px and 14px text inside dense components; use font weights 400 or 500 unless emphasis truly needs more.
- Keep scripts last so the visual can stream before behavior initializes.
- Useful variables include `--color-background-primary`, `--color-background-secondary`, `--color-background-tertiary`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border-tertiary`, `--font-sans`, `--font-serif`, `--font-mono`, `--border-radius-md`, `--border-radius-lg`, and aliases `--p`, `--s`, `--t`, `--bg2`, `--b`.
- Use semantic color intent in text only: blue neutral, teal good, amber warning, red problem.
- Do not put links inside tables when they should become previews.
- Leave YouTube/video URLs as normal Markdown links outside tables so the renderer can preview them.
- Leave normal URLs outside tables when a link card would help.

## When Not To Use

Use normal prose for quick answers, sensitive data that should not be visually amplified, or code where the code itself is the artifact.

Do not claim live components yet. Current component data is baked into the response. Runtime MCP/tool calls require a separate permissioned bridge.
