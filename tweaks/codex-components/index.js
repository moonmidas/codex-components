/** @type {import("@codex-plusplus/sdk").Tweak} */
const TWEAK_BUILD = "2026-05-10-update-checks-v1";
const CURRENT_VERSION = "0.1.1";
const UPDATE_CACHE_KEY = "codexmod.components.update.v1";
const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/moonmidas/codex-components/main/tweaks/codex-components/manifest.json";
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
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

module.exports = {
  start(api) {
    const state = createState(api);
    this._state = state;
    installStyles(state);
    installRenderer(state);
    registerSettings(state);
    startUpdateChecks(state);
    state.api.log.info(`Codex Components started (${TWEAK_BUILD})`);
  },

  stop() {
    const state = this._state;
    if (!state) return;
    disposeState(state);
    this._state = null;
  },
};

if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  module.exports.__test = {
    createState,
    mountBlock,
    renderComponent,
    renderGroup,
    renderChoices,
    renderHtmlWidget,
    renderShowWidget,
    mountShowWidgetFrame,
    enhanceNativeTables,
    enhanceLinksAndMedia,
    buildWidgetDocument,
    normalizeDescriptor,
    uniqueBlocks,
    scanDocument,
    installRenderer,
    hasNearbyNativeRender,
    shouldDeferToNativeRenderer,
    loadSettings,
    isComponentLanguage,
    renderSettingsPage,
    compareVersions,
    checkForUpdates,
    updatePromptText,
    loadUpdateCache,
  };
}

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
    pageHandle: null,
    sectionHandle: null,
    pageRoot: null,
    updateCheck: loadUpdateCache(),
    updatePromise: null,
  };
}

const SETTINGS_KEY = "codexmod.components.settings.v1";

const DEFAULT_SETTINGS = Object.freeze({
  renderer: true,
  componentBlocks: false,
  dashboards: true,
  intake: true,
  htmlWidgets: true,
  mediaEmbeds: true,
  linkPreviews: true,
  tablePolish: false,
  autoPromptHelper: true,
  promptInjection: false,
  onboardingDismissed: false,
  videoPreviewMigration: 2,
});

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    settings.componentBlocks = false;
    settings.tablePolish = false;
    settings.promptInjection = false;
    if (stored.videoPreviewMigration !== 2) {
      settings.mediaEmbeds = true;
      settings.linkPreviews = true;
      settings.promptInjection = false;
      settings.videoPreviewMigration = 2;
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
  if (key === "promptInjection") value = false;
  state.settings[key] = Boolean(value);
  if (key !== "componentBlocks") state.settings.componentBlocks = false;
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

function startUpdateChecks(state) {
  checkForUpdates(state, { force: true });
  const timer = setInterval(() => checkForUpdates(state, { force: true }), UPDATE_CHECK_INTERVAL_MS);
  state.disposers.push(() => clearInterval(timer));
}

function defaultUpdateCheck() {
  return {
    status: "idle",
    installedVersion: CURRENT_VERSION,
    latestVersion: "",
    checkedAt: 0,
    error: "",
  };
}

function loadUpdateCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(UPDATE_CACHE_KEY) || "{}");
    if (!cached || typeof cached !== "object") return defaultUpdateCheck();
    return { ...defaultUpdateCheck(), ...cached, installedVersion: CURRENT_VERSION };
  } catch {
    return defaultUpdateCheck();
  }
}

function saveUpdateCache(updateCheck) {
  try {
    localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(updateCheck));
  } catch {
    // Non-critical: update checks should never break rendering.
  }
}

