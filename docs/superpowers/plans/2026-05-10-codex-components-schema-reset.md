# Codex Components Schema Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old dashboard/intake/widget schema with a cleaner component-only schema where every renderable block is a component, `group` is just one component that contains other components, `choices` replaces intake, and `html` is an experimental advanced component.

**Architecture:** Keep the existing single Codex++ tweak for this reset, but separate the renderer conceptually into schema recognition, component dispatch, leaf component renderers, group composition, and experimental HTML handling. This is a breaking v0.2 schema reset: do not keep old public names or language fences as aliases.

**Tech Stack:** Codex++ renderer tweak in plain JavaScript, JSDOM tests with `node:test`, Markdown docs, Codex skill instructions.

---

## Scope Decisions

- Work on `main`; do not create branches or worktrees.
- This plan intentionally removes support for old public schema names:
  - Remove `dashboard`, `sections`, `intake`, `html_widget`, `show_widget`, `codex-widget`, `show-widget`, `widget_code`.
  - Use only fenced `codex-component` JSON blocks.
- New top-level component types:
  - `group`
  - `metrics`
  - `insights`
  - `funnel`
  - `bars`
  - `progress`
  - `callouts`
  - `records`
  - `alerts`
  - `comparison`
  - `timeline`
  - `quote`
  - `tags`
  - `table`
  - `recommendations`
  - `actions`
  - `choices`
  - `html`
- `group` is not special in product language; it is just the component that renders a `components[]` array.
- `html` is experimental and should be less prominent than safe declarative components.
- Keep link preview, YouTube preview, table polish, settings, onboarding, and update checks unless a test proves the schema reset requires a small text/settings rename.

## File Structure

- Modify `tweaks/codex-components/index.js`
  - Schema recognition: `isComponentLanguage`, `looksLikeComponentJson`, `normalizeDescriptor`, `isLocallyOwnedBlock`.
  - Renderer dispatch: replace the current top-level `dashboard/intake/html_widget/show_widget` branch with a component renderer map.
  - Component rendering: reuse existing leaf renderer functions, renaming public component types while preserving internal helper structure where practical.
  - Settings/onboarding/prompt contract: remove dashboard/intake/widget wording and teach `group`, `choices`, and experimental `html`.
- Modify `tweaks/codex-components/index.test.cjs`
  - Replace old schema tests with new schema tests.
  - Add explicit rejection tests for old schema names and fences.
  - Keep update, link preview, video preview, table polish, and installer-related tests intact.
- Modify `skills/codex-components/SKILL.md`
  - Teach only the new component schema.
  - Tell Codex to use `group` only when grouping multiple components.
  - Tell Codex to use `html` only for experimental advanced custom HTML/SVG/interaction.
- Modify `README.md`
  - Replace dashboard/intake/widget docs with the new component catalogue.
  - Include examples for a single component, a `group`, `choices`, and experimental `html`.
- Modify `CHANGELOG.md`, `package.json`, `package-lock.json`, `tweaks/codex-components/manifest.json`
  - Bump to `0.2.0` because this is a breaking schema reset.

---

### Task 1: Lock the New Schema Contract

**Files:**
- Modify: `tweaks/codex-components/index.test.cjs`
- Modify later: `tweaks/codex-components/index.js`

- [ ] **Step 1: Write failing tests for allowed component types**

Add a test near the existing component-rendering tests:

```js
test("recognizes only the v0.2 component schema", () => {
  setupDom();
  const allowed = {
    group: { type: "group", version: 1, components: [] },
    metrics: { type: "metrics", version: 1 },
    insights: { type: "insights", version: 1 },
    funnel: { type: "funnel", version: 1 },
    bars: { type: "bars", version: 1 },
    progress: { type: "progress", version: 1 },
    callouts: { type: "callouts", version: 1 },
    records: { type: "records", version: 1 },
    alerts: { type: "alerts", version: 1 },
    comparison: { type: "comparison", version: 1 },
    timeline: { type: "timeline", version: 1 },
    quote: { type: "quote", version: 1 },
    tags: { type: "tags", version: 1 },
    table: { type: "table", version: 1 },
    recommendations: { type: "recommendations", version: 1 },
    actions: { type: "actions", version: 1 },
    choices: { type: "choices", version: 1 },
    html: { type: "html", version: 1, code: "<div>Advanced</div>" },
  };

  for (const [type, descriptor] of Object.entries(allowed)) {
    const result = normalizeDescriptor(JSON.stringify(descriptor), "codex-component");
    assert.equal(result.ok, true, `${type} should be accepted`);
    assert.equal(result.descriptor.type, type);
  }
});
```

