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

## Dashboard Sections

- `metric_strip`: top-line KPIs with `label`, `value`, and optional `delta`.
- `insight_grid`: 2-6 cards with `title` and `body`.
- `funnel`: ordered conversion steps with `label` and `value`.
- `bar_chart`: horizontal comparison bars with `label` and `value`.
- `table`: small tables with `columns` and `rows`.
- `recommendations`: prioritized actions with `title` and `body`.
- `action_chips`: follow-up prompts with `label` and `prompt`.

## Style

- Use short labels, one-line interpretations, and readable numbers.
- In `show_widget`, write an HTML/SVG fragment, not a full document.
- In `show_widget`, use inline CSS or a local `<style>` block and host CSS variables.
- In `show_widget`, keep backgrounds transparent unless a surface is truly needed.
- In `show_widget`, call `sendPrompt(text)` from buttons when the widget should continue the chat.
- Use semantic color intent in text only: blue neutral, teal good, amber warning, red problem.
- Do not put links inside tables when they should become previews.
- Leave YouTube/video URLs as normal Markdown links outside tables so the renderer can embed them.
- Leave normal URLs outside tables when a link card would help.

## When Not To Use

Use normal prose for quick answers, sensitive data that should not be visually amplified, or code where the code itself is the artifact.
