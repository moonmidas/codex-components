---
name: codex-components
description: Use when creating Codex Components dashboards, intake cards, HTML widgets, polished tables, video embeds, or link-preview-friendly responses for Codex++.
---

# Codex Components

Use Codex Components when the answer would be clearer as a compact visual surface: analytics, tool output, comparisons, funnels, tables, recommendations, embedded videos, or guided choices.

## Default Response Rule

Prefer a fenced `codex-component` JSON block when presenting structured results. Keep prose short and put the scannable result in the component.

```codex-component
{
  "type": "dashboard",
  "version": 1,
  "title": "Short Title",
  "subtitle": "One-line context",
  "sections": []
}
```

Use a fenced `show_widget` JSON block for custom HTML/SVG, interactive mini-tools, or one-off visuals that need more freedom than dashboard sections.

```show_widget
{
  "title": "metric_card",
  "widget_code": "<div style=\"color:var(--color-text-primary);font-size:2rem\">42</div>",
  "loading_messages": ["Rendering..."]
}
```

## Show Widget Types

Codex Components can create the same six broad in-chat widget families:

- `diagrams`: flowcharts, architecture maps, state machines, org charts, ER diagrams. Prefer SVG with explicit coordinates.
- `charts`: bar, line, pie, scatter, funnel, heatmap, choropleth, sparklines. Use simple SVG/HTML first; load Chart.js/D3 from an allowed CDN only when needed.
- `mockups`: app screens, dashboards, forms, modals, cards, settings panels, nav bars, design-review prototypes.
- `interactive`: sliders, toggles, calculators, quizzes, configurators, step-through explainers, anything with local JS state.
- `art`: generated SVG patterns, animated compositions, particles, abstract visuals, playful visual metaphors.
- `elicitation`: forms and structured input collectors. Submit buttons should call `sendPrompt(text)` with the user's answers.

If the user asks what Codex Components can show, create a `show_widget` gallery with six cards and buttons that call `sendPrompt()` for live examples.

## Dashboard Sections

- `metric_strip`: top-line KPIs with `label`, `value`, and optional `delta`.
- `insight_grid`: 2-6 cards with `title` and `body`.
- `funnel`: ordered conversion steps with `label` and `value`.
- `bar_chart`: horizontal comparison bars with `label` and `value`.
- `progress_bars`: labeled percentages with colored horizontal progress tracks.
- `numbered_callouts`: ranked findings with `rank`, `value`, `title`, `body`, `recommendation`, and `tone`.
- `record_cards`: contact/account/receipt-like cards with `title`, `subtitle`, `avatar`, `fields`, `pills`, and `tone`.
- `alert_blocks`: success/warning/danger/info notes with `title`, `body`, `tone`, and optional `icon`.
- `comparison_cards`: side-by-side options with `title`, `value`/`price`, `body`, `features`, `badge`, `featured`, and `tone`.
- `timeline`: vertical step trackers with `title`, `body`, `status`, `meta`, and `tone`.
- `pull_quote`: serif italic quote blocks with `quote`, `source`, and `tone`.
- `tag_cloud`: colored pill collections using `items` or `tags`.
- `table`: small tables with `columns` and `rows`.
- `recommendations`: prioritized actions with `title` and `body`.
- `action_chips`: follow-up prompts with `label` and `prompt`.

## Visual Vocabulary

Use these primitives before hand-rolling raw HTML:

- Numbered callouts for ranked findings and funnel leaks.
- Metric cards for compact stat tiles, 2-4 columns.
- Badges and pills for status, categories, versions, segments.
- Alert blocks for important notes, risks, warnings, and success states.
- Progress bars for percentage and completion comparisons.
- Data record cards for users, accounts, receipts, contacts, issues, or sessions.
- Comparison cards for pricing, plan selection, A/B variants, or tradeoffs. Mark the preferred card with `featured: true`.
- Timelines for step trackers, launches, user journeys, or incident states.
- Pull quotes for testimonials, interview excerpts, or sharp findings.
- Tag clouds for topics, categories, labels, or segments.
- Sparklines in metric cards via `sparkline: [1, 3, 2, 5]`.
- `action_chips` for `sendPrompt`-style follow-ups.

Tone values: `blue`, `teal`, `amber`, `red`, `purple`, `coral`, `pink`, `green`, `gray`. Choose colors semantically: blue neutral, teal good, amber caution, red problem.

## Style

- Use short labels, one-line interpretations, and readable numbers.
- Match Claude/Cowork typography: inherited/system sans for UI, 22/18/16px headings, mostly 400/500 weights, tabular numerals for metrics, serif italic only for pull quotes.
- In `show_widget`, write an HTML/SVG fragment, not a full document.
- In `show_widget`, use inline CSS or a local `<style>` block and host CSS variables.
- In `show_widget`, keep backgrounds transparent unless a surface is truly needed.
- In `show_widget`, call `sendPrompt(text)` from buttons when the widget should continue the chat.
- In `show_widget`, call `openLink(url)` instead of direct `window.open`.
- In `show_widget`, load external scripts only from `cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, or `unpkg.com`.
- In `show_widget`, do not use `localStorage`, `sessionStorage`, `position: fixed`, full-page white backgrounds, gradients, heavy shadows, or browser-default fonts.
- For HTML widgets, include an `sr-only` heading when the visual has no visible heading.
- For SVG widgets, include `role="img"`, `<title>`, and `<desc>`.
- Prefer 12px and 14px text inside dense widgets; use font weights 400 or 500 unless emphasis truly needs more.
- Keep scripts last so the visual can stream before behavior initializes.
- Useful variables include `--color-background-primary`, `--color-background-secondary`, `--color-background-tertiary`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border-tertiary`, `--font-sans`, `--font-serif`, `--font-mono`, `--border-radius-md`, `--border-radius-lg`, and aliases `--p`, `--s`, `--t`, `--bg2`, `--b`.
- Use semantic color intent in text only: blue neutral, teal good, amber warning, red problem.
- Do not put links inside tables when they should become previews.
- Leave YouTube/video URLs as normal Markdown links outside tables so the renderer can embed them.
- Leave normal URLs outside tables when a link card would help.

## When Not To Use

Use normal prose for quick answers, sensitive data that should not be visually amplified, or code where the code itself is the artifact.

Do not claim Cowork-style live artifacts yet. Current `show_widget` data is baked into the generated widget. Runtime MCP/tool calls require a separate permissioned bridge.