- [ ] **Step 2: Write failing tests that reject old names**

Add:

```js
test("rejects pre-reset component type names instead of aliasing them", () => {
  setupDom();
  const oldTypes = ["dashboard", "intake", "html_widget", "show_widget"];

  for (const type of oldTypes) {
    const result = normalizeDescriptor(JSON.stringify({ type, version: 1 }), "codex-component");
    assert.equal(result.ok, false, `${type} should be rejected`);
    assert.match(result.error, /Unknown component type/);
  }
});
```

- [ ] **Step 3: Write failing tests that reject old fences**

Add:

```js
test("only codex-component fences are component fences", () => {
  assert.equal(isComponentLanguage("codex-component"), true);
  assert.equal(isComponentLanguage("codex-widget"), false);
  assert.equal(isComponentLanguage("show_widget"), false);
  assert.equal(isComponentLanguage("show-widget"), false);
});
```

If `isComponentLanguage` is not exported under `module.exports.__test`, export it only for tests.

- [ ] **Step 4: Run the focused test and verify it fails**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because old schema is still accepted and old fences still count as component fences.

- [ ] **Step 5: Implement the schema constants**

In `tweaks/codex-components/index.js`, add near the top:

```js
const COMPONENT_TYPES = Object.freeze([
  "group",
  "metrics",
  "insights",
  "funnel",
  "bars",
  "progress",
  "callouts",
  "records",
  "alerts",
  "comparison",
  "timeline",
  "quote",
  "tags",
  "table",
  "recommendations",
  "actions",
  "choices",
  "html",
]);
const COMPONENT_TYPE_SET = new Set(COMPONENT_TYPES);
```

Update:

```js
function isComponentLanguage(language) {
  return String(language || "").trim() === "codex-component";
}
```

Update `looksLikeComponentJson(raw)` to return true only when `descriptor.type` is in `COMPONENT_TYPE_SET`.

Update `normalizeDescriptor(raw, language)`:

```js
if (!COMPONENT_TYPE_SET.has(descriptor.type)) {
  return { ok: false, error: `Unknown component type: ${descriptor.type}` };
}
```

Remove the current auto-default behavior that turns `show_widget`, `codex-widget`, or `widget_code` into old widget types.

- [ ] **Step 6: Run the focused test and verify it passes**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: the new schema recognition tests pass; older renderer tests may still fail until later tasks are updated.

- [ ] **Step 7: Commit**

```bash
git add tweaks/codex-components/index.js tweaks/codex-components/index.test.cjs
git commit -m "Reset component schema names"
```

---

### Task 2: Replace Top-Level Dispatch With Component Dispatch

**Files:**
- Modify: `tweaks/codex-components/index.js`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing tests for direct leaf components**

Replace the old "renders every dashboard section type" test with one that renders every safe component type directly:

