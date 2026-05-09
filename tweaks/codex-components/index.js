/** @type {import("@codex-plusplus/sdk").Tweak} */
module.exports = {
  start(api) {
    const state = createState(api);
    this._state = state;
    installStyles(state);
    installRenderer(state);
    registerSettings(state);
    state.api.log.info("Codex Components started");
  },

  stop() {
    const state = this._state;
    if (!state) return;
    disposeState(state);
    this._state = null;
  },
};

function createState(api) {
  return {
    api,
    settings: loadSettings(),
    mounted: new WeakSet(),
    enhancedTables: new WeakSet(),
    enhancedLinks: new WeakSet(),
    disposers: [],
    observer: null,
    scanQueued: false,
    disposed: false,
    widgetObserver: null,
    pageHandle: null,
    sectionHandle: null,
    pageRoot: null,
  };
}

const SETTINGS_KEY = "codexmod.components.settings.v1";

const DEFAULT_SETTINGS = Object.freeze({
  renderer: true,
  dashboards: true,
  intake: true,
  htmlWidgets: true,
  mediaEmbeds: true,
  linkPreviews: true,
  tablePolish: true,
  autoPromptHelper: true,
  promptInjection: true,
  videoPreviewMigration: 1,
});

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    if (stored.videoPreviewMigration !== 1) {
      settings.mediaEmbeds = true;
      settings.videoPreviewMigration = 1;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(state) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function setSetting(state, key, value) {
  state.settings[key] = Boolean(value);
  saveSettings(state);
  rerenderAll(state);
  if (state.pageRoot) renderSettingsPage(state.pageRoot, state);
}

function rerenderAll(state) {
  document.querySelectorAll("[data-codexmod-component-mount]").forEach((node) => node.remove());
  document.querySelectorAll("[data-codexmod-component-source='true']").forEach((node) => {
    node.style.display = "";
    node.removeAttribute("data-codexmod-component-source");
  });
  state.mounted = new WeakSet();
  state.enhancedTables = new WeakSet();
  state.enhancedLinks = new WeakSet();
  scanDocument(state);
}

function disposeState(state) {
  state.disposed = true;
  state.pageHandle?.unregister?.();
  state.sectionHandle?.unregister?.();
  while (state.disposers.length) {
    try {
      state.disposers.pop()();
    } catch (error) {
      state.api.log.warn("dispose failed", error);
    }
  }
}

function installRenderer(state) {
  scheduleScan(state);
  const observer = new MutationObserver(() => scheduleScan(state));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.observer = observer;
  state.disposers.push(() => observer.disconnect());
  installWidgetObserver(state);
  state.disposers.push(() => {
    document.querySelectorAll("[data-codexmod-component-mount]").forEach((node) => node.remove());
    document.querySelectorAll("[data-codexmod-component-source='true']").forEach((node) => {
      node.style.display = "";
      node.removeAttribute("data-codexmod-component-source");
    });
  });
  installPromptInjection(state);
}

function scanDocument(state) {
  state.scanQueued = false;
  if (!state.settings.renderer) return;
  const blocks = [];
  const candidates = recentNodes(document.querySelectorAll("pre, code, [data-language], [class*='language-']"), 160);
  candidates.forEach((node) => {
    if (shouldSkipNode(state, node)) return;
    const text = node.textContent || "";
    if (text.length > 120000) return;
    const language = detectLanguage(node);
    if (isComponentLanguage(language)) {
      blocks.push({ node, language, raw: cleanRaw(text, language), hideSource: true });
      return;
    }
    if (isCandidateJsonLanguage(language)) {
      const raw = cleanRaw(text, language);
      if (looksLikeComponentJson(raw)) {
        blocks.push({ node, language: "codex-component", raw, hideSource: true });
        return;
      }
    }
    blocks.push(...blocksFromText(state, node, text, true));
  });
  collectTextFenceBlocks(state, blocks);
  blocks.slice(0, 24).forEach((block) => mountBlock(state, block));
  enhanceNativeTables(state);
  enhanceLinksAndMedia(state);
}

function scheduleScan(state) {
  if (state.scanQueued) return;
  state.scanQueued = true;
  const run = () => {
    if (state.disposed) return;
    scanDocument(state);
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 900 });
  } else {
    window.setTimeout(run, 120);
  }
}

function recentNodes(nodeList, limit) {
  const nodes = Array.from(nodeList);
  return nodes.slice(Math.max(0, nodes.length - limit));
}

function shouldSkipNode(state, node) {
  return state.mounted.has(node)
    || node.closest?.("[data-codexmod-component-mount], .codex-components, .codexmod-settings")
    || node.dataset?.codexmodComponentSource === "true";
}

function collectTextFenceBlocks(state, blocks) {
  const root = document.querySelector("main") || document.body;
  if (!root || (root.textContent || "").length > 350000) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new WeakSet(blocks.map((block) => block.node));
  let checked = 0;
  let textNode = walker.nextNode();
  while (textNode && checked < 800) {
    checked += 1;
    const text = textNode.textContent || "";
    if (text.includes("```codex-component") || text.includes("```codex-widget") || text.includes("```show_widget")) {
      const source = nearestRenderableSource(textNode);
      if (source && !seen.has(source) && !shouldSkipNode(state, source)) {
        blocks.push(...blocksFromText(state, source, source.textContent || text, shouldHideSource(source)));
        seen.add(source);
      }
    }
    textNode = walker.nextNode();
  }
}

function nearestRenderableSource(textNode) {
  const parent = textNode.parentElement;
  if (!parent) return null;
  return parent.closest("pre, code, [data-message-author-role], article, [role='article'], li, p, div") || parent;
}

function shouldHideSource(source) {
  const text = (source.textContent || "").trim();
  return text.startsWith("```codex-component")
    || text.startsWith("```codex-widget")
    || text.startsWith("```show_widget")
    || text.startsWith("```show-widget")
    || isComponentLanguage(detectLanguage(source));
}

function blocksFromText(state, node, text, hideSource) {
  const blocks = [];
  for (const match of text.matchAll(/```([A-Za-z0-9_-]+)[ \t]*\n([\s\S]*?)```/g)) {
    if (isComponentLanguage(match[1])) {
      blocks.push({ node, language: match[1], raw: match[2].trim(), hideSource });
    }
  }
  return blocks;
}

function cleanRaw(text, language) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("```")) {
    const match = /^```([A-Za-z0-9_-]+)[ \t]*\n([\s\S]*?)```$/.exec(trimmed);
    if (match && isComponentLanguage(match[1])) return match[2].trim();
  }
  if (trimmed.startsWith(`${language}\n`)) return trimmed.slice(language.length).trim();
  return trimmed;
}

