# Codex Components Examples

Copy any block into Codex to test that component type.

## Group

```codex-component
{
  "type": "group",
  "version": 1,
  "title": "Release Snapshot",
  "components": [
    {
      "type": "metrics",
      "version": 1,
      "title": "Health",
      "items": [{ "label": "Pass rate", "value": "98%", "tone": "teal" }]
    },
    {
      "type": "actions",
      "version": 1,
      "title": "Next",
      "items": [{ "label": "Inspect risks", "prompt": "Inspect remaining release risks." }]
    }
  ]
}
```

## Metrics

```codex-component
{
  "type": "metrics",
  "version": 1,
  "title": "Metrics",
  "items": [
    { "label": "Active", "value": "12", "delta": "+3", "trend": "up", "tone": "teal" },
    { "label": "Queued", "value": "4", "tone": "blue" }
  ]
}
```

## Insights

```codex-component
{
  "type": "insights",
  "version": 1,
  "title": "Insights",
  "items": [
    { "title": "Clear path", "body": "The component contract is now one direct type per block." },
    { "title": "Lower risk", "body": "HTML is reserved for compact advanced visuals." }
  ]
}
```

## Funnel

```codex-component
{
  "type": "funnel",
  "version": 1,
  "title": "Funnel",
  "steps": [
    { "label": "Started", "value": 100 },
    { "label": "Rendered", "value": 92 },
    { "label": "Clicked", "value": 38 }
  ]
}
```

## Bars

```codex-component
{
  "type": "bars",
  "version": 1,
  "title": "Bars",
  "items": [
    { "label": "Components", "value": 88 },
    { "label": "Links", "value": 74 },
    { "label": "Tables", "value": 55 }
  ]
}
```

## Progress

```codex-component
{
  "type": "progress",
  "version": 1,
  "title": "Progress",
  "items": [
    { "label": "Schema", "percent": 100, "tone": "teal" },
    { "label": "Docs", "percent": 80, "tone": "blue" }
  ]
}
```

## Callouts

```codex-component
{
  "type": "callouts",
  "version": 1,
  "title": "Callouts",
  "items": [
    {
      "rank": 1,
      "value": "High",
      "title": "Keep names direct",
      "body": "Every visual block should use one component type.",
      "recommendation": "Use group only when combining components.",
      "tone": "teal"
    }
  ]
}
```

## Records

```codex-component
{
  "type": "records",
  "version": 1,
  "title": "Records",
  "items": [
    {
      "title": "Worker A",
      "subtitle": "Completed",
      "avatar": "A",
      "fields": [
        { "label": "Task", "value": "Renderer tests" },
        { "label": "Status", "value": "Passed" }
      ],
      "pills": ["test", "ready"],
      "tone": "teal"
    }
  ]
}
```

## Alerts

```codex-component
{
  "type": "alerts",
  "version": 1,
  "title": "Alerts",
  "items": [
    { "title": "Scroll-safe", "body": "HTML frames start with interaction disabled.", "tone": "blue" },
    { "title": "Ready", "body": "Declarative components render directly.", "tone": "teal" }
  ]
}
```

## Comparison

```codex-component
{
  "type": "comparison",
  "version": 1,
  "title": "Comparison",
  "items": [
    { "title": "Declarative", "value": "Default", "body": "Use for normal structured output.", "features": ["Fast", "Stable"], "featured": true, "tone": "teal" },
    { "title": "HTML", "value": "Experimental", "body": "Use only for compact custom visuals.", "features": ["Flexible", "Bounded"], "tone": "amber" }
  ]
}
```

## Timeline

```codex-component
{
  "type": "timeline",
  "version": 1,
  "title": "Timeline",
  "items": [
    { "title": "Create schema", "body": "Define direct component types.", "status": "done", "meta": "Step 1" },
    { "title": "Render blocks", "body": "Mount each component directly.", "status": "done", "meta": "Step 2" }
  ]
}
```

## Quote

```codex-component
{
  "type": "quote",
  "version": 1,
  "title": "Quote",
  "quote": "The simplest contract is the one the renderer can explain by looking at one field.",
  "source": "Codex Components",
  "tone": "purple"
}
```

## Tags

```codex-component
{
  "type": "tags",
  "version": 1,
  "title": "Tags",
  "items": [
    "renderer",
    { "label": "scroll-safe", "tone": "teal" },
    { "label": "experimental-html", "tone": "amber" }
  ]
}
```

## Table

```codex-component
{
  "type": "table",
  "version": 1,
  "title": "Table",
  "columns": [
    { "key": "component", "label": "Component" },
    { "key": "use", "label": "Use" }
  ],
  "rows": [
    { "component": "metrics", "use": "KPI strip" },
    { "component": "choices", "use": "Follow-up prompts" }
  ]
}
```

## Recommendations

```codex-component
{
  "type": "recommendations",
  "version": 1,
  "title": "Recommendations",
  "items": [
    { "title": "Use direct types", "body": "Pick the exact component instead of nesting unnecessary containers." },
    { "title": "Reserve HTML", "body": "Use it only when declarative components cannot express the visual." }
  ]
}
```

## Actions

```codex-component
{
  "type": "actions",
  "version": 1,
  "title": "Actions",
  "items": [
    { "label": "Run checks", "prompt": "Run the Codex Components verification checks." },
    { "label": "Show gallery", "prompt": "Show a gallery of all Codex Components." }
  ]
}
```

## Choices

```codex-component
{
  "type": "choices",
  "version": 1,
  "title": "Choices",
  "options": [
    { "label": "Inspect renderer", "description": "Focus on component rendering behavior.", "prompt": "Inspect the renderer." },
    { "label": "Inspect docs", "description": "Focus on README and skill guidance.", "prompt": "Inspect the documentation." }
  ]
}
```

## HTML

```codex-component
{
  "type": "html",
  "version": 1,
  "title": "HTML",
  "height": 260,
  "code": "<style>.demo{font-family:var(--font-sans);color:var(--color-text-primary);padding:16px;border:1px solid var(--color-border-tertiary);border-radius:10px}.demo strong{display:block;font-size:22px;margin-bottom:4px}</style><section class=\"demo\"><strong>Compact custom visual</strong><p>Use HTML only when declarative components are not enough.</p></section>"
}
```