```js
test("renders every declarative component type directly", () => {
  const cases = [
    { descriptor: { type: "metrics", version: 1, items: [{ label: "Revenue", value: "$42K" }] }, expected: ".codexmod-metric" },
    { descriptor: { type: "insights", version: 1, items: [{ title: "Signal", body: "Clear." }] }, expected: ".codexmod-insight" },
    { descriptor: { type: "funnel", version: 1, items: [{ label: "Visit", value: 100 }] }, expected: ".codexmod-bar-row" },
    { descriptor: { type: "bars", version: 1, items: [{ label: "A", value: 8 }] }, expected: ".codexmod-bar-row" },
    { descriptor: { type: "progress", version: 1, items: [{ label: "Done", percent: 72 }] }, expected: ".codexmod-progress" },
    { descriptor: { type: "callouts", version: 1, items: [{ title: "Risk", body: "Needs review." }] }, expected: ".codexmod-numbered" },
    { descriptor: { type: "records", version: 1, items: [{ title: "Ada", fields: [{ label: "Status", value: "Active" }] }] }, expected: ".codexmod-record" },
    { descriptor: { type: "alerts", version: 1, items: [{ title: "Warning", body: "Watch this.", tone: "amber" }] }, expected: ".codexmod-alert" },
    { descriptor: { type: "comparison", version: 1, items: [{ title: "Pro", value: "$20" }] }, expected: ".codexmod-comparison" },
    { descriptor: { type: "timeline", version: 1, items: [{ title: "Launch", body: "Ship it." }] }, expected: ".codexmod-timeline-item" },
    { descriptor: { type: "quote", version: 1, quote: "This is the line.", source: "Tester" }, expected: ".codexmod-pullquote" },
    { descriptor: { type: "tags", version: 1, items: ["analytics"] }, expected: ".codexmod-tag-cloud .codexmod-pill" },
    { descriptor: { type: "table", version: 1, columns: [{ key: "name", label: "Name" }], rows: [{ name: "Alpha" }] }, expected: ".codexmod-table tbody tr" },
    { descriptor: { type: "recommendations", version: 1, items: [{ title: "Ship" }] }, expected: ".codexmod-recommendations li" },
    { descriptor: { type: "actions", version: 1, items: [{ label: "Continue", prompt: "Continue." }] }, expected: ".codexmod-actions button" },
  ];

  for (const { descriptor, expected } of cases) {
    setupDom();
    const state = testState();
    mountJson(state, descriptor);
    assert.ok(document.querySelector(expected), `${descriptor.type} did not render ${expected}`);
  }
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because the renderer only dispatches `dashboard`, `intake`, `html_widget`, and `show_widget`.

- [ ] **Step 3: Implement `renderComponent` dispatch**

In `mountBlock`, replace the current `if (descriptor.type === "dashboard"...)` branch with:

```js
if (canRenderComponent(state, descriptor)) renderComponent(mount, descriptor, block.raw, state);
else {
  sourceNode.style.display = "";
  mount.remove();
}
```

Add:

```js
function canRenderComponent(state, descriptor) {
  return COMPONENT_TYPE_SET.has(descriptor.type);
}

function renderComponent(target, descriptor, raw, state, options = {}) {
  if (descriptor.type === "group") return renderGroup(target, descriptor, raw, state, options);
  if (descriptor.type === "choices") return renderChoices(target, descriptor, raw, state, options);
  if (descriptor.type === "html") return renderHtml(target, descriptor, raw, state, options);
  return renderLeafComponent(target, descriptor, raw, state, options);
}
```

Keep the existing leaf helper functions but route new names:

```js
function renderLeafComponent(target, descriptor, raw, state, options = {}) {
  const body = options.body || renderShell(target, descriptor, raw, state, `codexmod-${descriptor.type}`);
  const section = descriptor;
  if (descriptor.type === "metrics") renderMetricStrip(body, section);
  else if (descriptor.type === "insights") renderInsightGrid(body, section);
  else if (descriptor.type === "funnel" || descriptor.type === "bars") renderBars(body, section);
  else if (descriptor.type === "progress") renderProgressBars(body, section);
  else if (descriptor.type === "callouts") renderNumberedCallouts(body, section);
  else if (descriptor.type === "records") renderRecordCards(body, section);
  else if (descriptor.type === "alerts") renderAlertBlocks(body, section);
  else if (descriptor.type === "comparison") renderComparisonCards(body, section);
  else if (descriptor.type === "timeline") renderTimeline(body, section);
  else if (descriptor.type === "quote") renderPullQuote(body, section);
  else if (descriptor.type === "tags") renderTagCloud(body, section);
  else if (descriptor.type === "table") renderTable(body, section);
  else if (descriptor.type === "recommendations") renderRecommendations(body, section);
  else if (descriptor.type === "actions") renderActions(body, section);
}
```

- [ ] **Step 4: Export `renderComponent` for tests**

Under `module.exports.__test`, replace old renderer exports as needed:

```js
renderComponent,
renderGroup,
renderChoices,
renderHtml,
```

Keep old helper exports only if existing tests still need internal helpers during the migration.

- [ ] **Step 5: Run the focused tests and verify direct components pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: direct component rendering tests pass; old tests still fail until rewritten.

- [ ] **Step 6: Commit**

```bash
git add tweaks/codex-components/index.js tweaks/codex-components/index.test.cjs
git commit -m "Render components directly"
```

---

### Task 3: Implement `group` Composition

**Files:**
- Modify: `tweaks/codex-components/index.js`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing tests for `group`**

Add:

```js
test("renders group as a component that contains other components", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "group",
    version: 1,
    title: "Worker Activity",
    subtitle: "Recent activity across Codex.",
    components: [
      { type: "metrics", version: 1, title: "Overview", items: [{ label: "Active", value: "3" }] },
      { type: "timeline", version: 1, title: "Recent", items: [{ title: "Worker finished", body: "Tests passed." }] },
      { type: "choices", version: 1, title: "Next step", options: [{ label: "Inspect", prompt: "Inspect workers." }] },
    ],
  });

  assert.ok(document.querySelector(".codexmod-group"));
  assert.ok(document.querySelector(".codexmod-metric"));
  assert.ok(document.querySelector(".codexmod-timeline-item"));
  assert.ok(document.querySelector(".codexmod-choices-option"));
});
```

- [ ] **Step 2: Write failing test for invalid nested old names**

Add:

```js
test("group does not render old nested component names", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "group",
    version: 1,
    title: "Invalid",
    components: [{ type: "dashboard", version: 1, sections: [] }],
  });

  assert.match(document.querySelector(".codex-components").textContent, /Unknown component type: dashboard/);
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because `group` does not render nested components yet.