async function checkForUpdates(state, options = {}) {
  const force = Boolean(options.force);
  const now = Date.now();
  if (!force && state.updateCheck?.checkedAt && now - state.updateCheck.checkedAt < UPDATE_CHECK_INTERVAL_MS) {
    return state.updateCheck;
  }
  if (state.updatePromise) return state.updatePromise;

  const previous = state.updateCheck || defaultUpdateCheck();
  state.updateCheck = { ...previous, status: "checking", installedVersion: CURRENT_VERSION, error: "" };
  if (state.pageRoot) renderSettingsPage(state.pageRoot, state);

  state.updatePromise = (async () => {
    try {
      if (typeof fetch !== "function") throw new Error("Fetch is unavailable in this renderer.");
      const response = await fetch(UPDATE_MANIFEST_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const manifest = await response.json();
      const latestVersion = String(manifest?.version || "").trim();
      if (!latestVersion) throw new Error("Remote manifest did not include a version.");
      const comparison = compareVersions(latestVersion, CURRENT_VERSION);
      const next = {
        status: comparison > 0 ? "available" : "up_to_date",
        installedVersion: CURRENT_VERSION,
        latestVersion,
        checkedAt: Date.now(),
        error: "",
      };
      state.updateCheck = next;
      saveUpdateCache(next);
      return next;
    } catch (error) {
      const next = {
        ...previous,
        status: "error",
        installedVersion: CURRENT_VERSION,
        checkedAt: Date.now(),
        error: error?.message || "Unable to check for updates.",
      };
      state.updateCheck = next;
      saveUpdateCache(next);
      state.api.log.warn("Codex Components update check failed", error);
      return next;
    } finally {
      state.updatePromise = null;
      if (state.pageRoot) renderSettingsPage(state.pageRoot, state);
    }
  })();

  return state.updatePromise;
}

function compareVersions(a, b) {
  const left = parseVersionParts(a);
  const right = parseVersionParts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function parseVersionParts(version) {
  return String(version || "")
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
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
  cleanupRenderedComponents();
  cleanupVideoCards();
  cleanupPromptContractLeak();
  scheduleScan(state);
  const observer = new MutationObserver(() => scheduleScan(state));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  state.observer = observer;
  state.disposers.push(() => observer.disconnect());
  state.disposers.push(() => {
    document.querySelectorAll("[data-codexmod-component-mount]").forEach((node) => node.remove());
    document.querySelectorAll("[data-codexmod-component-source='true']").forEach((node) => {
      node.style.display = "";
      node.removeAttribute("data-codexmod-component-source");
    });
  });
  installPromptInjection(state);
}

function cleanupRenderedComponents() {
  document.querySelectorAll("[data-codexmod-component-mount]").forEach((node) => node.remove());
  document.querySelectorAll("[data-codexmod-component-source='true']").forEach((node) => {
    node.style.display = "";
    node.removeAttribute("data-codexmod-component-source");
  });
}

function cleanupPromptContractLeak() {
  document.querySelectorAll("textarea, [contenteditable='true']").forEach((composer) => {
    if (!isComposerSurface(composer)) return;
    const text = readComposer(composer);
    if (!text.includes("Codex Components prompt contract")) return;
    writeComposer(composer, stripPromptContractFromText(text));
  });
}

function scanDocument(state) {
  state.scanQueued = false;
  if (!state.settings.renderer) return;
  if (state.settings.componentBlocks) discoverAndMountBlocks(state, () => true);
  else discoverAndMountBlocks(state, isLocallyOwnedBlock);
  enhanceNativeTables(state);
  enhanceLinksAndMedia(state);
}

function discoverAndMountBlocks(state, allowBlock) {
  const blocks = [];
  const candidates = recentNodes(document.querySelectorAll("pre, code, [data-language], [class*='language-']"), 160);
  candidates.forEach((node) => {
    if (shouldSkipNode(state, node)) return;
    const text = node.textContent || "";
    if (text.length > 120000) return;
    const language = detectLanguage(node);
    if (isComponentLanguage(language)) {
      pushAllowedBlock(blocks, allowBlock, { node, language, raw: cleanRaw(text, language), hideSource: true });
      return;
    }
    if (isCandidateJsonLanguage(language)) {
      const raw = cleanRaw(text, language);
      if (looksLikeComponentJson(raw)) {
        pushAllowedBlock(blocks, allowBlock, { node, language: "codex-component", raw, hideSource: true });
        return;
      }
    }
    for (const block of blocksFromText(state, node, text, true)) {
      pushAllowedBlock(blocks, allowBlock, block);
    }
  });
  collectTextFenceBlocks(state, blocks, allowBlock);
  uniqueBlocks(blocks).slice(0, 24).forEach((block) => mountBlock(state, block));
}

function pushAllowedBlock(blocks, allowBlock, block) {
  if (allowBlock(block)) blocks.push(block);
}

function isLocallyOwnedBlock(block) {
  const language = String(block.language || "").trim();
  const result = normalizeDescriptor(block.raw, language);
  if (!result.ok) return isIncompleteComponentJson(block.raw, result.error);
  return COMPONENT_TYPE_SET.has(result.descriptor.type);
}

function uniqueBlocks(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    const key = `${block.language || ""}\n${String(block.raw || "").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    || isComposerSurface(node)
    || node.dataset?.codexmodComponentSource === "true";
}

function isComposerSurface(node) {
  return Boolean(node?.closest?.([
    "textarea",
    "[contenteditable='true']",
    "form",
    "footer",
    "[role='textbox']",
    "[data-testid*='composer' i]",
    "[class*='composer' i]",
    "[aria-label*='message' i]",
    "[aria-label*='prompt' i]",
  ].join(",")));
}

function collectTextFenceBlocks(state, blocks, allowBlock = () => true) {
  const root = document.querySelector("main") || document.body;
  if (!root || (root.textContent || "").length > 350000) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new WeakSet(blocks.map((block) => block.node));
  let checked = 0;
  let textNode = walker.nextNode();
  while (textNode && checked < 800) {
    checked += 1;
    const text = textNode.textContent || "";
    if (text.includes("```codex-component")) {
      const source = nearestRenderableSource(textNode);
      if (source && !isComposerSurface(source) && !seen.has(source) && !shouldSkipNode(state, source)) {
        for (const block of blocksFromText(state, source, source.textContent || text, shouldHideSource(source))) {
          pushAllowedBlock(blocks, allowBlock, block);
        }
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
  return String(language || "").trim() === "codex-component";
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
      && COMPONENT_TYPE_SET.has(descriptor.type)
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
  if (typeof descriptor.type !== "string" || !descriptor.type.trim()) {
    return { ok: false, error: "Component descriptor requires a type." };
  }
  if (typeof descriptor.version !== "number") {
    return { ok: false, error: "Component descriptor requires a numeric version." };
  }
  descriptor.type = descriptor.type.trim();
  if (!COMPONENT_TYPE_SET.has(descriptor.type)) {
    return { ok: false, error: `Unknown component type: ${descriptor.type}` };
  }
  return { ok: true, descriptor };
}

function mountBlock(state, block) {
  const sourceNode = block.hideSource ? findCodeBlockShell(block.node, block.raw, block.language) : block.node;
  if (state.mounted.has(block.node) || state.mounted.has(sourceNode)) return;
  const result = normalizeDescriptor(block.raw, block.language);
  if (!result.ok && isIncompleteComponentJson(block.raw, result.error)) return;
  if (!result.ok) {
    state.mounted.add(block.node);
    state.mounted.add(sourceNode);
    sourceNode.dataset.codexmodComponentSource = "true";
    if (block.hideSource) sourceNode.style.display = "none";
    const mount = document.createElement("div");
    mount.className = "codex-components";
    mount.dataset.codexmodComponentMount = "true";
    sourceNode.after(mount);
    renderError(mount, result.error, block.raw);
    return;
  }
  const descriptor = result.descriptor;
  if (hasNearbyNativeRender(sourceNode, descriptor.type)) {
    state.mounted.add(block.node);
    state.mounted.add(sourceNode);
    return;
  }
  state.mounted.add(block.node);
  state.mounted.add(sourceNode);
  sourceNode.dataset.codexmodComponentSource = "true";
  if (block.hideSource) sourceNode.style.display = "none";
  const mount = document.createElement("div");
  mount.className = "codex-components";
  mount.dataset.codexmodComponentMount = "true";
  sourceNode.after(mount);

  if (shouldDeferToNativeRenderer(descriptor)) {
    sourceNode.style.display = "";
    mount.remove();
    return;
  }
  try {
    if (canRenderComponent(state, descriptor)) renderComponent(mount, descriptor, block.raw, state);
    else {
      sourceNode.style.display = "";
      mount.remove();
    }
  } catch (error) {
    renderError(mount, error.message || String(error), block.raw);
  }
}

function canRenderComponent(state, descriptor) {
  return COMPONENT_TYPE_SET.has(descriptor.type);
}

function shouldDeferToNativeRenderer(descriptor) {
  return false;
}

function isIncompleteComponentJson(raw, error) {
  const text = String(raw || "").trim();
  if (!text) return true;
  if (/Unexpected end of JSON input|Unterminated string/i.test(String(error || ""))) return true;
  const opens = (text.match(/[\[{]/g) || []).length;
  const closes = (text.match(/[\]}]/g) || []).length;
  return opens > closes;
}

function hasNearbyNativeRender(sourceNode, expectedType = "") {
  const normalizedType = normalizeComponentType(expectedType);
  const ownMount = (node) => node?.matches?.("[data-codexmod-component-mount], .codex-components");
  const nativeSurface = (node, requireType = false) => {
    if (!node || ownMount(node)) return false;
    if (node === sourceNode || node.contains?.(sourceNode) || sourceNode.contains?.(node)) return false;
    if (node.matches?.("pre, code, script, style")) return false;
    const text = (node.textContent || "").trim();
    if (!text || text.startsWith("```")) return false;
    const className = String(node.className || "").toLowerCase();
    const role = String(node.getAttribute?.("role") || "").toLowerCase();
    const data = Object.entries(node.dataset || {}).map(([key, value]) => `${key}:${value}`).join(" ").toLowerCase();
    if (requireType && normalizedType && !surfaceMatchesComponentType(node, normalizedType, `${className} ${data}`)) return false;
    const looksComponentish =
      /component|widget|artifact|intake|dashboard/.test(className)
      || /component|widget|artifact|intake|dashboard/.test(data)
      || ["region", "group"].includes(role);
    const looksLikeCard =
      node.querySelector?.("button, iframe, table, h1, h2, h3, h4, strong")
      && node.getBoundingClientRect?.().height !== 0;
    return Boolean(looksComponentish || looksLikeCard);
  };

  const candidates = [
    sourceNode.previousElementSibling,
    sourceNode.nextElementSibling,
    sourceNode.parentElement?.previousElementSibling,
    sourceNode.parentElement?.nextElementSibling,
  ];
  if (candidates.some((node) => nativeSurface(node, true))) return true;

  const message = sourceNode.closest?.("[data-message-author-role], article, [role='article']");
  if (!message) return false;
  return Array.from(message.querySelectorAll("section, div, article, [role='group'], [role='region']"))
    .some((node) => nativeSurface(node, true));
}

function normalizeComponentType(type) {
  const normalized = String(type || "").toLowerCase().replace(/-/g, "_");
  if (normalized === "html_widget") return "widget";
  if (normalized === "show_widget") return "widget";
  return normalized;
}

function surfaceMatchesComponentType(node, normalizedType, searchableText) {
  if (normalizedType === "widget") return /widget|html_widget|show_widget/.test(searchableText) || Boolean(node.querySelector?.("iframe"));
  return new RegExp(`(^|[^a-z])${escapeRegExp(normalizedType)}([^a-z]|$)`).test(searchableText);
}

function findCodeBlockShell(node, raw, language) {
  let current = node;
  let shell = node;
  const rawStart = String(raw || "").trim().slice(0, 40);
  for (let i = 0; i < 8 && current?.parentElement; i += 1) {
    const parent = current.parentElement;
    const text = parent.textContent || "";
    const parentHasOwnLanguage = isComponentLanguage(detectLanguage(parent));
    const parentIsCodeElement = parent.matches?.("pre, code");
    const hasOwnChrome = hasOwnCodeBlockChrome(parent, rawStart, language);
    const structuralWrapper = hasOnlyTargetCodeBlock(parent, node);
    const looksLikeCodeShell =
      text.includes(rawStart)
      && (parentIsCodeElement || parentHasOwnLanguage || hasOwnChrome || structuralWrapper);
    const tooBroad =
      parent.matches?.("article, [data-message-author-role], main, body")
      || parent.querySelectorAll?.("pre").length > 1
      || parent.querySelectorAll?.("[data-codexmod-component-mount]").length > 0
      || (parent.parentElement?.matches?.("article, [data-message-author-role], [role='article']") && !hasOwnChrome && !parentHasOwnLanguage && !parentIsCodeElement);
    if (looksLikeCodeShell && !tooBroad) {
      shell = parent;
      current = parent;
      if (hasOwnChrome && !parentIsCodeElement) break;
    }
    else break;
  }
  return shell;
}

function hasOnlyTargetCodeBlock(parent, node) {
  const pres = Array.from(parent.querySelectorAll?.("pre") || []);
  if (pres.length) return pres.length === 1 && pres[0].contains(node);
  const codes = Array.from(parent.querySelectorAll?.("code") || []);
  return codes.length === 1 && codes[0].contains(node);
}

function hasOwnCodeBlockChrome(parent, rawStart, language) {
  const labels = [
    language,
    "json",
    "codex",
    "codex-component",
  ].filter(Boolean).map((label) => String(label).toLowerCase());
  return Array.from(parent.children || []).some((child) => {
    const text = (child.textContent || "").trim();
    if (!text || text.includes(rawStart)) return false;
    if (child.matches?.("button, [aria-label*='opy' i], [title*='opy' i]")) return true;
    if (child.querySelector?.("button, [aria-label*='opy' i], [title*='opy' i]")) return true;
    const normalized = text.toLowerCase();
    return text.length <= 80 && labels.some((label) => normalized === label || normalized.includes(label));
  });
}

function escapeRegExp(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const copy = button("Copy", () => copyText(raw || JSON.stringify(descriptor, null, 2), state));
  copy.setAttribute("aria-label", "Copy component JSON");
  copy.setAttribute("title", "Copy component JSON");
  bar.append(copy);
  return bar;
}

function renderDashboard(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-dashboard");
  for (const section of descriptor.sections || []) {
    if (section.type === "metric_strip") renderMetricStrip(body, section);
    else if (section.type === "insight_grid") renderInsightGrid(body, section);
    else if (section.type === "funnel" || section.type === "bar_chart") renderBars(body, section);
    else if (section.type === "progress_bars") renderProgressBars(body, section);
    else if (section.type === "numbered_callouts") renderNumberedCallouts(body, section);
    else if (section.type === "record_cards") renderRecordCards(body, section);
    else if (section.type === "alert_blocks") renderAlertBlocks(body, section);
    else if (section.type === "comparison_cards") renderComparisonCards(body, section);
    else if (section.type === "timeline") renderTimeline(body, section);
    else if (section.type === "pull_quote") renderPullQuote(body, section);
    else if (section.type === "tag_cloud") renderTagCloud(body, section);
    else if (section.type === "table") renderTable(body, section);
    else if (section.type === "recommendations") renderRecommendations(body, section);
    else if (section.type === "action_chips") renderActions(body, section);
    else renderCallout(body, section);
  }
}

function renderComponent(target, descriptor, raw, state, options = {}) {
  if (descriptor.type === "group") return renderGroup(target, descriptor, raw, state, options);
  if (descriptor.type === "choices") return renderChoices(target, descriptor, raw, state, options);
  return renderLeafComponent(target, descriptor, raw, state, options);
}

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
  else renderCallout(body, { body: `Unsupported component: ${descriptor.type}` });
}

function renderGroup(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-group");
  const components = Array.isArray(descriptor.components) ? descriptor.components : [];
  if (!components.length) {
    renderCallout(body, { body: "No components provided." });
    return;
  }

  for (const child of components) {
    const childMount = el("div", { className: "codexmod-group-child" });
    const childRaw = JSON.stringify(child, null, 2);
    body.append(childMount);
    const result = normalizeDescriptor(childRaw, "codex-component");
    if (!result.ok) {
      renderError(childMount, result.error, childRaw);
      continue;
    }
    renderComponent(childMount, result.descriptor, childRaw, state);
  }
}

function renderMetricStrip(body, section) {
  const wrap = sectionWrap(section, "codexmod-metrics-section");
  const grid = el("div", { className: "codexmod-metrics" });
  for (const item of section.items || section.metrics || []) {
    grid.append(el("article", { className: `codexmod-metric ${toneClass(item.tone || item.color)}` }, [
      el("span", { className: "codexmod-label" }, [item.label || item.name || "Metric"]),
      el("strong", { className: "codexmod-value" }, [String(item.value ?? "")]),
      item.sparkline ? renderSparkline(item.sparkline, item.tone || item.color) : null,
      item.delta ? el("span", { className: "codexmod-note" }, [trendIcon(item.trend || item.status), item.delta]) : null,
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
    wrap.append(el("div", { className: `codexmod-bar-row ${toneClass(item.tone || item.color)}` }, [
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

function renderProgressBars(body, section) {
  const items = section.items || [];
  const wrap = sectionWrap(section, "codexmod-progress-section");
  for (const item of items) {
    const value = Math.max(0, Math.min(100, Number(item.percent ?? item.value) || 0));
    wrap.append(el("div", { className: `codexmod-progress ${toneClass(item.tone || item.color)}` }, [
      el("div", { className: "codexmod-progress-head" }, [
        el("span", {}, [item.label || item.name || "Progress"]),
        el("strong", {}, [`${value}%`]),
      ]),
      el("span", { className: "codexmod-progress-track" }, [
        el("span", { className: "codexmod-progress-fill", style: `width:${value}%` }),
      ]),
      item.body ? el("p", {}, [item.body]) : null,
    ]));
  }
  body.append(wrap);
}

function renderNumberedCallouts(body, section) {
  const wrap = sectionWrap(section, "codexmod-numbered-section");
  for (const [index, item] of (section.items || []).entries()) {
    wrap.append(el("article", { className: `codexmod-numbered ${toneClass(item.tone || item.color || item.status)}` }, [
      el("div", { className: "codexmod-numbered-head" }, [
        el("span", { className: "codexmod-rank" }, [`#${item.rank || index + 1}`]),
        el("strong", { className: "codexmod-numbered-value" }, [String(item.value ?? item.metric ?? "")]),
        el("h5", {}, [item.title || item.label || "Finding"]),
      ]),
      item.body ? el("p", {}, [item.body]) : null,
      item.recommendation ? el("div", { className: "codexmod-recommendation-box" }, [item.icon || "Lightbulb", " ", item.recommendation]) : null,
    ]));
  }
  body.append(wrap);
}

function renderRecordCards(body, section) {
  const wrap = sectionWrap(section, "codexmod-records-section");
  const grid = el("div", { className: "codexmod-records" });
  for (const record of section.items || section.records || []) {
    grid.append(el("article", { className: `codexmod-record ${toneClass(record.tone || record.status)}` }, [
      el("div", { className: "codexmod-record-head" }, [
        el("span", { className: "codexmod-avatar" }, [record.avatar || initials(record.title || record.name || "?")]),
        el("div", {}, [
          el("h5", {}, [record.title || record.name || "Record"]),
          record.subtitle ? el("p", {}, [record.subtitle]) : null,
        ]),
      ]),
      el("div", { className: "codexmod-record-fields" }, (record.fields || []).map((field) =>
        el("div", {}, [el("span", {}, [field.label || field.key || "Field"]), el("strong", {}, [field.value ?? ""])]),
      )),
      record.pills ? el("div", { className: "codexmod-pills" }, record.pills.map((pill) =>
        el("span", { className: `codexmod-pill ${toneClass(pill.tone || pill.color)}` }, [pill.label || pill]),
      )) : null,
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

function renderComparisonCards(body, section) {
  const wrap = sectionWrap(section, "codexmod-comparison-section");
  const grid = el("div", { className: "codexmod-comparisons" });
  for (const item of section.items || section.cards || []) {
    grid.append(el("article", { className: `codexmod-comparison ${toneClass(item.tone || item.color)} ${item.featured || item.popular ? "is-featured" : ""}` }, [
      item.badge ? el("span", { className: `codexmod-pill ${toneClass(item.tone || item.color)}` }, [item.badge]) : null,
      el("h5", {}, [item.title || item.label || "Option"]),
      item.price || item.value ? el("strong", { className: "codexmod-comparison-value" }, [item.price || item.value]) : null,
      item.body ? el("p", {}, [item.body]) : null,
      item.features ? el("ul", {}, item.features.map((feature) => el("li", {}, [feature]))) : null,
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

function renderTimeline(body, section) {
  const wrap = sectionWrap(section, "codexmod-timeline-section");
  const list = el("ol", { className: "codexmod-timeline" });
  for (const item of section.items || section.steps || []) {
    list.append(el("li", { className: `codexmod-timeline-item ${toneClass(item.tone || item.status)}` }, [
      el("span", { className: "codexmod-timeline-dot" }, [timelineIcon(item.status || item.tone)]),
      el("div", {}, [
        el("strong", {}, [item.title || item.label || "Step"]),
        item.body ? el("p", {}, [item.body]) : null,
        item.meta ? el("span", { className: "codexmod-timeline-meta" }, [item.meta]) : null,
      ]),
    ]));
  }
  wrap.append(list);
  body.append(wrap);
}

function renderPullQuote(body, section) {
  const wrap = sectionWrap(section, "codexmod-pullquote-section");
  wrap.append(el("blockquote", { className: `codexmod-pullquote ${toneClass(section.tone || section.color)}` }, [
    el("p", {}, [section.quote || section.body || section.text || ""]),
    section.source ? el("cite", {}, [section.source]) : null,
  ]));
  body.append(wrap);
}

function renderTagCloud(body, section) {
  const wrap = sectionWrap(section, "codexmod-tags-section");
  wrap.append(el("div", { className: "codexmod-tag-cloud" }, (section.items || section.tags || []).map((tag) =>
    el("span", { className: `codexmod-pill ${toneClass(tag.tone || tag.color)}` }, [tag.label || tag]),
  )));
  body.append(wrap);
}

function renderAlertBlocks(body, section) {
  const wrap = sectionWrap(section, "codexmod-alerts-section");
  for (const item of section.items || section.alerts || []) {
    wrap.append(el("article", { className: `codexmod-alert ${toneClass(item.tone || item.status || item.color)}` }, [
      el("span", { className: "codexmod-alert-icon" }, [item.icon || alertIcon(item.tone || item.status)]),
      el("div", {}, [
        el("strong", {}, [item.title || item.label || "Note"]),
        item.body ? el("p", {}, [item.body]) : null,
      ]),
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

function renderSparkline(values, tone) {
  const nums = Array.isArray(values) ? values.map(Number).filter((value) => Number.isFinite(value)) : [];
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const points = nums.map((value, index) => {
    const x = (index / (nums.length - 1)) * 100;
    const y = 28 - ((value - min) / range) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return el("svg", { className: `codexmod-sparkline ${toneClass(tone)}`, viewBox: "0 0 100 32", role: "img" }, [
    el("polyline", { points, fill: "none", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round" }),
  ]);
}

function renderCallout(body, section) {
  const wrap = sectionWrap(section, "codexmod-callout-section");
  wrap.append(el("p", {}, [section.body || section.text || section.markdown || `Unsupported section: ${section.type || "unknown"}`]));
  body.append(wrap);
}

function toneClass(tone) {
  const normalized = String(tone || "").toLowerCase();
  if (["teal", "success", "green", "good", "up"].includes(normalized)) return "tone-teal";
  if (["amber", "warning", "caution", "medium"].includes(normalized)) return "tone-amber";
  if (["red", "danger", "bad", "down", "critical"].includes(normalized)) return "tone-red";
  if (["coral"].includes(normalized)) return "tone-coral";
  if (["pink"].includes(normalized)) return "tone-pink";
  if (["purple"].includes(normalized)) return "tone-purple";
  if (["green"].includes(normalized)) return "tone-green";
  if (["gray", "grey", "neutral"].includes(normalized)) return "tone-gray";
  return "tone-blue";
}

function trendIcon(trend) {
  const normalized = String(trend || "").toLowerCase();
  if (["up", "increase", "good"].includes(normalized)) return "↗ ";
  if (["down", "decrease", "bad"].includes(normalized)) return "↘ ";
  if (["warning", "caution"].includes(normalized)) return "⚠ ";
  return "";
}

function timelineIcon(status) {
  const normalized = String(status || "").toLowerCase();
  if (["complete", "completed", "success", "done", "green", "teal"].includes(normalized)) return "✓";
  if (["warning", "blocked", "caution", "amber"].includes(normalized)) return "!";
  return "";
}

function alertIcon(tone) {
  const normalized = String(tone || "").toLowerCase();
  if (["success", "good", "teal", "green"].includes(normalized)) return "✓";
  if (["danger", "bad", "red", "critical"].includes(normalized)) return "!";
  if (["warning", "amber", "caution"].includes(normalized)) return "!";
  return "i";
}

function initials(text) {
  return String(text || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderIntake(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-intake");
  const question = String(descriptor.question || "").trim();
  const title = String(descriptor.title || "").trim();
  if (question && question !== title) {
    body.append(el("h2", { className: "codexmod-intake-question" }, [question]));
  }
  body.append(el("div", { className: "codexmod-intake-options" }, (descriptor.options || []).map((option, index) =>
    el("button", { type: "button", className: "codexmod-intake-option", onclick: () => insertPrompt(option.prompt || option.label || "") }, [
      el("span", {}, [String(index + 1)]),
      el("div", { className: "codexmod-intake-option-copy" }, [
        el("strong", {}, [option.label || option.title || `Option ${index + 1}`]),
        option.description ? el("small", {}, [option.description]) : null,
      ]),
    ]),
  )));
}

function renderChoices(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-choices");
  const options = Array.isArray(descriptor.options) ? descriptor.options : [];
  body.append(el("div", { className: "codexmod-choices-options" }, options.map((option, index) =>
    el("button", { type: "button", className: "codexmod-choices-option", onclick: () => insertPrompt(option.prompt || option.label || "") }, [
      el("span", {}, [String(index + 1)]),
      el("div", { className: "codexmod-choices-option-copy" }, [
        el("strong", {}, [option.label || option.title || `Option ${index + 1}`]),
        option.description || option.body ? el("small", {}, [option.description || option.body]) : null,
      ]),
    ]),
  )));
}

function renderHtmlWidget(target, descriptor, raw, state) {
  const body = renderShell(target, descriptor, raw, state, "codexmod-widget");
  const frame = document.createElement("iframe");
  const bounds = widgetFrameBounds(descriptor, 360);
  frame.className = "codexmod-widget-frame";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("scrolling", "yes");
  frame.srcdoc = descriptor.html || descriptor.content || "";
  mountWidgetScrollbox(body, frame, bounds, state);
  attachFrameInteractionGuard(body, frame);
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.method === "ui/notifications/size-changed" && data.params?.height) {
      applyWidgetFrameHeight(frame, bounds, data.params.height);
    } else if (data.method === "codex/scroll-parent" && data.params?.deltaY) {
      scrollNearestContainer(frame, Number(data.params.deltaY) || 0);
    }
  };
  window.addEventListener("message", onMessage);
  state.disposers.push(() => window.removeEventListener("message", onMessage));
}

function renderShowWidget(target, descriptor, raw, state) {
  target.innerHTML = "";
  const body = el("section", { className: "codexmod-show-widget-body" });
  target.append(body);
  mountShowWidgetFrame(body, descriptor, state);
}

function mountShowWidgetFrame(body, descriptor, state) {
  body.innerHTML = "";
  const frame = document.createElement("iframe");
  const bounds = widgetFrameBounds(descriptor, 520);
  frame.className = "codexmod-widget-frame codexmod-show-widget-frame";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("scrolling", "yes");
  frame.srcdoc = buildWidgetDocument(descriptor.widget_code || descriptor.html || descriptor.content || "");
  mountWidgetScrollbox(body, frame, bounds, state);
  attachFrameInteractionGuard(body, frame);
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.method === "ui/notifications/size-changed" && data.params?.height) {
      applyWidgetFrameHeight(frame, bounds, data.params.height);
    } else if (data.method === "codex/send-prompt" && data.params?.text) {
      insertPrompt(String(data.params.text));
    } else if (data.method === "codex/open-link" && data.params?.url) {
      window.open(String(data.params.url), "_blank", "noopener,noreferrer");
    } else if (data.method === "codex/scroll-parent" && data.params?.deltaY) {
      scrollNearestContainer(frame, Number(data.params.deltaY) || 0);
    }
  };
  window.addEventListener("message", onMessage);
  state.disposers.push(() => window.removeEventListener("message", onMessage));
}

function mountWidgetScrollbox(body, frame, bounds, state) {
  const scrollbox = el("div", { className: "codexmod-widget-scrollbox" });
  scrollbox.style.height = `${bounds.initial}px`;
  scrollbox.style.overflowY = "auto";
  scrollbox.style.overflowX = "hidden";
  scrollbox.style.overscrollBehavior = "contain";
  frame.style.height = `${bounds.initial}px`;
  scrollbox.append(frame);
  body.append(scrollbox);
  installWidgetScrollAssist(scrollbox, frame, state);
  return scrollbox;
}

function installWidgetScrollAssist(scrollbox, frame, state) {
  const onWheel = (event) => {
    if (frame.dataset.codexmodInteraction === "on") return;
    scrollWidgetFrame(scrollbox, event);
  };
  const onDocumentWheel = (event) => {
    if (frame.dataset.codexmodInteraction === "on") return;
    if (!isPointerInside(event, scrollbox)) return;
    scrollWidgetFrame(scrollbox, event);
  };
  scrollbox.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("wheel", onDocumentWheel, { passive: false, capture: true });
  state?.disposers?.push?.(() => {
    scrollbox.removeEventListener("wheel", onWheel);
    document.removeEventListener("wheel", onDocumentWheel, { capture: true });
  });
}

function scrollWidgetFrame(scrollbox, event) {
  if (!scrollElementBy(scrollbox, Number(event.deltaY) || 0)) return false;
  event.preventDefault?.();
  event.stopPropagation?.();
  return true;
}

function isPointerInside(event, node) {
  const rect = node.getBoundingClientRect?.();
  if (!rect) return false;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function widgetFrameBounds(descriptor, fallbackHeight) {
  const requested = positiveNumber(descriptor.height) || fallbackHeight;
  const explicitMax = positiveNumber(descriptor.max_height);
  const max = explicitMax || Math.min(Math.max(requested, 360), 720);
  const min = Math.min(requested, max);
  return { initial: min, min, max };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function applyWidgetFrameHeight(frame, bounds, measuredHeight) {
  const measured = positiveNumber(measuredHeight);
  const contentHeight = Math.max(bounds.min, measured || bounds.min);
  const viewportHeight = Math.min(bounds.max, contentHeight);
  const scrollbox = frame.closest?.(".codexmod-widget-scrollbox");
  frame.style.height = `${contentHeight}px`;
  if (scrollbox) {
    scrollbox.style.height = `${viewportHeight}px`;
    scrollbox.classList.toggle("codexmod-widget-scrollbox-scrollable", contentHeight > bounds.max);
  } else {
    frame.style.height = `${viewportHeight}px`;
    frame.classList.toggle("codexmod-widget-frame-scrollable", contentHeight > bounds.max);
  }
}

function scrollNearestContainer(node, deltaY) {
  if (!deltaY) return;
  for (let current = node?.parentElement; current; current = current.parentElement) {
    if (isScrollableContainer(current) && scrollElementBy(current, deltaY)) return;
  }
  const scroller = document.scrollingElement || document.documentElement;
  if (!scrollElementBy(scroller, deltaY)) scroller.scrollTop += deltaY;
}

function isScrollableContainer(node) {
  if (!node) return false;
  if (node.classList?.contains("codexmod-widget-scrollbox")) return node.scrollHeight > node.clientHeight;
  const style = getComputedStyle(node);
  return /(auto|scroll|overlay)/.test(style.overflowY || "") && node.scrollHeight > node.clientHeight;
}

function scrollElementBy(node, deltaY) {
  if (!node || !deltaY) return false;
  const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
  if (maxScroll <= 1) return false;
  const current = node.scrollTop || 0;
  const next = Math.min(maxScroll, Math.max(0, current + deltaY));
  if (next === current) return false;
  node.scrollTop = next;
  return true;
}

function attachFrameInteractionGuard(container, frame, label = "Scroll-safe mode") {
  if (!container || frame.dataset.codexmodInteraction) return;
  frame.dataset.codexmodInteraction = "off";
  frame.style.pointerEvents = "none";
  const toggle = button("Enable interaction", () => {
    const active = frame.dataset.codexmodInteraction === "on";
    frame.dataset.codexmodInteraction = active ? "off" : "on";
    frame.style.pointerEvents = active ? "none" : "auto";
    toggle.textContent = active ? "Enable interaction" : "Disable interaction";
  });
  const guard = el("div", { className: "codexmod-widget-guard" }, [
    el("span", {}, [label]),
    toggle,
  ]);
  const anchor = frame.closest?.(".codexmod-widget-scrollbox") || frame;
  container.insertBefore(guard, anchor);
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
  window.addEventListener("wheel", (event) => {
    const deltaY = Number(event.deltaY) || 0;
    if (!deltaY) return;
    event.preventDefault();
    parent.postMessage({ method: "codex/scroll-parent", params: { deltaY } }, "*");
  }, { passive: false });
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(notifySize).observe(document.body);
  } else {
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      notifySize();
      if (ticks >= 12) clearInterval(timer);
    }, 250);
  }
  window.addEventListener("load", notifySize);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(notifySize);
  else setTimeout(notifySize, 0);
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
  cleanupVideoCards();
  document.querySelectorAll("a[href]").forEach((link) => {
    if (
      state.enhancedLinks.has(link)
      || link.dataset?.codexmodLinkEnhanced === "true"
      || link.closest?.(".codex-components, .codexmod-settings, .codexmod-link-card, table")
      || isComposerSurface(link)
    ) return;
    const href = link.href;
    const youtube = parseYouTubeUrl(href);
    if (youtube && state.settings.mediaEmbeds) {
      insertAfterLink(link, renderYouTubeEmbed(youtube, href, link.textContent || href), { hideStandaloneLink: true });
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
Use dashboard sections before custom HTML: metric_strip, insight_grid, funnel, bar_chart, progress_bars, timeline, table, recommendations, action_chips.
Use show_widget only for compact diagrams, charts, mockups, art, or interactive mini-tools that cannot be expressed as dashboard sections.
Do not use show_widget for long lists, repeated rows, tables, record grids, or nested card layouts; use dashboard table, timeline, record_cards, or insight_grid instead.
If show_widget is necessary, keep it bounded, transparent, and mostly non-scrolling; avoid custom overflow containers, position:fixed, and giant repeated row markup.
Keep labels short, include one-line interpretation, and use semantic signal colors only.
Leave YouTube/video URLs and normal URLs as plain links outside tables so Codex Components can render video previews/link cards.
Do not place link preview cards inside tables.
-->`;
}

function insertAfterLink(link, node, options = {}) {
  const paragraph = link.closest("p, li, div") || link;
  if (paragraph.nextElementSibling?.dataset?.codexmodLinkPreview === "true") {
    if (options.hideStandaloneLink) hideStandaloneLinkBlock(link, paragraph);
    return;
  }
  link.dataset.codexmodLinkEnhanced = "true";
  node.dataset.codexmodLinkPreview = "true";
  paragraph.after(node);
  if (options.hideStandaloneLink) hideStandaloneLinkBlock(link, paragraph);
}

function cleanupVideoCards() {
  document.querySelectorAll(".codexmod-video-card").forEach((card) => {
    const link = findAssociatedYouTubeLink(card);
    if (link) hideStandaloneLinkBlock(link);
    if (isCurrentVideoCard(card)) return;
    if (!link) return;
    const videoId = parseYouTubeUrl(link.href);
    if (!videoId) return;
    const replacement = renderYouTubeEmbed(videoId, link.href, link.textContent || link.href);
    replacement.dataset.codexmodLinkPreview = "true";
    link.dataset.codexmodLinkEnhanced = "true";
    card.replaceWith(replacement);
    hideStandaloneLinkBlock(link);
  });
}

function isCurrentVideoCard(card) {
  const hasCurrentSurface = card.querySelector?.(".codexmod-video-surface.codexmod-video-thumb");
  const hasLegacyChrome =
    card.querySelector?.(".codexmod-video-actions, .codexmod-video-framebar, .codexmod-video-meta")
    || /\b(Hide video|Open on YouTube)\b/i.test(card.textContent || "");
  return Boolean(hasCurrentSurface && !hasLegacyChrome);
}

function findAssociatedYouTubeLink(card) {
  const candidates = [];
  for (let node = card.previousElementSibling, hops = 0; node && hops < 4; node = node.previousElementSibling, hops += 1) {
    candidates.push(...Array.from(node.querySelectorAll?.("a[href]") || []));
    if (node.matches?.("a[href]")) candidates.push(node);
  }
  candidates.push(...Array.from(card.querySelectorAll?.("a[href]") || []));
  return candidates.find((link) => parseYouTubeUrl(link.href));
}

function hideStandaloneLinkBlock(link, block = link.closest("p, li, div")) {
  if (!isStandaloneLinkBlock(link, block)) return false;
  block.dataset.codexmodLinkSource = "youtube";
  block.style.display = "none";
  return true;
}

function isStandaloneLinkBlock(link, block) {
  if (!block || block === link) return false;
  const links = Array.from(block.querySelectorAll?.("a[href]") || []);
  if (links.length !== 1 || links[0] !== link) return false;
  const clone = block.cloneNode(true);
  clone.querySelector?.("a[href]")?.remove();
  return !(clone.textContent || "").trim();
}

function parseYouTubeUrl(href) {
  try {
    const url = new URL(href);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") || url.pathname.startsWith("/live/")) return url.pathname.split("/")[2];
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

function renderYouTubeEmbed(videoId, href, label) {
  const safeId = encodeURIComponent(videoId);
  const url = new URL(href);
  const title = cleanLinkLabel(label, url);
  const host = url.hostname.replace(/^www\./, "");
  const card = el("section", { className: "codexmod-link-card codexmod-video-card" });
  renderYouTubePreview(card, safeId, href, title, host);
  return card;
}

function renderYouTubePreview(card, safeId, href, title, host) {
  card.className = "codexmod-link-card codexmod-video-card codexmod-video-card-preview";
  card.innerHTML = "";
  card.append(
    el("a", {
      className: "codexmod-video-surface codexmod-video-thumb",
      href,
      target: "_blank",
      rel: "noreferrer",
      "aria-label": `Open YouTube video: ${title}`,
    }, [
      el("img", {
        src: `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg`,
        alt: "YouTube video thumbnail",
        loading: "lazy",
      }),
      el("span", { className: "codexmod-video-play", "aria-hidden": "true" }, ["▶"]),
    ]),
    el("div", { className: "codexmod-video-overlay" }, [
      el("a", { className: "codexmod-video-title", href, target: "_blank", rel: "noreferrer" }, [title]),
      el("span", { className: "codexmod-video-domain" }, [host]),
    ]),
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
    settings.onboardingDismissed ? null : onboardingPanel(state),
    updatePanel(state),
    settingsGroup("Rendering", [
      toggleRow(state, "renderer", "Enable renderer", "Render component blocks in chat."),
      toggleRow(state, "componentBlocks", "Legacy block renderer", "Only enable this if native Codex component rendering is unavailable."),
      toggleRow(state, "dashboards", "Dashboards", "Legacy dashboard renderer when block rendering is enabled."),
      toggleRow(state, "intake", "Guided intake cards", "Legacy intake renderer when block rendering is enabled."),
      toggleRow(state, "htmlWidgets", "Sandboxed HTML widgets", "Legacy widget renderer when block rendering is enabled."),
    ]),
    settingsGroup("Automatic polish", [
      toggleRow(state, "tablePolish", "Polish normal tables", "Restyle Markdown/tool tables so they read closer to Claude Cowork."),
      toggleRow(state, "mediaEmbeds", "Preview video links", "Turn YouTube links into native preview cards outside tables."),
      toggleRow(state, "linkPreviews", "Open Graph-style link cards", "Show clean link cards outside tables without touching tabular data."),
      toggleRow(state, "autoPromptHelper", "Prompt helper", "Keep a copyable instruction contract for model responses that should become components."),
    ]),
    promptContract(settings),
  ]));
}

function onboardingPanel(state) {
  return el("section", { className: "codexmod-settings-group codexmod-onboarding" }, [
    el("div", { className: "codexmod-settings-group-head" }, [
      el("div", {}, [
        el("h3", {}, ["Start Here"]),
        el("p", { className: "codexmod-settings-muted" }, ["Codex Components is installed. These defaults keep rich output useful without taking over the transcript."]),
      ]),
      button("Got it", () => dismissOnboarding(state)),
    ]),
    el("div", { className: "codexmod-onboarding-grid" }, [
      onboardingStep("1", "Ask for components", "Use dashboards for structured output, intake cards for choices, and widgets only for compact custom visuals."),
      onboardingStep("2", "Use normal links", "Leave YouTube and useful URLs as plain links outside tables so preview cards can render cleanly."),
      onboardingStep("3", "Stay scroll-safe", "Avoid long custom row widgets. Use dashboard tables, timelines, and record cards for tall content."),
    ]),
    el("div", { className: "codexmod-settings-actions" }, [
      button("Copy example prompt", () => navigator.clipboard.writeText(examplePromptText())),
      button("Show component gallery", () => insertPrompt(componentGalleryPromptText())),
      button("Check for updates", () => checkForUpdates(state, { force: true })),
    ]),
  ]);
}

function onboardingStep(number, title, body) {
  return el("article", { className: "codexmod-onboarding-step" }, [
    el("span", {}, [number]),
    el("strong", {}, [title]),
    el("p", {}, [body]),
  ]);
}

function dismissOnboarding(state) {
  state.settings.onboardingDismissed = true;
  saveSettings(state);
  if (state.pageRoot) renderSettingsPage(state.pageRoot, state);
}

function updatePanel(state) {
  const update = state.updateCheck || defaultUpdateCheck();
  const status = updateStatusCopy(update);
  return el("section", { className: `codexmod-settings-group codexmod-update-panel is-${update.status}` }, [
    el("div", { className: "codexmod-settings-group-head" }, [
      el("div", {}, [
        el("h3", {}, ["Updates"]),
        el("p", { className: "codexmod-settings-muted" }, [status.body]),
      ]),
      el("span", { className: `codexmod-settings-pill ${status.tone}` }, [status.label]),
    ]),
    el("div", { className: "codexmod-update-meta" }, [
      el("span", {}, ["Installed ", el("strong", {}, [CURRENT_VERSION])]),
      update.latestVersion ? el("span", {}, ["Latest ", el("strong", {}, [update.latestVersion])]) : null,
      update.checkedAt ? el("span", {}, ["Checked ", el("strong", {}, [formatCheckedAt(update.checkedAt)])]) : null,
    ]),
    update.error ? el("p", { className: "codexmod-settings-error" }, [update.error]) : null,
    el("div", { className: "codexmod-settings-actions" }, [
      update.status === "available" ? button("Update Codex Components", () => insertPrompt(updatePromptText(update.latestVersion))) : null,
      button(update.status === "checking" ? "Checking..." : "Check again", () => checkForUpdates(state, { force: true })),
      state.settings.onboardingDismissed ? button("Show onboarding", () => showOnboarding(state)) : null,
    ]),
  ]);
}

function updateStatusCopy(update) {
  if (update.status === "checking") return { label: "Checking", tone: "tone-blue", body: "Checking GitHub for the latest Codex Components manifest." };
  if (update.status === "available") return { label: "Update available", tone: "tone-amber", body: `Version ${update.latestVersion} is available on GitHub.` };
  if (update.status === "up_to_date") return { label: "Up to date", tone: "tone-teal", body: "You are running the latest published Codex Components version." };
  if (update.status === "error") return { label: "Unable to check", tone: "tone-red", body: "Codex Components could not reach the GitHub manifest." };
  return { label: "Not checked", tone: "tone-gray", body: "Codex Components checks on startup, every hour, and when you click Check again." };
}

function formatCheckedAt(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "recently";
  }
}

function showOnboarding(state) {
  state.settings.onboardingDismissed = false;
  saveSettings(state);
  if (state.pageRoot) renderSettingsPage(state.pageRoot, state);
}

function examplePromptText() {
  return "Create a Codex Components dashboard with metric_strip, insight_grid, progress_bars, timeline, table, recommendations, and action_chips sections.";
}

function componentGalleryPromptText() {
  return "Create a Codex Components gallery that shows one example for every supported dashboard section, plus one intake card and one compact show_widget.";
}

function updatePromptText(latestVersion = "") {
  const versionLine = latestVersion ? ` Latest detected version: ${latestVersion}.` : "";
  return `Update Codex Components from GitHub:
https://github.com/moonmidas/codex-components

Please inspect the README and installer first, then run the macOS installer.${versionLine} Preserve existing Codex++ settings and tell me when to restart Codex++.`;
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
    "Supported dashboard sections: metric_strip, insight_grid, funnel, bar_chart, progress_bars, numbered_callouts, record_cards, alert_blocks, comparison_cards, timeline, pull_quote, tag_cloud, table, recommendations, action_chips.",
    "Use show_widget/codex-widget only for compact diagrams, charts, mockups, art, or interactive mini-tools that cannot be expressed as dashboard sections.",
    "Do not use show_widget for long lists, repeated rows, tables, record grids, or nested card layouts; use dashboard table, timeline, record_cards, or insight_grid instead.",
    "If show_widget is necessary, keep it bounded, transparent, and mostly non-scrolling; avoid custom overflow containers, position:fixed, and giant repeated row markup.",
    "Use concise labels, short interpretations, and color intent: blue neutral, teal good, amber warning, red problem.",
    "For video URLs, leave the URL as a normal link; Codex Components will preview it outside tables.",
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
  cleanupStaleStyles();
  const style = document.createElement("style");
  style.id = "codex-components-style";
  style.dataset.codexmodStyle = "components";
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
      --cm-purple: #7f77dd;
      --cm-coral: #d85a30;
      --cm-pink: #c4497f;
      --cm-green: #639922;
      --cm-gray: #888780;
      --cm-font-sans: var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      --cm-font-serif: var(--font-serif, ui-serif, Georgia, serif);
      --cm-font-mono: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      color: var(--cm-text);
      font: 13px/1.42 var(--cm-font-sans);
      margin: 10px 0 18px;
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
        --cm-purple: #afa9ec;
        --cm-coral: #f0997b;
        --cm-pink: #ef8bb8;
        --cm-green: #97c459;
        --cm-gray: #b4b2a9;
      }
    }
    .tone-blue { --tone: var(--cm-blue); --tone-bg: rgba(133,183,235,.13); --tone-border: rgba(133,183,235,.36); }
    .tone-teal { --tone: var(--cm-teal); --tone-bg: rgba(93,202,165,.13); --tone-border: rgba(93,202,165,.36); }
    .tone-red { --tone: var(--cm-red); --tone-bg: rgba(240,149,149,.13); --tone-border: rgba(240,149,149,.36); }
    .tone-amber { --tone: var(--cm-amber); --tone-bg: rgba(250,199,117,.14); --tone-border: rgba(250,199,117,.38); }
    .tone-purple { --tone: var(--cm-purple); --tone-bg: rgba(175,169,236,.14); --tone-border: rgba(175,169,236,.38); }
    .tone-coral { --tone: var(--cm-coral); --tone-bg: rgba(240,153,123,.14); --tone-border: rgba(240,153,123,.38); }
    .tone-pink { --tone: var(--cm-pink); --tone-bg: rgba(239,139,184,.14); --tone-border: rgba(239,139,184,.38); }
    .tone-green { --tone: var(--cm-green); --tone-bg: rgba(151,196,89,.14); --tone-border: rgba(151,196,89,.38); }
    .tone-gray { --tone: var(--cm-gray); --tone-bg: rgba(180,178,169,.12); --tone-border: rgba(180,178,169,.3); }
    .codexmod-component {
      background: transparent;
      border: 0;
      border-radius: 0;
      overflow: visible;
      max-width: 980px;
    }
    .codexmod-component-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      padding: 0 0 10px;
      border-bottom: 0;
    }
    .codexmod-component-title { margin: 0; font-size: 16px; font-weight: 500; }
    .codexmod-component-subtitle { margin: 4px 0 0; color: var(--cm-muted); font-size: 12px; }
    .codexmod-component-toolbar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      opacity: .32;
      transition: opacity .12s ease;
    }
    .codexmod-component:hover .codexmod-component-toolbar,
    .codexmod-component:focus-within .codexmod-component-toolbar {
      opacity: .82;
    }
    .codexmod-component-toolbar button,
    .codexmod-actions button,
    .codexmod-choices-option,
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
    .codexmod-component-toolbar button {
      border-color: transparent;
      background: transparent;
      color: var(--cm-faint);
      padding: 2px 0;
    }
    .codexmod-component-toolbar button:hover,
    .codexmod-component-toolbar button:focus-visible {
      color: var(--cm-text);
      text-decoration: underline;
    }
    .codexmod-component-body { padding: 0; display: grid; gap: 18px; }
    .codexmod-group .codexmod-component-body { gap: 14px; }
    .codexmod-group-child { min-width: 0; }
    .codexmod-group-child > .codexmod-component {
      max-width: none;
      padding-top: 2px;
    }
    .codexmod-section-title {
      margin: 0 0 9px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--cm-border);
      color: var(--cm-faint);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-weight: 500;
    }
    .codexmod-metrics,
    .codexmod-insights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
    }
    .codexmod-metric,
    .codexmod-insight {
      background: color-mix(in srgb, var(--cm-panel) 58%, transparent);
      border: 1px solid var(--cm-border);
      border-radius: 8px;
      padding: 13px;
    }
    .codexmod-label { display:block; color:var(--cm-faint); font-size:11px; text-transform:uppercase; letter-spacing:.07em; }
    .codexmod-value { display:block; margin-top:6px; font-size:24px; font-weight:600; color:var(--tone, var(--cm-blue)); }
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
    .codexmod-bar-fill { display:block; height:100%; border-radius:999px; background: var(--tone, var(--cm-blue)); }
    .codexmod-bar-value { font-size: 12px; }
    .codexmod-progress { display:grid; gap:6px; margin:10px 0; }
    .codexmod-progress-head { display:flex; align-items:center; justify-content:space-between; gap:12px; color:var(--cm-muted); }
    .codexmod-progress-head strong { color:var(--tone, var(--cm-blue)); font-variant-numeric: tabular-nums; }
    .codexmod-progress-track { display:block; height:10px; border-radius:999px; background:var(--cm-panel-2); overflow:hidden; }
    .codexmod-progress-fill { display:block; height:100%; border-radius:999px; background:var(--tone, var(--cm-blue)); }
    .codexmod-progress p { margin:0; color:var(--cm-muted); font-size:12px; }
    .codexmod-numbered { padding:18px 0; border-bottom:1px solid var(--cm-border); }
    .codexmod-numbered:last-child { border-bottom:0; }
    .codexmod-numbered-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
    .codexmod-rank {
      display:grid;
      place-items:center;
      width:42px;
      height:42px;
      border-radius:999px;
      background:var(--tone-bg);
      color:var(--tone, var(--cm-blue));
      border:1px solid var(--tone-border);
      font-weight:500;
      flex:0 0 auto;
    }
    .codexmod-numbered-value {
      color:var(--tone, var(--cm-blue));
      font-size:34px;
      line-height:1;
      font-weight:500;
      letter-spacing:0;
      font-variant-numeric: tabular-nums;
    }
    .codexmod-numbered h5 { margin:0; font-size:18px; font-weight:500; }
    .codexmod-numbered p { margin:10px 0 0 56px; color:var(--cm-muted); font-size:14px; line-height:1.45; }
    .codexmod-recommendation-box {
      margin:12px 0 0 56px;
      padding:10px 12px;
      border-radius:9px;
      background:var(--cm-panel);
      border:1px solid var(--cm-border);
      color:var(--cm-muted);
      line-height:1.4;
    }
    .codexmod-alert {
      display:flex;
      gap:10px;
      padding:12px;
      margin:9px 0;
      border-radius:10px;
      border:1px solid var(--tone-border);
      background:var(--tone-bg);
    }
    .codexmod-alert-icon {
      display:grid;
      place-items:center;
      width:22px;
      height:22px;
      border-radius:999px;
      background:var(--tone, var(--cm-blue));
      color:var(--cm-bg);
      font-weight:500;
      flex:0 0 auto;
    }
    .codexmod-alert strong { display:block; color:var(--cm-text); }
    .codexmod-alert p { margin:3px 0 0; color:var(--cm-muted); }
    .codexmod-records { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
    .codexmod-record {
      background:var(--cm-panel);
      border:1px solid var(--tone-border, var(--cm-border));
      border-radius:10px;
      padding:12px;
      display:grid;
      gap:10px;
    }
    .codexmod-record-head { display:flex; align-items:center; gap:10px; }
    .codexmod-avatar {
      display:grid;
      place-items:center;
      width:34px;
      height:34px;
      border-radius:999px;
      background:var(--tone-bg);
      color:var(--tone, var(--cm-blue));
      border:1px solid var(--tone-border);
      font-weight:500;
      flex:0 0 auto;
    }
    .codexmod-record h5 { margin:0; font-size:14px; font-weight:500; }
    .codexmod-record p { margin:2px 0 0; color:var(--cm-muted); font-size:12px; }
    .codexmod-record-fields { display:grid; gap:5px; }
    .codexmod-record-fields div { display:flex; justify-content:space-between; gap:10px; color:var(--cm-muted); }
    .codexmod-record-fields strong { color:var(--cm-text); font-weight:500; text-align:right; }
    .codexmod-pills { display:flex; flex-wrap:wrap; gap:6px; }
    .codexmod-pill {
      display:inline-flex;
      align-items:center;
      border-radius:999px;
      border:1px solid var(--tone-border);
      background:var(--tone-bg);
      color:var(--tone, var(--cm-blue));
      padding:3px 8px;
      font-size:11px;
      line-height:1.2;
      font-weight:500;
    }
    .codexmod-comparisons { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
    .codexmod-comparison {
      position:relative;
      display:grid;
      gap:8px;
      padding:14px;
      border:1px solid var(--cm-border);
      border-radius:10px;
      background:var(--cm-panel);
    }
    .codexmod-comparison.is-featured { border:2px solid var(--tone, var(--cm-blue)); }
    .codexmod-comparison h5 { margin:0; font-size:16px; font-weight:500; }
    .codexmod-comparison p { margin:0; color:var(--cm-muted); }
    .codexmod-comparison-value { color:var(--tone, var(--cm-blue)); font-size:22px; font-weight:500; font-variant-numeric:tabular-nums; }
    .codexmod-comparison ul { margin:0; padding-left:18px; color:var(--cm-muted); display:grid; gap:4px; }
    .codexmod-timeline { position:relative; list-style:none; margin:0; padding:0; display:grid; gap:0; }
    .codexmod-timeline:before {
      content:"";
      position:absolute;
      left:14px;
      top:16px;
      bottom:16px;
      width:1px;
      background:var(--cm-border);
    }
    .codexmod-timeline-item {
      position:relative;
      display:grid;
      grid-template-columns:30px 1fr;
      gap:10px;
      padding:0 0 16px;
    }
    .codexmod-timeline-dot {
      z-index:1;
      display:grid;
      place-items:center;
      width:28px;
      height:28px;
      border-radius:999px;
      border:1px solid var(--tone-border);
      background:var(--cm-bg);
      color:var(--tone, var(--cm-gray));
      font-weight:500;
    }
    .codexmod-timeline-item strong { display:block; font-weight:500; color:var(--cm-text); }
    .codexmod-timeline-item p { margin:3px 0 0; color:var(--cm-muted); }
    .codexmod-timeline-meta { display:block; margin-top:4px; color:var(--cm-faint); font-size:12px; }
    .codexmod-pullquote {
      margin:0;
      padding:4px 0 4px 16px;
      border-left:3px solid var(--tone, var(--cm-blue));
    }
    .codexmod-pullquote p {
      margin:0;
      font: italic 18px/1.45 var(--cm-font-serif);
      color:var(--cm-text);
    }
    .codexmod-pullquote cite { display:block; margin-top:8px; color:var(--cm-muted); font-style:normal; font-size:12px; }
    .codexmod-tag-cloud { display:flex; flex-wrap:wrap; gap:7px; }
    .codexmod-sparkline {
      display:block;
      width:100%;
      max-width:120px;
      height:32px;
      margin-top:8px;
    }
    .codexmod-sparkline polyline { stroke:var(--tone, var(--cm-blue)); }
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
      position: relative;
      display: block;
      max-width: 720px;
      padding: 0;
      overflow: hidden;
      aspect-ratio: 16 / 9;
      background: #050505;
    }
    .codexmod-video-surface {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: #050505;
      overflow: hidden;
      color: inherit;
    }
    .codexmod-video-thumb {
      cursor: pointer;
      text-decoration: none;
    }
    .codexmod-video-thumb img {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .codexmod-video-thumb::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(0,0,0,.68) 0%, rgba(0,0,0,.25) 42%, rgba(0,0,0,.2) 100%),
        linear-gradient(90deg, rgba(0,0,0,.36) 0%, transparent 58%);
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
      z-index: 2;
    }
    .codexmod-video-overlay {
      position: absolute;
      z-index: 3;
      left: 0;
      top: 0;
      right: 0;
      display: grid;
      gap: 3px;
      align-content: start;
      justify-items: start;
      padding: 14px 16px 56px;
      pointer-events: none;
    }
    .codexmod-video-title {
      display: inline;
      pointer-events: auto;
      color: var(--color-accent-primary, #cdb8ff) !important;
      font-size: 15px !important;
      line-height: 1.3;
      font-weight: 650;
      text-decoration: none;
      text-shadow: 0 1px 12px rgba(0,0,0,.72);
    }
    .codexmod-video-title:hover,
    .codexmod-video-title:focus-visible {
      text-decoration: underline;
    }
    .codexmod-video-domain {
      display: block;
      color: rgba(255,255,255,.76) !important;
      font-size: 12px !important;
      line-height: 1.25;
      text-shadow: 0 1px 10px rgba(0,0,0,.62);
    }
    .codexmod-recommendations { margin:0; padding-left: 18px; display:grid; gap:8px; }
    .codexmod-actions { display:flex; flex-wrap:wrap; gap:8px; }
    .codexmod-intake-question { margin:0; font-size:24px; line-height:1.2; font-family: Georgia, ui-serif, serif; font-weight:500; }
    .codexmod-choices-options,
    .codexmod-intake-options { display:grid; gap:8px; }
    .codexmod-choices-option,
    .codexmod-intake-option {
      display:flex;
      align-items:center;
      gap:12px;
      min-height:48px;
      text-align:left;
      background:transparent;
    }
    .codexmod-choices-option span,
    .codexmod-intake-option span {
      display:grid;
      place-items:center;
      width:28px;
      height:28px;
      border-radius:7px;
      background:color-mix(in srgb, var(--cm-panel) 62%, transparent);
      color:var(--cm-muted);
    }
    .codexmod-choices-option-copy,
    .codexmod-intake-option-copy {
      display:grid;
      gap:2px;
      min-width:0;
    }
    .codexmod-choices-option-copy small,
    .codexmod-intake-option-copy small {
      color:var(--cm-muted);
      font-size:12px;
      line-height:1.35;
    }
    .codexmod-widget-frame { width:100%; border:0; background:transparent; display:block; }
    .codexmod-widget-scrollbox {
      width: 100%;
      max-width: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      background: transparent;
    }
    .codexmod-widget-scrollbox iframe {
      min-width: 100%;
    }
    .codexmod-widget-guard {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin: 0 0 6px;
      padding: 2px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--cm-muted);
      font-size: 12px;
    }
    .codexmod-widget-guard button {
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--cm-faint);
      padding: 2px 0;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .codexmod-widget-guard button:hover,
    .codexmod-widget-guard button:focus-visible {
      color: var(--cm-text);
      text-decoration: underline;
    }
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
    .codexmod-settings-group-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
    }
    .codexmod-settings-group-head h3 { margin-bottom: 4px; }
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
    .codexmod-settings-pill.tone-teal { border-color: rgba(84,202,158,.38); color: #54ca9e; }
    .codexmod-settings-pill.tone-amber { border-color: rgba(255,203,122,.4); color: #ffcb7a; }
    .codexmod-settings-pill.tone-red { border-color: rgba(255,126,126,.4); color: #ff8d8d; }
    .codexmod-settings-pill.tone-gray { border-color: rgba(180,178,169,.32); color: var(--color-text-secondary, #b4b2a9); }
    .codexmod-settings-muted { margin-bottom: 10px !important; font-size: 13px; }
    .codexmod-settings-error {
      margin-top: 8px !important;
      color: #ff8d8d !important;
      font-size: 13px;
    }
    .codexmod-onboarding-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .codexmod-onboarding-step {
      min-width: 0;
      border: 1px solid var(--color-border-tertiary, rgba(255,255,255,.1));
      border-radius: 10px;
      background: var(--color-background-secondary, rgba(255,255,255,.04));
      padding: 12px;
    }
    .codexmod-onboarding-step span {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      margin-bottom: 8px;
      border-radius: 7px;
      background: rgba(133,183,235,.14);
      color: #85b7eb;
      font-size: 12px;
      font-weight: 650;
    }
    .codexmod-onboarding-step strong {
      display: block;
      margin-bottom: 4px;
      color: var(--color-text-primary, #f1efe8);
      font-weight: 600;
    }
    .codexmod-onboarding-step p { font-size: 13px; }
    .codexmod-update-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      color: var(--color-text-secondary, #b4b2a9);
      font-size: 13px;
    }
    .codexmod-update-meta strong {
      color: var(--color-text-primary, #f1efe8);
      font-weight: 600;
    }
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
    @media (max-width: 720px) {
      .codexmod-settings-hero,
      .codexmod-settings-group-head {
        flex-direction: column;
      }
      .codexmod-onboarding-grid {
        grid-template-columns: 1fr;
      }
      .codexmod-settings-actions {
        flex-wrap: wrap;
      }
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
      .codexmod-video-card { max-width: 100%; }
      .codexmod-video-overlay { padding: 12px 13px 48px; }
      .codexmod-video-title { font-size: 14px !important; }
    }
  `;
  document.head.appendChild(style);
  state.disposers.push(() => style.remove());
}

function cleanupStaleStyles() {
  document.querySelectorAll("style").forEach((style) => {
    const css = style.textContent || "";
    if (
      style.id === "codex-components-style"
      || style.dataset?.codexmodStyle === "components"
      || (css.includes(".codexmod-video-card") && css.includes(".codex-components"))
    ) {
      style.remove();
    }
  });
}