function detectLanguage(node) {
  const candidates = [
    node.getAttribute("data-language"),
    node.getAttribute("lang"),
    node.className,
    node.querySelector?.("code")?.getAttribute("data-language"),
    node.querySelector?.("code")?.className,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || "");
    for (const token of text.split(/\s+/)) {
      const lang = token.replace(/^(language-|lang-)/, "");
      if (isComponentLanguage(lang)) return lang;
    }
  }
  return "";
}

function isComponentLanguage(language) {
  return ["codex-component", "codex-widget", "show_widget", "show-widget"].includes(String(language || "").trim());
}

function isCandidateJsonLanguage(language) {
  return ["codex", "json", ""].includes(String(language || "").trim());
}

function looksLikeComponentJson(raw) {
  try {
    const descriptor = JSON.parse(String(raw || "").trim());
    return descriptor
      && typeof descriptor === "object"
      && !Array.isArray(descriptor)
      && (["dashboard", "intake", "html_widget", "show_widget"].includes(descriptor.type) || typeof descriptor.widget_code === "string")
      && (descriptor.version === undefined || typeof descriptor.version === "number");
  } catch {
    return false;
  }
}

function normalizeDescriptor(raw, language) {
  let descriptor;
  try {
    descriptor = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: `Invalid component JSON: ${error.message}` };
  }
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    return { ok: false, error: "Component descriptor must be an object." };
  }
  if (!descriptor.version && (language === "codex-widget" || language === "show_widget" || language === "show-widget" || descriptor.widget_code)) {
    descriptor.version = 1;
  }
  if (!descriptor.type && (language === "show_widget" || language === "show-widget" || descriptor.widget_code)) {
    descriptor.type = "show_widget";
  } else if (!descriptor.type && language === "codex-widget") {
    descriptor.type = "html_widget";
  }
  if (typeof descriptor.type !== "string" || !descriptor.type.trim()) {
    return { ok: false, error: "Component descriptor requires a type." };
  }
  if (typeof descriptor.version !== "number") {
    return { ok: false, error: "Component descriptor requires a numeric version." };
  }
  descriptor.type = descriptor.type.trim();
  return { ok: true, descriptor };
}

function mountBlock(state, block) {
  state.mounted.add(block.node);
  const sourceNode = block.hideSource ? findCodeBlockShell(block.node, block.raw) : block.node;
  state.mounted.add(sourceNode);
  sourceNode.dataset.codexmodComponentSource = "true";
  if (block.hideSource) sourceNode.style.display = "none";
  const mount = document.createElement("div");
  mount.className = "codex-components";
  mount.dataset.codexmodComponentMount = "true";
  sourceNode.after(mount);

  const result = normalizeDescriptor(block.raw, block.language);
  if (!result.ok) {
    renderError(mount, result.error, block.raw);
    return;
  }
  const descriptor = result.descriptor;
  try {
    if (descriptor.type === "dashboard" && state.settings.dashboards) renderDashboard(mount, descriptor, block.raw, state);
    else if (descriptor.type === "intake" && state.settings.intake) renderIntake(mount, descriptor, block.raw, state);
    else if (descriptor.type === "html_widget" && state.settings.htmlWidgets) renderHtmlWidget(mount, descriptor, block.raw, state);
    else if (descriptor.type === "show_widget" && state.settings.htmlWidgets) renderShowWidget(mount, descriptor, block.raw, state);
    else if (["dashboard", "intake", "html_widget", "show_widget"].includes(descriptor.type)) {
      sourceNode.style.display = "";
      mount.remove();
    }
    else renderError(mount, `Unknown component type: ${descriptor.type}`, block.raw);
  } catch (error) {
    renderError(mount, error.message || String(error), block.raw);
  }
}