- [ ] **Step 4: Implement `renderGroup`**

Add:

```js
function renderGroup(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-group");
  const components = Array.isArray(descriptor.components) ? descriptor.components : [];
  for (const child of components) {
    const normalized = normalizeDescriptor(JSON.stringify(child), "codex-component");
    if (!normalized.ok) {
      renderError(body, normalized.error, JSON.stringify(child, null, 2));
      continue;
    }
    const childMount = el("div", { className: "codexmod-group-child" });
    body.append(childMount);
    renderComponent(childMount, normalized.descriptor, JSON.stringify(child), state);
  }
}
```

Keep nested components visually unboxed where possible. Avoid card-inside-card styling by making `.codexmod-group-child` spacing-only.

- [ ] **Step 5: Add CSS for group spacing**

In `installStyles`, add:

```css
.codexmod-group .codexmod-component-body {
  display: grid;
  gap: 14px;
}
.codexmod-group-child > .codexmod-component {
  border: 0;
  background: transparent;
  padding: 0;
}
```

Adjust selectors if existing component shell CSS requires a more precise override.

- [ ] **Step 6: Run tests and verify pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: group tests pass.

- [ ] **Step 7: Commit**

```bash
git add tweaks/codex-components/index.js tweaks/codex-components/index.test.cjs
git commit -m "Add group component composition"
```

---

### Task 4: Replace `intake` With `choices`

**Files:**
- Modify: `tweaks/codex-components/index.js`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing tests for `choices`**

Replace old intake tests with:

```js
test("renders choices without repeating title text", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "choices",
    version: 1,
    title: "Choose a Test Path",
    subtitle: "Pick one option.",
    options: [{ label: "Inspect", description: "Review layout.", prompt: "Inspect layout." }],
  });

  assert.equal(document.querySelectorAll(".codexmod-choices-question").length, 0);
  assert.equal(document.querySelector(".codexmod-component-title").textContent, "Choose a Test Path");
  assert.ok(document.querySelector(".codexmod-choices-option"));
});
```

Add prompt insertion test:

```js
test("choices insert the selected prompt into the composer", () => {
  setupDom("<main></main><textarea></textarea>");
  const state = testState();

  mountJson(state, {
    type: "choices",
    version: 1,
    title: "Choose",
    options: [{ label: "Continue", prompt: "Continue with tests." }],
  });

  document.querySelector(".codexmod-choices-option").click();
  assert.equal(document.querySelector("textarea").value, "Continue with tests.");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL until renderer and CSS are renamed.

- [ ] **Step 3: Rename renderer and CSS classes**

Rename:

```js
function renderIntake(...)
```

to:

```js
function renderChoices(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-choices");
  const question = String(descriptor.question || "").trim();
  const title = String(descriptor.title || "").trim();
  if (question && question !== title) {
    body.append(el("h2", { className: "codexmod-choices-question" }, [question]));
  }
  body.append(el("div", { className: "codexmod-choices-options" }, (descriptor.options || []).map((option, index) =>
    el("button", { type: "button", className: "codexmod-choices-option", onclick: () => insertPrompt(option.prompt || option.label || "") }, [
      el("span", {}, [String(index + 1)]),
      el("div", { className: "codexmod-choices-option-copy" }, [
        el("strong", {}, [option.label || option.title || `Option ${index + 1}`]),
        option.description ? el("small", {}, [option.description]) : null,
      ]),
    ]),
  )));
}
```

Rename CSS selectors from `.codexmod-intake-*` to `.codexmod-choices-*`.

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: choices tests pass.

- [ ] **Step 5: Commit**

```bash
git add tweaks/codex-components/index.js tweaks/codex-components/index.test.cjs
git commit -m "Replace intake with choices"
```

---

### Task 5: Convert Widgets Into Experimental `html`

**Files:**
- Modify: `tweaks/codex-components/index.js`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing tests for `html`**

Replace show/html widget tests with:

```js
test("html component is experimental and disabled by default", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "html",
    version: 1,
    title: "Advanced HTML",
    code: "<button>Inside iframe</button>",
    height: 180,
  });

  assert.equal(document.querySelector(".codexmod-html-frame"), null);
  assert.match(document.querySelector(".codex-components").textContent, /Experimental HTML is disabled/);
});
```

Add:

```js
test("html component renders a scroll-safe iframe when enabled", () => {
  setupDom();
  const state = testState();
  state.settings.experimentalHtml = true;

  mountJson(state, {
    type: "html",
    version: 1,
    title: "Advanced HTML",
    code: "<button>Inside iframe</button>",
    height: 180,
  });

  const frame = document.querySelector(".codexmod-html-frame");
  assert.ok(frame);
  assert.equal(frame.style.pointerEvents, "none");
  assert.equal(document.querySelector(".codexmod-widget-guard button").textContent, "Enable interaction");
});
```

Add old-field rejection:

```js
test("html component requires code and does not accept widget_code", () => {
  setupDom();
  const result = normalizeDescriptor(JSON.stringify({
    type: "html",
    version: 1,
    widget_code: "<div>Old</div>",
  }), "codex-component");

  assert.equal(result.ok, false);
  assert.match(result.error, /code/);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because current widget code accepts old widget shapes and settings.

- [ ] **Step 3: Add `experimentalHtml` setting**

In `DEFAULT_SETTINGS`, add:

```js
experimentalHtml: false,
```

In Settings page, replace "Sandboxed HTML widgets" with:

```js
toggleRow(state, "experimentalHtml", "Experimental HTML", "Render advanced custom HTML components in a scroll-safe iframe.")
```

Remove or stop using `htmlWidgets` in the public settings UI.

- [ ] **Step 4: Tighten `normalizeDescriptor` for `html`**

Inside `normalizeDescriptor`, after type validation:

```js
if (descriptor.type === "html" && typeof descriptor.code !== "string") {
  return { ok: false, error: "html component requires a code string." };
}
```

Do not accept `widget_code`, `html`, or `content` as aliases.

- [ ] **Step 5: Implement `renderHtml`**

Replace `renderHtmlWidget` and `renderShowWidget` public dispatch with:

```js
function renderHtml(target, descriptor, raw, state) {
  if (!state.settings.experimentalHtml) {
    target.innerHTML = "";
    renderError(target, "Experimental HTML is disabled. Enable it in Codex Components settings to render this component.", raw);
    return;
  }
  const body = renderShell(target, descriptor, raw, state, "codexmod-html");
  mountHtmlFrame(body, descriptor, state);
}

function mountHtmlFrame(body, descriptor, state) {
  const frame = document.createElement("iframe");
  const bounds = widgetFrameBounds(descriptor, 520);
  frame.className = "codexmod-widget-frame codexmod-html-frame";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("scrolling", "yes");
  frame.srcdoc = buildWidgetDocument(descriptor.code);
  mountWidgetScrollbox(body, frame, bounds, state);
  attachFrameInteractionGuard(body, frame);
  // Reuse the existing postMessage listener behavior for size, sendPrompt, openLink, and scroll-parent.
}
```

Keep existing `buildWidgetDocument`, `sanitizeWidgetCode`, frame bounds, scrollbox, interaction guard, and scroll assist helpers. Rename only where the public schema requires it.

- [ ] **Step 6: Remove old show-widget language detection**

Update:

- `collectTextFenceBlocks` should search only for ````codex-component`.
- `shouldHideSource` should no longer check `codex-widget`, `show_widget`, or `show-widget`.
- `hasOwnCodeBlockChrome` labels should only include `codex-component` and `json`/`codex` where relevant.
- Tests should stop creating `language-show_widget` and `language-codex-widget` sources.

- [ ] **Step 7: Run tests and verify pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: html tests pass and old widget tests are removed or rewritten.

- [ ] **Step 8: Commit**

```bash
git add tweaks/codex-components/index.js tweaks/codex-components/index.test.cjs
git commit -m "Make html an experimental component"
```

---

### Task 6: Update Settings, Onboarding, and Prompt Contract

**Files:**
- Modify: `tweaks/codex-components/index.js`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing settings text test**

Add:

```js
test("settings copy teaches components, group, choices, and experimental html", () => {
  setupDom();
  const state = testState();
  const root = document.querySelector("main");

  renderSettingsPage(root, state);

  assert.match(root.textContent, /Components/);
  assert.match(root.textContent, /group/);
  assert.match(root.textContent, /choices/);
  assert.match(root.textContent, /Experimental HTML/);
  assert.doesNotMatch(root.textContent, /dashboard/i);
  assert.doesNotMatch(root.textContent, /intake/i);
  assert.doesNotMatch(root.textContent, /show_widget/i);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because settings still say dashboard/intake/widget.

- [ ] **Step 3: Rewrite settings labels**

In `renderSettingsPage`:

- Replace hero copy with "Turn structured Codex output into safe visual components, groups, tables, choices, and previews."
- Rename "Dashboards" toggle to "Declarative components".
- Remove separate old `dashboards`, `intake`, and `htmlWidgets` toggles from the UI unless still needed internally.
- Keep link previews, video previews, table polish, prompt helper, onboarding, and updates.

In onboarding:

- Step 1: "Use components for one visual block."
- Step 2: "Use group when several components belong together."
- Step 3: "Use html only for advanced experimental custom visuals."

In `examplePromptText()`:

```js
return "Create a Codex Components group with metrics, insights, progress, timeline, table, recommendations, actions, and choices components.";
```

In `componentGalleryPromptText()`:

```js
return "Create a Codex Components gallery showing one example of every stable component type, plus one experimental html example only if needed.";
```

In `promptContract(settings)`, teach only the new schema.

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: settings copy tests pass.

- [ ] **Step 5: Commit**

```bash
git add tweaks/codex-components/index.js tweaks/codex-components/index.test.cjs
git commit -m "Update component settings language"
```

---

### Task 7: Update the Codex Skill

**Files:**
- Modify: `skills/codex-components/SKILL.md`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing skill contract test**

Add:

```js
test("skill teaches the v0.2 component schema only", () => {
  const skill = readFileSync(join(__dirname, "..", "..", "skills", "codex-components", "SKILL.md"), "utf8");

  assert.match(skill, /type": "group"/);
  assert.match(skill, /\bchoices\b/);
  assert.match(skill, /\bhtml\b/);
  assert.doesNotMatch(skill, /type": "dashboard"/);
  assert.doesNotMatch(skill, /\bintake\b/);
  assert.doesNotMatch(skill, /\bshow_widget\b/);
  assert.doesNotMatch(skill, /\bhtml_widget\b/);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because the current skill teaches old names.

- [ ] **Step 3: Rewrite `skills/codex-components/SKILL.md`**

Use this structure:

```md
# Codex Components

Use Codex Components when structured output would be clearer as one or more visual components.

## Default Rule

Emit a fenced `codex-component` JSON block.

## Stable Components

- `metrics`
- `insights`
- `funnel`
- `bars`
- `progress`
- `callouts`
- `records`
- `alerts`
- `comparison`
- `timeline`
- `quote`
- `tags`
- `table`
- `recommendations`
- `actions`
- `choices`
- `group`

## Experimental

- `html`: advanced custom HTML/SVG/interaction. Use only when stable components cannot express the result.
```

Include examples for:

```codex-component
{
  "type": "metrics",
  "version": 1,
  "title": "Snapshot",
  "items": [{ "label": "Open Tasks", "value": "7" }]
}
```

```codex-component
{
  "type": "group",
  "version": 1,
  "title": "Launch Readiness",
  "components": [
    { "type": "metrics", "version": 1, "items": [{ "label": "Ready", "value": "82%" }] },
    { "type": "choices", "version": 1, "options": [{ "label": "Continue", "prompt": "Continue." }] }
  ]
}
```

Rules:

- Use `group` when combining multiple components.
- Use `choices` for follow-up options.
- Use `table` for repeated rows.
- Use normal links outside tables for link/video previews.
- Do not use `html` for lists, tables, records, or repeated rows.
- Do not use old schema names.

- [ ] **Step 4: Run the test and verify pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: skill contract test passes.

- [ ] **Step 5: Commit**

```bash
git add skills/codex-components/SKILL.md tweaks/codex-components/index.test.cjs
git commit -m "Teach component-only schema"
```

---

### Task 8: Update README and Component Catalogue

**Files:**
- Modify: `README.md`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write failing README contract test**

Replace the existing README supported section list test with:

```js
test("README documents the v0.2 component catalogue only", () => {
  const readme = readFileSync(join(__dirname, "..", "..", "README.md"), "utf8");
  const components = [
    "group",
    "metrics",
    "insights",
    "funnel",
    "bars",
    "progress",
    "callouts",
    "records",
    "alerts",
    "comparison",
    "timeline",
    "quote",
    "tags",
    "table",
    "recommendations",
    "actions",
    "choices",
    "html",
  ];

  for (const component of components) {
    assert.match(readme, new RegExp(`\\\`${component}\\\``), `${component} is missing from README.md`);
  }
  assert.doesNotMatch(readme, /type: "dashboard"|type": "dashboard"/);
  assert.doesNotMatch(readme, /type: "intake"|type": "intake"/);
  assert.doesNotMatch(readme, /show_widget|html_widget|codex-widget/);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: FAIL because README still documents old names.

- [ ] **Step 3: Rewrite README schema sections**

Update `README.md`:

- Opening: "Codex Components is a Codex++ tweak that turns structured Codex output into safe visual components."
- Replace "Tweak Blocks" with "Component Blocks."
- Replace "Dashboard section types" with "Component Catalogue."
- Add examples for:
  - single `metrics`
  - `group`
  - `choices`
  - experimental `html`
- Add a breaking reset note:

```md
## Schema Reset

Version 0.2 uses the component-only schema. Older experimental names such as dashboard, intake, show_widget, html_widget, and codex-widget are intentionally not supported.
```

- [ ] **Step 4: Run the test and verify pass**

Run:

```bash
npm test -- tweaks/codex-components/index.test.cjs
```

Expected: README contract test passes.

- [ ] **Step 5: Commit**

```bash
git add README.md tweaks/codex-components/index.test.cjs
git commit -m "Document component-only schema"
```

---

### Task 9: Bump Version and Changelog

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tweaks/codex-components/manifest.json`
- Modify: `tweaks/codex-components/index.js`
- Modify: `CHANGELOG.md`
- Modify: `tweaks/codex-components/index.test.cjs`

- [ ] **Step 1: Write or update version-sync test**

Keep the existing test:

```js
test("package, manifest, and runtime component versions stay in sync", () => {
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(__dirname, "manifest.json"), "utf8"));
  const source = readFileSync(join(__dirname, "index.js"), "utf8");
  const runtimeVersion = /const CURRENT_VERSION = "([^"]+)"/.exec(source)?.[1];

  assert.equal(packageJson.version, manifest.version);
  assert.equal(packageJson.version, runtimeVersion);
});
```

- [ ] **Step 2: Update versions to `0.2.0`**

Set:

- `package.json` version to `0.2.0`
- top-level `package-lock.json` version to `0.2.0`
- root package entry in `package-lock.json` version to `0.2.0`
- `tweaks/codex-components/manifest.json` version to `0.2.0`
- `CURRENT_VERSION` in `tweaks/codex-components/index.js` to `0.2.0`
- `TWEAK_BUILD` to a dated value such as `2026-05-10-component-schema-v2`

- [ ] **Step 3: Update changelog**

Add:

```md
## 0.2.0 - 2026-05-10

- Reset the public Codex Components schema around standalone components.
- Added `group` as a normal component for composing other components.
- Replaced intake cards with `choices`.
- Replaced widget/show_widget/html_widget with experimental `html`.
- Removed old schema aliases intentionally because the project has not been publicly shared yet.
```

- [ ] **Step 4: Run full check**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tweaks/codex-components/manifest.json tweaks/codex-components/index.js CHANGELOG.md tweaks/codex-components/index.test.cjs
git commit -m "Bump schema reset release"
```

---

### Task 10: Final Verification and Local Install

**Files:**
- No source edits expected unless verification finds issues.

- [ ] **Step 1: Run full project check**

Run:

```bash
npm run check
```

Expected: PASS with all tests green.

- [ ] **Step 2: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: clean except intentionally untracked local notes such as `ideas.md`.

- [ ] **Step 3: Install only the updated local tweak and skill for manual Codex++ testing**

Run from repo root:

```bash
mkdir -p "$HOME/Library/Application Support/codex-plusplus/tweaks" "$HOME/.codex/skills"
rm -rf "$HOME/Library/Application Support/codex-plusplus/tweaks/com.codexmod.components" "$HOME/.codex/skills/codex-components"
cp -R tweaks/codex-components "$HOME/Library/Application Support/codex-plusplus/tweaks/com.codexmod.components"
cp -R skills/codex-components "$HOME/.codex/skills/codex-components"
```

Expected:

- `~/Library/Application Support/codex-plusplus/tweaks/com.codexmod.components/manifest.json` reports `0.2.0`.
- Codex++ settings and other tweaks are not modified.

- [ ] **Step 4: Manual Codex++ smoke test**

Restart Codex++ and paste these one at a time:

```codex-component
{
  "type": "metrics",
  "version": 1,
  "title": "Smoke Test",
  "items": [{ "label": "Schema", "value": "0.2" }]
}
```

```codex-component
{
  "type": "group",
  "version": 1,
  "title": "Grouped Smoke Test",
  "components": [
    { "type": "metrics", "version": 1, "items": [{ "label": "One", "value": "1" }] },
    { "type": "choices", "version": 1, "options": [{ "label": "Continue", "prompt": "Continue testing." }] }
  ]
}
```

Expected:

- No code block chrome around rendered components.
- `metrics` renders standalone.
- `group` renders multiple nested components without card-inside-card visual clutter.
- `choices` inserts the prompt into the composer.
- Old examples with `dashboard`, `intake`, or `show_widget` do not render as valid components.

- [ ] **Step 5: Final commit if manual smoke test required fixes**

If fixes were needed:

```bash
git add <changed-files>
git commit -m "Polish component schema reset"
```

---

## Final Acceptance Criteria

- `npm run check` passes.
- Public docs and skill do not teach old names.
- Renderer does not accept old names or old fences as aliases.
- Every stable component can render as a top-level `codex-component`.
- `group` renders nested components through `components[]`.
- `choices` replaces `intake`.
- `html` replaces widget concepts and is experimental.
- Link previews, video previews, table polish, settings page, onboarding, and update checks still work.
- Version is bumped to `0.2.0` everywhere.

## Review Note

The writing-plans skill normally asks for a plan-review subagent. This session is explicitly staying on `main`, and current tool policy only allows subagents when the user explicitly asks for them. Do not dispatch a reviewer unless the user asks for that review step.