function findCodeBlockShell(node, raw) {
  let current = node;
  const rawStart = String(raw || "").trim().slice(0, 40);
  for (let i = 0; i < 8 && current?.parentElement; i += 1) {
    const parent = current.parentElement;
    const text = parent.textContent || "";
    const looksLikeCodeShell =
      text.includes(rawStart)
      && (parent.querySelector?.("button, svg, [aria-label*='opy'], [title*='opy']")
        || /^(json|codex|codex-component|show_widget|show-widget)\s*\{/.test(text.trim()));
    const tooBroad =
      parent.matches?.("article, [data-message-author-role], main, body")
      || parent.querySelectorAll?.("pre").length > 1
      || parent.querySelectorAll?.("[data-codexmod-component-mount]").length > 0;
    if (looksLikeCodeShell && !tooBroad) current = parent;
    else break;
  }
  return current;
}

function renderShell(target, descriptor, raw, state, className) {
  target.innerHTML = "";
  const shell = el("section", { className: `codexmod-component ${className}` });
  const header = el("header", { className: "codexmod-component-header" }, [
    el("div", {}, [
      el("h3", { className: "codexmod-component-title" }, [descriptor.title || "Component"]),
      descriptor.subtitle ? el("p", { className: "codexmod-component-subtitle" }, [descriptor.subtitle]) : null,
    ]),
    toolbar(descriptor, raw, state),
  ]);
  const body = el("div", { className: "codexmod-component-body" });
  shell.append(header, body);
  target.append(shell);
  return body;
}

function toolbar(descriptor, raw, state) {
  const bar = el("div", { className: "codexmod-component-toolbar" });
  bar.append(
    button("Copy data", () => copyText(JSON.stringify(descriptor, null, 2), state)),
    button("Copy source", () => copyText(raw, state)),
    button("View source", () => showSource(raw)),
  );
  return bar;
}

function renderDashboard(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-dashboard");
  for (const section of descriptor.sections || []) {
    if (section.type === "metric_strip") renderMetricStrip(body, section);
    else if (section.type === "insight_grid") renderInsightGrid(body, section);
    else if (section.type === "funnel" || section.type === "bar_chart") renderBars(body, section);
    else if (section.type === "table") renderTable(body, section);
    else if (section.type === "recommendations") renderRecommendations(body, section);
    else if (section.type === "action_chips") renderActions(body, section);
    else renderCallout(body, section);
  }
}

function renderMetricStrip(body, section) {
  const wrap = sectionWrap(section, "codexmod-metrics-section");
  const grid = el("div", { className: "codexmod-metrics" });
  for (const item of section.items || section.metrics || []) {
    grid.append(el("article", { className: "codexmod-metric" }, [
      el("span", { className: "codexmod-label" }, [item.label || item.name || "Metric"]),
      el("strong", { className: "codexmod-value" }, [String(item.value ?? "")]),
      item.delta ? el("span", { className: "codexmod-note" }, [item.delta]) : null,
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

function renderInsightGrid(body, section) {
  const wrap = sectionWrap(section, "codexmod-insights-section");
  const grid = el("div", { className: "codexmod-insights" });
  for (const item of section.items || section.insights || []) {
    grid.append(el("article", { className: "codexmod-insight" }, [
      el("h5", {}, [item.title || item.label || "Insight"]),
      el("p", {}, [item.body || item.text || item.value || ""]),
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

function renderBars(body, section) {
  const items = section.items || section.bars || section.steps || [];
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  const wrap = sectionWrap(section, "codexmod-bars-section");
  for (const item of items) {
    wrap.append(el("div", { className: "codexmod-bar-row" }, [
      el("span", { className: "codexmod-bar-label" }, [item.label || item.name || "Item"]),
      el("span", { className: "codexmod-bar-track" }, [
        el("span", {
          className: "codexmod-bar-fill",
          style: `width:${Math.max(3, ((Number(item.value) || 0) / max) * 100)}%`,
        }),
      ]),
      el("strong", { className: "codexmod-bar-value" }, [String(item.value ?? "")]),
    ]));
  }
  body.append(wrap);
}

function renderTable(body, section) {
  const columns = section.columns || [];
  const table = el("table", { className: "codexmod-table" }, [
    el("thead", {}, [el("tr", {}, columns.map((c) => el("th", {}, [c.label || c.key || c])))]),
    el("tbody", {}, (section.rows || []).map((row) => el("tr", {}, columns.map((c) => el("td", {}, [row[c.key || c] ?? ""]))))),
  ]);
  const wrap = sectionWrap(section, "codexmod-table-section");
  wrap.append(table);
  body.append(wrap);
}

function renderRecommendations(body, section) {
  const wrap = sectionWrap(section, "codexmod-recommendations-section");
  wrap.append(el("ul", { className: "codexmod-recommendations" }, (section.items || []).map((item) =>
    el("li", {}, [el("strong", {}, [item.title || item.label || "Recommendation"]), item.body ? el("p", {}, [item.body]) : null]),
  )));
  body.append(wrap);
}

function renderActions(body, section) {
  const wrap = sectionWrap(section, "codexmod-actions-section");
  wrap.append(el("div", { className: "codexmod-actions" }, (section.items || section.actions || []).map((item) =>
    button(item.label || item.text || "Action", () => insertPrompt(item.prompt || item.text || item.label || "")),
  )));
  body.append(wrap);
}

function renderCallout(body, section) {
  const wrap = sectionWrap(section, "codexmod-callout-section");
  wrap.append(el("p", {}, [section.body || section.text || section.markdown || `Unsupported section: ${section.type || "unknown"}`]));
  body.append(wrap);
}

function renderIntake(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-intake");
  const prompt = descriptor.question || descriptor.title || "Choose an option";
  body.append(el("h2", { className: "codexmod-intake-question" }, [prompt]));
  body.append(el("div", { className: "codexmod-intake-options" }, (descriptor.options || []).map((option, index) =>
    el("button", { type: "button", className: "codexmod-intake-option", onclick: () => insertPrompt(option.prompt || option.label || "") }, [
      el("span", {}, [String(index + 1)]),
      el("strong", {}, [option.label || option.title || `Option ${index + 1}`]),
    ]),
  )));
}

function renderHtmlWidget(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-widget");
  const frame = document.createElement("iframe");
  frame.className = "codexmod-widget-frame";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.srcdoc = descriptor.html || descriptor.content || "";
  frame.style.height = `${Number(descriptor.height) || 360}px`;
  body.append(frame);
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.method === "ui/notifications/size-changed" && data.params?.height) {
      frame.style.height = `${Math.max(80, Math.ceil(Number(data.params.height)))}px`;
    }
  };
  window.addEventListener("message", onMessage);
  state.disposers.push(() => window.removeEventListener("message", onMessage));
}

function renderShowWidget(target, descriptor, raw, state) {
  target.innerHTML = "";
  const body = el("section", { className: "codexmod-show-widget-body" }, [
    el("div", { className: "codexmod-widget-loading" }, loadingMessages(descriptor).map((message) => el("span", {}, [message]))),
  ]);
  target.append(body);
  observeLazyWidget(state, body, () => mountShowWidgetFrame(body, descriptor, state));
}

function loadingMessages(descriptor) {
  const messages = Array.isArray(descriptor.loading_messages) ? descriptor.loading_messages : [];
  return messages.slice(0, 4).filter(Boolean).length ? messages.slice(0, 4).filter(Boolean) : ["Rendering widget..."];
}

function humanizeTitle(title) {
  return String(title || "Widget").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function observeLazyWidget(state, node, render) {
  if (!state.widgetObserver) {
    state.widgetObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const renderWidget = entry.target.__codexmodRenderWidget;
        delete entry.target.__codexmodRenderWidget;
        state.widgetObserver.unobserve(entry.target);
        renderWidget?.();
      }
    }, { rootMargin: "320px 0px" });
    state.disposers.push(() => state.widgetObserver?.disconnect());
  }
  node.__codexmodRenderWidget = render;
  state.widgetObserver.observe(node);
}

function mountShowWidgetFrame(body, descriptor, state) {
  body.innerHTML = "";
  const frame = document.createElement("iframe");
  frame.className = "codexmod-widget-frame codexmod-show-widget-frame";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.srcdoc = buildWidgetDocument(descriptor.widget_code || descriptor.html || descriptor.content || "");
  frame.style.height = `${Number(descriptor.height) || 120}px`;
  body.append(frame);
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.method === "ui/notifications/size-changed" && data.params?.height) {
      frame.style.height = `${Math.max(80, Math.ceil(Number(data.params.height)))}px`;
    } else if (data.method === "codex/send-prompt" && data.params?.text) {
      insertPrompt(String(data.params.text));
    } else if (data.method === "codex/open-link" && data.params?.url) {
      window.open(String(data.params.url), "_blank", "noopener,noreferrer");
    }
  };
  window.addEventListener("message", onMessage);
  state.disposers.push(() => window.removeEventListener("message", onMessage));
}

function buildWidgetDocument(widgetCode) {
  const code = sanitizeWidgetCode(widgetCode);
  const tokens = widgetTokenStyle();
  const svgMode = code.trimStart().toLowerCase().startsWith("<svg");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><style>${tokens}
html,body{margin:0;padding:0;background:transparent;color:var(--color-text-primary);font:inherit;overflow:hidden;}
*{box-sizing:border-box}
a{color:inherit}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style></head><body>${code}<script>
(() => {
  window.sendPrompt = (text) => parent.postMessage({ method: "codex/send-prompt", params: { text: String(text || "") } }, "*");
  window.openLink = (url) => parent.postMessage({ method: "codex/open-link", params: { url: String(url || "") } }, "*");
  const contentHeight = () => Math.max(
    document.documentElement.scrollHeight || 0,
    document.body.scrollHeight || 0,
    document.documentElement.offsetHeight || 0,
    document.body.offsetHeight || 0,
    document.documentElement.getBoundingClientRect().height || 0,
    document.body.getBoundingClientRect().height || 0
  );
  const notifySize = () => parent.postMessage({ method: "ui/notifications/size-changed", params: { height: Math.ceil(contentHeight()) } }, "*");
  new ResizeObserver(notifySize).observe(document.body);
  window.addEventListener("load", notifySize);
  requestAnimationFrame(notifySize);
  ${svgMode ? "document.body.style.display='inline-block';" : ""}
})();
</script></body></html>`;
}

function sanitizeWidgetCode(widgetCode) {
  return String(widgetCode || "")
    .replace(/<script\b([^>]*)\bsrc=(["'])(?!https:\/\/(?:cdnjs\.cloudflare\.com|esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)\/)[\s\S]*?<\/script>/gi, "")
    .replace(/\blocalStorage\b/g, "undefined")
    .replace(/\bsessionStorage\b/g, "undefined");
}

function widgetTokenStyle() {
  const computed = getComputedStyle(document.documentElement);
  const names = [
    "--color-background-primary",
    "--color-background-secondary",
    "--color-background-tertiary",
    "--color-background-info",
    "--color-background-danger",
    "--color-background-success",
    "--color-background-warning",
    "--color-text-primary",
    "--color-text-secondary",
    "--color-text-tertiary",
    "--color-text-info",
    "--color-text-danger",
    "--color-text-success",
    "--color-text-warning",
    "--color-border-primary",
    "--color-border-secondary",
    "--color-border-tertiary",
    "--color-border-info",
    "--color-border-danger",
    "--color-border-success",
    "--color-border-warning",
    "--font-sans",
    "--font-serif",
    "--font-mono",
    "--border-radius-md",
    "--border-radius-lg",
    "--border-radius-xl",
  ];
  return `:root{${names.map((name) => `${name}:${computed.getPropertyValue(name).trim() || tokenFallback(name)};`).join("")}${tokenAliases()}}`;
}

function tokenFallback(name) {
  return {
    "--color-background-primary": "transparent",
    "--color-background-secondary": "rgba(127,127,127,.08)",
    "--color-background-tertiary": "rgba(127,127,127,.12)",
    "--color-background-info": "rgba(133,183,235,.12)",
    "--color-background-danger": "rgba(240,149,149,.12)",
    "--color-background-success": "rgba(93,202,165,.12)",
    "--color-background-warning": "rgba(250,199,117,.12)",
    "--color-text-primary": "#f1efe8",
    "--color-text-secondary": "#b4b2a9",
    "--color-text-tertiary": "#888780",
    "--color-text-info": "#85b7eb",
    "--color-text-danger": "#f09595",
    "--color-text-success": "#5dcaa5",
    "--color-text-warning": "#fac775",
    "--color-border-primary": "rgba(241,239,232,.4)",
    "--color-border-secondary": "rgba(241,239,232,.3)",
    "--color-border-tertiary": "rgba(241,239,232,.16)",
    "--color-border-info": "rgba(133,183,235,.4)",
    "--color-border-danger": "rgba(240,149,149,.4)",
    "--color-border-success": "rgba(93,202,165,.4)",
    "--color-border-warning": "rgba(250,199,117,.4)",
    "--font-sans": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-serif": "ui-serif, Georgia, serif",
    "--font-mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "--border-radius-md": "10px",
    "--border-radius-lg": "12px",
    "--border-radius-xl": "16px",
  }[name] || "initial";
}

function tokenAliases() {
  return [
    "--p:var(--color-text-primary);",
    "--s:var(--color-text-secondary);",
    "--t:var(--color-text-tertiary);",
    "--bg2:var(--color-background-secondary);",
    "--b:var(--color-border-tertiary);",
  ].join("");
}

function enhanceNativeTables(state) {
  if (!state.settings.tablePolish) return;
  document.querySelectorAll("table").forEach((table) => {
    if (state.enhancedTables.has(table) || table.closest?.(".codex-components, .codexmod-settings")) return;
    table.classList.add("codexmod-native-table");
    const wrap = table.parentElement;
    if (wrap && !wrap.classList.contains("codexmod-native-table-wrap")) {
      wrap.classList.add("codexmod-native-table-wrap");
    }
    state.enhancedTables.add(table);
  });
}

function enhanceLinksAndMedia(state) {
  if (!state.settings.mediaEmbeds && !state.settings.linkPreviews) return;
  document.querySelectorAll("a[href]").forEach((link) => {
    if (state.enhancedLinks.has(link) || link.closest?.(".codex-components, .codexmod-settings, table")) return;
    const href = link.href;
    const youtube = parseYouTubeUrl(href);
    if (youtube && state.settings.mediaEmbeds) {
      insertAfterLink(link, renderYouTubeEmbed(youtube, href));
      state.enhancedLinks.add(link);
      return;
    }
    if (state.settings.linkPreviews && isPreviewableHttpUrl(href)) {
      insertAfterLink(link, renderLinkPreview(href, link.textContent || href));
      state.enhancedLinks.add(link);
    }
  });
}

function installPromptInjection(state) {
  const handler = (event) => {
    if (!state.settings.promptInjection || !state.settings.autoPromptHelper) return;
    const target = event.target;
    if (target?.closest?.(".codexmod-settings, [data-codexmod-component-mount], .codex-components")) return;
    const shouldSend =
      event.type === "click"
        ? isSendButton(target)
        : isComposerSubmitKey(event);
    if (!shouldSend) return;
    const composer = findComposer(target);
    if (!composer) return;
    const text = readComposer(composer);
    if (!shouldInjectContract(text)) return;
    writeComposer(composer, `${text.trim()}\n\n${componentPromptComment()}`);
    window.setTimeout(() => {
      if (readComposer(composer).includes("Codex Components prompt contract")) writeComposer(composer, text);
    }, 350);
  };
  document.addEventListener("keydown", handler, true);
  document.addEventListener("click", handler, true);
  state.disposers.push(() => {
    document.removeEventListener("keydown", handler, true);
    document.removeEventListener("click", handler, true);
  });
}

function findComposer(target) {
  const scoped = target?.closest?.("form, [role='form'], footer, [data-testid*='composer' i], [class*='composer' i]");
  return scoped?.querySelector?.("textarea, [contenteditable='true']")
    || (isComposerElement(document.activeElement) && document.activeElement)
    || Array.from(document.querySelectorAll("textarea, [contenteditable='true']")).find((node) => isComposerElement(node) && isVisible(node));
}

function readComposer(composer) {
  return "value" in composer ? composer.value : composer.textContent || "";
}

function writeComposer(composer, text) {
  if ("value" in composer) composer.value = text;
  else composer.textContent = text;
  composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function isVisible(node) {
  const rect = node.getBoundingClientRect?.();
  return Boolean(rect && rect.width > 20 && rect.height > 10);
}

function isComposerElement(node) {
  return Boolean(node?.matches?.("textarea, [contenteditable='true']")
    && !node.closest?.(".codexmod-settings, [data-codexmod-component-mount], .codex-components")
    && isVisible(node));
}

function isComposerSubmitKey(event) {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) return false;
  return isComposerElement(event.target) && (event.metaKey || event.ctrlKey);
}

function isSendButton(target) {
  const buttonNode = target?.closest?.("button");
  if (!buttonNode) return false;
  const label = `${buttonNode.getAttribute("aria-label") || ""} ${buttonNode.title || ""} ${buttonNode.textContent || ""}`.toLowerCase();
  if (!/(send|submit|enviar|enviar mensaje|send message|arrow up|↑)/.test(label)) return false;
  const rect = buttonNode.getBoundingClientRect?.();
  const nearBottom = rect ? rect.bottom > window.innerHeight * 0.58 : true;
  return nearBottom && Boolean(findComposer(buttonNode));
}

function stripPromptContractFromText(text) {
  return String(text || "").replace(/\n?\s*<!-- Codex Components prompt contract:[\s\S]*?-->\s*/g, "").trimEnd();
}

function shouldInjectContract(text) {
  const value = stripPromptContractFromText(text);
  if (!value.trim() || value.includes("Codex Components prompt contract")) return false;
  return /\b(use|using|query|check|analy[sz]e|dashboard|table|graph|chart|metric|funnel|report|posthog|supabase|meta ads|gmail|drive|calendar|stripe|github|plugin|skill|mcp|tool|link|youtube|video)\b/i.test(value);
}

function componentPromptComment() {
  return `<!-- Codex Components prompt contract:
When this answer uses tools, plugins, skills, analytics, links, tables, or structured data, prefer concise visual components over prose-only output.
For dashboards, emit a fenced JSON block with language codex-component and type "dashboard".
For custom HTML/SVG visuals or interactive mini-tools, emit language show_widget with title, widget_code, and loading_messages.
Use sections: metric_strip, insight_grid, funnel, bar_chart, table, recommendations, action_chips.
Keep labels short, include one-line interpretation, and use semantic signal colors only.
Leave YouTube/video URLs and normal URLs as plain links outside tables so Codex Components can render embeds/link cards.
Do not place link preview cards inside tables.
-->`;
}

function insertAfterLink(link, node) {
  const paragraph = link.closest("p, li, div") || link;
  if (paragraph.nextElementSibling?.dataset?.codexmodLinkPreview === "true") return;
  node.dataset.codexmodLinkPreview = "true";
  paragraph.after(node);
}

function parseYouTubeUrl(href) {
  try {
    const url = new URL(href);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
    }
  } catch {
    return null;
  }
  return null;
}

function isPreviewableHttpUrl(href) {
  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function renderYouTubeEmbed(videoId, href) {
  const safeId = encodeURIComponent(videoId);
  const card = el("section", { className: "codexmod-link-card codexmod-video-card" });
  renderYouTubePreview(card, safeId, href);
  return card;
}

function renderYouTubePreview(card, safeId, href) {
  card.classList.remove("codexmod-video-card-loaded");
  card.innerHTML = "";
  card.append(
    el("button", { type: "button", className: "codexmod-video-thumb", onclick: () => loadYouTubeFrame(card, safeId, href) }, [
      el("img", {
        src: `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg`,
        alt: "YouTube video thumbnail",
        loading: "lazy",
      }),
      el("span", { className: "codexmod-video-play", "aria-hidden": "true" }, ["▶"]),
    ]),
    el("div", { className: "codexmod-video-meta" }, [
      el("strong", {}, ["YouTube video"]),
      el("span", {}, [new URL(href).hostname.replace(/^www\./, "")]),
    ]),
    el("div", { className: "codexmod-video-actions" }, [
      button("Play", () => loadYouTubeFrame(card, safeId, href)),
      el("a", { href, target: "_blank", rel: "noreferrer" }, ["Open"]),
    ]),
  );
}

function loadYouTubeFrame(card, safeId, href) {
  card.classList.add("codexmod-video-card-loaded");
  card.innerHTML = "";
  card.append(
    el("div", { className: "codexmod-video-framebar" }, [
      button("Hide video", () => renderYouTubePreview(card, safeId, href)),
      el("a", { href, target: "_blank", rel: "noreferrer" }, ["Open on YouTube"]),
    ]),
    el("iframe", {
      src: `https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1`,
      title: "YouTube video",
      loading: "lazy",
      referrerpolicy: "strict-origin-when-cross-origin",
      allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      allowfullscreen: "true",
    }),
  );
}

function renderLinkPreview(href, label) {
  const url = new URL(href);
  return el("section", { className: "codexmod-link-card" }, [
    el("div", { className: "codexmod-link-favicon" }, [url.hostname.slice(0, 1).toUpperCase()]),
    el("div", {}, [
      el("strong", {}, [cleanLinkLabel(label, url)]),
      el("span", {}, [url.hostname.replace(/^www\./, "")]),
    ]),
  ]);
}

function cleanLinkLabel(label, url) {
  const text = String(label || "").trim();
  if (!text || text === url.href) return url.hostname.replace(/^www\./, "");
  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

function renderError(target, message, raw) {
  target.innerHTML = "";
  target.append(el("section", { className: "codex-components codexmod-component codexmod-error" }, [
    el("strong", {}, ["Could not render component"]),
    el("p", {}, [message]),
    el("details", {}, [el("summary", {}, ["View source"]), el("pre", {}, [raw])]),
  ]));
}

function sectionWrap(section, className) {
  return el("section", { className: `codexmod-section ${className}` }, [
    section.title ? el("h4", { className: "codexmod-section-title" }, [section.title]) : null,
  ]);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    if (key === "className") node.className = value;
    else if (key === "onclick") node.addEventListener("click", value);
    else if (key === "style") node.setAttribute("style", value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function button(label, onClick) {
  return el("button", { type: "button", onclick: onClick }, [label]);
}

async function copyText(text, state) {
  await navigator.clipboard.writeText(text);
  state.api.log.info("Copied component text");
}

function showSource(raw) {
  const win = window.open("", "_blank", "width=720,height=720");
  if (!win) return;
  win.document.body.innerHTML = "";
  const pre = win.document.createElement("pre");
  pre.textContent = raw;
  win.document.body.append(pre);
}

function insertPrompt(text) {
  const composer = document.querySelector("textarea, [contenteditable='true']");
  if (!composer) return;
  composer.focus();
  if ("value" in composer) composer.value = text;
  else composer.textContent = text;
  composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

function registerSettings(state) {
  const page = {
    id: "main",
    title: "Codex Components",
    description: "Claude-style dashboards, media cards, link previews, and polished tables.",
    iconSvg:
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M6 8h3M6 11h8M12 8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      "</svg>",
    render(root) {
      renderSettingsPage(root, state);
    },
  };

  if (typeof state.api.settings?.registerPage === "function") {
    state.pageHandle = state.api.settings.registerPage(page);
  }

  state.sectionHandle = state.api.settings.register({
    id: "com.codexmod.components:summary",
    title: "Codex Components",
    description: "Open the Components page to configure renderers.",
    render(root) {
      root.innerHTML = "";
      root.append(el("div", { className: "codexmod-settings codexmod-settings-compact" }, [
        el("p", {}, ["Rendering is ", el("strong", {}, [state.settings.renderer ? "on" : "off"]), ". Configure individual components from the sidebar tab."]),
      ]));
    },
  });
}

function renderSettingsPage(root, state) {
  state.pageRoot = root;
  root.innerHTML = "";
  const settings = state.settings;
  root.append(el("div", { className: "codexmod-settings" }, [
    el("section", { className: "codexmod-settings-hero" }, [
      el("div", {}, [
        el("h2", {}, ["Codex Components"]),
        el("p", {}, ["Turn raw tool output into readable dashboards, tables, media cards, and link previews."]),
      ]),
      el("span", { className: "codexmod-settings-pill" }, [settings.renderer ? "Active" : "Paused"]),
    ]),
    settingsGroup("Rendering", [
      toggleRow(state, "renderer", "Enable renderer", "Render component blocks in chat."),
      toggleRow(state, "dashboards", "Dashboards", "Cards, metrics, funnels, bars, recommendations, and action chips."),
      toggleRow(state, "intake", "Guided intake cards", "Claude Cowork-style questions with selectable answers."),
      toggleRow(state, "htmlWidgets", "Sandboxed HTML widgets", "Render trusted widget HTML in an isolated iframe."),
    ]),
    settingsGroup("Automatic polish", [
      toggleRow(state, "tablePolish", "Polish normal tables", "Restyle Markdown/tool tables so they read closer to Claude Cowork."),
      toggleRow(state, "mediaEmbeds", "Preview video links", "Turn YouTube links into click-to-load video cards outside tables."),
      toggleRow(state, "linkPreviews", "Open Graph-style link cards", "Show clean link cards outside tables without touching tabular data."),
      toggleRow(state, "autoPromptHelper", "Prompt helper", "Keep a copyable instruction contract for model responses that should become components."),
      toggleRow(state, "promptInjection", "Automatic prompt injection", "Quietly append the component contract to tool/plugin-like requests."),
    ]),
    promptContract(settings),
  ]));
}

function settingsGroup(title, rows) {
  return el("section", { className: "codexmod-settings-group" }, [
    el("h3", {}, [title]),
    el("div", { className: "codexmod-settings-list" }, rows),
  ]);
}

function toggleRow(state, key, title, description) {
  const input = el("input", { type: "checkbox" });
  input.checked = Boolean(state.settings[key]);
  input.addEventListener("change", () => setSetting(state, key, input.checked));
  return el("label", { className: "codexmod-settings-row" }, [
    el("span", {}, [
      el("strong", {}, [title]),
      el("em", {}, [description]),
    ]),
    input,
  ]);
}

function promptContract(settings) {
  const contract = [
    "When tool results contain analytics, funnel, campaign, revenue, retention, table, or comparison data, prefer a codex-component dashboard instead of prose-only output.",
    "Use a fenced JSON block with language codex-component.",
    "Supported dashboard sections: metric_strip, insight_grid, funnel, bar_chart, table, recommendations, action_chips.",
    "For custom HTML/SVG visuals or interactive mini-tools, use a fenced show_widget JSON block with title, widget_code, and loading_messages.",
    "Use concise labels, short interpretations, and color intent: blue neutral, teal good, amber warning, red problem.",
    "For video URLs, leave the URL as a normal link; Codex Components will embed it outside tables.",
    "For links with useful context, leave the URL as a normal link; Codex Components will show an Open Graph-style card outside tables.",
    "Do not put link preview cards inside tables.",
  ].join("\n");
  return el("section", { className: "codexmod-settings-group" }, [
    el("h3", {}, ["Prompt contract"]),
    el("p", { className: "codexmod-settings-muted" }, [
      settings.autoPromptHelper
        ? "Use this as the default response contract for agents/skills that should output beautiful components."
        : "Prompt helper is off, but you can still copy this manually.",
    ]),
    el("pre", { className: "codexmod-settings-prompt" }, [contract]),
    el("div", { className: "codexmod-settings-actions" }, [
      button("Copy prompt contract", () => navigator.clipboard.writeText(contract)),
    ]),
  ]);
}

function installStyles(state) {
  const style = document.createElement("style");
  style.id = "codex-components-style";
  style.textContent = `
    .codex-components {
      --cm-bg: var(--color-background-primary, #ffffff);
      --cm-panel: var(--color-background-secondary, #f6f6f3);
      --cm-panel-2: var(--color-background-tertiary, #ecebe6);
      --cm-border: var(--color-border-tertiary, rgba(44,44,42,.14));
      --cm-text: var(--color-text-primary, #2c2c2a);
      --cm-muted: var(--color-text-secondary, #5f5e5a);
      --cm-faint: var(--color-text-tertiary, #888780);
      --cm-blue: #378add;
      --cm-teal: #1d9e75;
      --cm-red: #e24b4a;
      --cm-amber: #ba7517;
      color: var(--cm-text);
      font: 13px/1.42 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 12px 0;
    }
    @media (prefers-color-scheme: dark) {
      .codex-components {
        --cm-bg: var(--color-background-primary, #171714);
        --cm-panel: var(--color-background-secondary, #242421);
        --cm-panel-2: var(--color-background-tertiary, #2d2d29);
        --cm-border: var(--color-border-tertiary, rgba(241,239,232,.13));
        --cm-text: var(--color-text-primary, #f1efe8);
        --cm-muted: var(--color-text-secondary, #b4b2a9);
        --cm-faint: var(--color-text-tertiary, #888780);
        --cm-blue: #85b7eb;
        --cm-teal: #5dcaa5;
        --cm-red: #f09595;
        --cm-amber: #fac775;
      }
    }
    .codexmod-component {
      background: var(--cm-bg);
      border: 1px solid var(--cm-border);
      border-radius: 14px;
      overflow: hidden;
      max-width: 980px;
    }
    .codexmod-component-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 18px 10px;
      border-bottom: 1px solid var(--cm-border);
    }
    .codexmod-component-title { margin: 0; font-size: 15px; font-weight: 600; }
    .codexmod-component-subtitle { margin: 4px 0 0; color: var(--cm-muted); font-size: 12px; }
    .codexmod-component-toolbar { display: flex; gap: 6px; flex-wrap: wrap; }
    .codexmod-component-toolbar button,
    .codexmod-actions button,
    .codexmod-intake-option {
      border: 1px solid var(--cm-border);
      border-radius: 7px;
      background: var(--cm-panel);
      color: var(--cm-text);
      padding: 6px 9px;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }
    .codexmod-component-body { padding: 16px 18px 18px; display: grid; gap: 16px; }
    .codexmod-section-title {
      margin: 0 0 9px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--cm-border);
      color: var(--cm-faint);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-weight: 600;
    }
    .codexmod-metrics,
    .codexmod-insights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }
    .codexmod-metric,
    .codexmod-insight {
      background: var(--cm-panel);
      border: 1px solid rgba(241,239,232,.06);
      border-radius: 10px;
      padding: 13px;
    }
    .codexmod-label { display:block; color:var(--cm-faint); font-size:11px; text-transform:uppercase; letter-spacing:.07em; }
    .codexmod-value { display:block; margin-top:6px; font-size:24px; font-weight:600; color:var(--cm-blue); }
    .codexmod-note { display:block; margin-top:3px; color:var(--cm-muted); font-size:12px; }
    .codexmod-insight h5 { margin:0 0 7px; font-size:14px; }
    .codexmod-insight p,
    .codexmod-recommendations p,
    .codexmod-callout-section p { margin:0; color:var(--cm-muted); }
    .codexmod-bar-row {
      display: grid;
      grid-template-columns: minmax(100px, 170px) minmax(80px, 1fr) auto;
      align-items: center;
      gap: 10px;
      margin: 7px 0;
    }
    .codexmod-bar-label { color: var(--cm-muted); }
    .codexmod-bar-track { height: 9px; border-radius: 999px; background: var(--cm-panel-2); overflow: hidden; }
    .codexmod-bar-fill { display:block; height:100%; border-radius:999px; background: var(--cm-blue); }
    .codexmod-bar-value { font-size: 12px; }
    .codexmod-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .codexmod-table th, .codexmod-table td { text-align:left; padding:8px; border-bottom:1px solid var(--cm-border); }
    .codexmod-table th { color: var(--cm-faint); text-transform: uppercase; letter-spacing:.06em; font-size: 10px; }
    .codexmod-native-table-wrap {
      border: 1px solid rgba(241,239,232,.16) !important;
      border-radius: 12px !important;
      background: var(--color-background-primary, #f6f6f3) !important;
      overflow: auto !important;
      padding: 10px !important;
      margin: 14px 0 !important;
    }
    table.codexmod-native-table {
      width: 100% !important;
      border-collapse: collapse !important;
      font: 14px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      color: var(--color-text-primary, #2c2c2a) !important;
      background: transparent !important;
    }
    table.codexmod-native-table th {
      background: var(--color-background-secondary, #ecebe6) !important;
      color: var(--color-text-primary, #2c2c2a) !important;
      font-weight: 650 !important;
      text-align: left !important;
      padding: 12px 14px !important;
      border-bottom: 1px solid rgba(241,239,232,.22) !important;
    }
    table.codexmod-native-table td {
      padding: 12px 14px !important;
      border-bottom: 1px solid rgba(241,239,232,.15) !important;
      color: var(--color-text-secondary, #5f5e5a) !important;
      vertical-align: top !important;
    }
    table.codexmod-native-table tbody tr:nth-child(even) td { background: rgba(127,127,127,.055) !important; }
    .codexmod-link-card {
      display: flex;
      align-items: center;
      gap: 11px;
      max-width: 680px;
      margin: 10px 0 14px;
      padding: 11px 12px;
      border: 1px solid var(--color-border-tertiary, rgba(44,44,42,.16));
      border-radius: 12px;
      background: var(--color-background-secondary, #f6f6f3);
      color: var(--color-text-primary, #2c2c2a);
      font: 13px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .codexmod-link-card strong {
      display:block;
      font-weight:650;
      color: var(--color-text-primary, #2c2c2a);
    }
    .codexmod-link-card span,
    .codexmod-link-card a {
      color:var(--color-text-secondary, #5f5e5a);
      font-size:12px;
      text-decoration:none;
      opacity: .98;
    }
    .codexmod-link-favicon {
      display:grid;
      place-items:center;
      width:34px;
      height:34px;
      flex: 0 0 auto;
      border-radius: 9px;
      background: var(--color-background-secondary, #ecebe6);
      color: #378add;
      font-weight: 700;
    }
    .codexmod-video-card {
      display: flex;
      align-items: stretch;
      max-width: 720px;
      padding: 0;
      overflow: hidden;
    }
    .codexmod-video-thumb {
      position: relative;
      display: block;
      width: 172px;
      min-height: 96px;
      flex: 0 0 172px;
      padding: 0;
      border: 0;
      background: #111;
      cursor: pointer;
      overflow: hidden;
    }
    .codexmod-video-thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .codexmod-video-play {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: grid;
      place-items: center;
      width: 46px;
      height: 32px;
      border-radius: 9px;
      background: rgba(255,0,0,.9);
      color: #fff;
      font-size: 16px;
      line-height: 1;
      box-shadow: 0 6px 18px rgba(0,0,0,.28);
    }
    .codexmod-video-meta {
      min-width: 0;
      align-self: center;
      padding: 12px;
    }
    .codexmod-video-actions {
      display:flex;
      align-items:center;
      gap: 8px;
      margin-left: auto;
      padding: 12px;
      flex: 0 0 auto;
    }
    .codexmod-video-actions button {
      border: 1px solid var(--color-border-tertiary, rgba(44,44,42,.16));
      border-radius: 8px;
      background: var(--color-background-primary, #ffffff);
      color: var(--color-text-primary, #2c2c2a);
      padding: 5px 8px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .codexmod-video-card-loaded {
      display: block;
      padding: 0;
      overflow: hidden;
      background: #111;
    }
    .codexmod-video-framebar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: var(--color-background-secondary, #242421);
      border-bottom: 1px solid var(--color-border-tertiary, rgba(241,239,232,.16));
    }
    .codexmod-video-framebar button,
    .codexmod-video-framebar a {
      border: 1px solid var(--color-border-tertiary, rgba(241,239,232,.16));
      border-radius: 8px;
      background: var(--color-background-primary, #171714);
      color: var(--color-text-primary, #f1efe8);
      padding: 5px 8px;
      font: inherit;
      font-size: 12px;
      text-decoration: none;
      cursor: pointer;
    }
    .codexmod-video-card-loaded iframe {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
      background: #111;
    }
    .codexmod-video-card-loaded a { display:block; padding: 10px 12px; }
    .codexmod-recommendations { margin:0; padding-left: 18px; display:grid; gap:8px; }
    .codexmod-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .codexmod-intake-question { margin:0; font-size:24px; line-height:1.2; font-family: Georgia, ui-serif, serif; font-weight:500; }
    .codexmod-intake-options { display:grid; gap:10px; }
    .codexmod-intake-option { display:flex; align-items:center; gap:14px; min-height:56px; text-align:left; background:#111; }
    .codexmod-intake-option span { display:grid; place-items:center; width:34px; height:34px; border-radius:10px; background:#050505; }
    .codexmod-widget-frame { width:100%; border:0; background:transparent; display:block; }
    .codexmod-show-widget-body {
      max-width: 100%;
      margin: 12px 0;
      background: transparent;
    }
    .codexmod-show-widget-frame {
      width: 100%;
      border: 0;
      background: transparent;
      overflow: hidden;
    }
    .codexmod-widget-loading {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--color-text-tertiary, #888780);
      font: 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .codexmod-widget-loading span {
      border: 1px solid var(--color-border-tertiary, rgba(241,239,232,.14));
      border-radius: 999px;
      padding: 5px 8px;
      background: var(--color-background-secondary, rgba(127,127,127,.08));
    }
    .codexmod-error { padding: 14px; color: var(--cm-red); }
    .codexmod-settings {
      display: grid;
      gap: 16px;
      padding: 4px 0 12px;
      font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .codexmod-settings-hero,
    .codexmod-settings-group {
      border: 1px solid var(--color-border-tertiary, rgba(255,255,255,.12));
      border-radius: 12px;
      background: var(--color-background-primary, rgba(255,255,255,.035));
      padding: 16px;
    }
    .codexmod-settings-hero {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
    }
    .codexmod-settings h2 { margin: 0 0 4px; font-size: 20px; font-weight: 650; }
    .codexmod-settings h3 {
      margin: 0 0 10px;
      color: var(--color-text-tertiary, #888780);
      font-size: 11px;
      font-weight: 650;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .codexmod-settings p { margin: 0; color: var(--color-text-secondary, #b4b2a9); }
    .codexmod-settings-list { display: grid; gap: 0; }
    .codexmod-settings-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 12px 0;
      border-top: 1px solid var(--color-border-tertiary, rgba(255,255,255,.1));
      cursor: pointer;
    }
    .codexmod-settings-row:first-child { border-top: 0; }
    .codexmod-settings-row strong { display:block; font-weight: 600; color: var(--color-text-primary, #f1efe8); }
    .codexmod-settings-row em {
      display:block;
      margin-top: 3px;
      color: var(--color-text-secondary, #b4b2a9);
      font-size: 13px;
      font-style: normal;
    }
    .codexmod-settings-row input {
      width: 38px;
      height: 22px;
      accent-color: #7c3aed;
      flex: 0 0 auto;
    }
    .codexmod-settings-pill {
      border: 1px solid rgba(133,183,235,.35);
      border-radius: 999px;
      color: #85b7eb;
      padding: 3px 8px;
      font-size: 12px;
      white-space: nowrap;
    }
    .codexmod-settings-muted { margin-bottom: 10px !important; font-size: 13px; }
    .codexmod-settings-prompt {
      white-space: pre-wrap;
      margin: 0;
      padding: 12px;
      border: 1px solid var(--color-border-tertiary, rgba(255,255,255,.1));
      border-radius: 10px;
      background: var(--color-background-secondary, rgba(0,0,0,.22));
      color: var(--color-text-secondary, #b4b2a9);
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .codexmod-settings-actions { display:flex; gap: 8px; margin-top: 10px; }
    .codexmod-settings-actions button {
      border: 1px solid var(--color-border-tertiary, rgba(255,255,255,.12));
      border-radius: 8px;
      background: var(--color-background-secondary, rgba(255,255,255,.05));
      color: var(--color-text-primary, #f1efe8);
      padding: 7px 10px;
      font: inherit;
      cursor: pointer;
    }
    .codexmod-settings-compact {
      padding: 0;
      gap: 0;
    }
    @media (prefers-color-scheme: dark) {
      .codexmod-native-table-wrap,
      .codexmod-link-card {
        background: var(--color-background-secondary, #242421) !important;
        border-color: var(--color-border-tertiary, rgba(241,239,232,.18)) !important;
        color: var(--color-text-primary, #f1efe8) !important;
      }
      .codexmod-link-card strong { color: var(--color-text-primary, #f1efe8) !important; }
      .codexmod-link-card span,
      .codexmod-link-card a { color: var(--color-text-secondary, #d8d6ce) !important; }
      table.codexmod-native-table { color: var(--color-text-primary, #f1efe8) !important; }
      table.codexmod-native-table th {
        background: var(--color-background-secondary, #1b1b18) !important;
        color: var(--color-text-primary, #f1efe8) !important;
      }
      table.codexmod-native-table td { color: var(--color-text-secondary, #d8d6ce) !important; }
      .codexmod-link-favicon {
        background: var(--color-background-secondary, #11110f);
        color: #85b7eb;
      }
    }
    @media (max-width: 720px) {
      .codexmod-component-header { flex-direction: column; }
      .codexmod-bar-row { grid-template-columns: 1fr; }
      .codexmod-video-card { flex-direction: column; }
      .codexmod-video-thumb { width: 100%; flex-basis: auto; aspect-ratio: 16 / 9; }
      .codexmod-video-actions { margin-left: 0; padding-top: 0; }
    }
  `;
  document.head.appendChild(style);
  state.disposers.push(() => style.remove());
}
