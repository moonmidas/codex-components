/** @type {import("@codex-plusplus/sdk").Tweak} */
const { el, button } = require("./core/dom.js");
const {
  COMPONENT_TYPES,
  COMPONENT_TYPE_SET,
  normalizeDescriptor,
  isComponentLanguage,
} = require("./core/schema.js");
const { createShellHelpers } = require("./core/shell.js");
const {
  renderShell,
  toolbar,
  sectionWrap,
  withoutSectionTitle,
} = createShellHelpers({ copyText });
const { loadComponentCss } = require("./core/styles.js");
const { getComponentRenderer } = require("./core/registry.js");
const { renderMetrics } = require("./components/metrics/index.cjs");
const { renderTimeline } = require("./components/timeline/index.cjs");
const { renderTable } = require("./components/table/index.cjs");
const { renderGroup: renderGroupModule } = require("./components/group/index.cjs");
const { renderChoices: renderChoicesModule } = require("./components/choices/index.cjs");
const {
  renderHtml: renderHtmlModule,
  mountHtmlFrame: mountHtmlFrameModule,
  buildHtmlDocument: buildHtmlDocumentModule,
} = require("./components/html/index.cjs");
const { createSettings } = require("./core/settings.js");
const { createUpdateChecks } = require("./core/update-checks.js");
const { createLinkPreviewHelpers } = require("./media/links.js");

const TWEAK_BUILD = "2026-05-10-schema-reset-v1";
const CURRENT_VERSION = "0.2.1";
const UPDATE_CACHE_KEY = "codexmod.components.update.v1";
const UPDATE_MANIFEST_URL = "https://api.github.com/repos/moonmidas/codex-components/contents/tweaks/codex-components/manifest.json?ref=main";
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const updateChecks = createUpdateChecks({
  currentVersion: CURRENT_VERSION,
  updateCacheKey: UPDATE_CACHE_KEY,
  updateManifestUrl: UPDATE_MANIFEST_URL,
  updateCheckIntervalMs: UPDATE_CHECK_INTERVAL_MS,
  getRenderSettingsPage: () => renderSettingsPage,
});
const {
  activeCodexPlusPlusHome,
  checkForUpdates,
  compareVersions,
  defaultUpdateCheck,
  loadUpdateCache,
  normalizeManifestResponse,
  startUpdateChecks,
  updatePromptText,
} = updateChecks;

const settingsUi = createSettings({
  activeCodexPlusPlusHome,
  button,
  checkForUpdates,
  componentPromptComment,
  currentVersion: CURRENT_VERSION,
  defaultUpdateCheck,
  el,
  insertPrompt,
  rerenderAll,
  updatePromptText,
});
const {
  loadSettings,
  registerSettings,
  renderSettingsPage,
  saveSettings,
  setSetting,
} = settingsUi;

const mediaPreviews = createLinkPreviewHelpers({ el, isComposerSurface });
const {
  cleanupVideoCards,
  enhanceLinksAndMedia,
  parseYouTubeUrl,
  renderLinkPreview,
  renderYouTubeEmbed,
} = mediaPreviews;

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
    renderHtml,
    mountHtmlFrame,
    enhanceNativeTables,
    enhanceLinksAndMedia,
    buildHtmlDocument,
    normalizeDescriptor,
    uniqueBlocks,
    scanDocument,
    installRenderer,
    loadSettings,
    isComponentLanguage,
    COMPONENT_TYPES,
    COMPONENT_TYPE_SET,
    el,
    button,
    renderShell,
    toolbar,
    sectionWrap,
    withoutSectionTitle,
    renderSettingsPage,
    compareVersions,
    checkForUpdates,
    updatePromptText,
    activeCodexPlusPlusHome,
    loadUpdateCache,
    normalizeManifestResponse,
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
  cleanupStaleComponentMounts();
  discoverAndMountBlocks(state, isLocallyOwnedBlock);
  enhanceNativeTables(state);
  enhanceLinksAndMedia(state);
}

function cleanupStaleComponentMounts() {
  document.querySelectorAll("[data-codexmod-component-mount]").forEach((mount) => {
    const source = mount.previousElementSibling;
    if (source?.dataset?.codexmodComponentSource === "true" && source.style.display === "none") return;
    mount.remove();
  });
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
    const source = nearestRenderableSource(textNode);
    if (source && !isComposerSurface(source) && !seen.has(source) && !shouldSkipNode(state, source)) {
      const sourceText = source.textContent || text;
      const standaloneJson = source.matches?.("main, body") ? "" : standaloneComponentJson(sourceText);
      if (standaloneJson) {
        pushAllowedBlock(blocks, allowBlock, {
          node: source,
          sourceNode: source,
          language: "codex-component",
          raw: standaloneJson,
          hideSource: true,
        });
        seen.add(source);
      } else if (text.includes("```codex-component")) {
        for (const block of blocksFromText(state, source, source.textContent || text, shouldHideSource(source))) {
          pushAllowedBlock(blocks, allowBlock, block);
        }
        seen.add(source);
      }
    }
    textNode = walker.nextNode();
  }
}

function standaloneComponentJson(text) {
  const value = String(text || "").trim();
  if (!value.startsWith("{") || !value.endsWith("}")) return "";
  return looksLikeComponentJson(value) ? value : "";
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

function mountBlock(state, block) {
  const sourceNode = block.sourceNode || (block.hideSource ? findCodeBlockShell(block.node, block.raw, block.language) : block.node);
  if (state.mounted.has(block.node) || state.mounted.has(sourceNode)) return;
  const result = normalizeDescriptor(block.raw, block.language);
  if (!result.ok && isIncompleteComponentJson(block.raw, result.error)) return;
  if (!result.ok) {
    state.mounted.add(block.node);
    state.mounted.add(sourceNode);
    sourceNode.dataset.codexmodComponentSource = "true";
    if (block.hideSource) hideComponentSource(block, sourceNode);
    const mount = document.createElement("div");
    mount.className = "codex-components";
    mount.dataset.codexmodComponentMount = "true";
    sourceNode.after(mount);
    renderError(mount, result.error, block.raw);
    return;
  }
  const descriptor = result.descriptor;
  state.mounted.add(block.node);
  state.mounted.add(sourceNode);
  sourceNode.dataset.codexmodComponentSource = "true";
  if (block.hideSource) hideComponentSource(block, sourceNode);
  const mount = document.createElement("div");
  mount.className = "codex-components";
  mount.dataset.codexmodComponentMount = "true";
  sourceNode.after(mount);

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

function hideComponentSource(block, sourceNode) {
  for (const node of [sourceNode, block.sourceNode, block.node]) {
    if (!node?.style) continue;
    node.style.display = "none";
    node.dataset.codexmodComponentSource = "true";
  }
}

function canRenderComponent(state, descriptor) {
  return COMPONENT_TYPE_SET.has(descriptor.type);
}

function isIncompleteComponentJson(raw, error) {
  const text = String(raw || "").trim();
  if (!text) return true;
  if (/Unexpected end of JSON input|Unterminated string/i.test(String(error || ""))) return true;
  const opens = (text.match(/[\[{]/g) || []).length;
  const closes = (text.match(/[\]}]/g) || []).length;
  return opens > closes;
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

function renderComponent(target, descriptor, raw, state, options = {}) {
  if (descriptor.type === "group") return renderGroup(target, descriptor, raw, state, options);
  if (descriptor.type === "choices") return renderChoices(target, descriptor, raw, state, options);
  if (descriptor.type === "html") return renderHtml(target, descriptor, raw, state, options);
  return renderLeafComponent(target, descriptor, raw, state, options);
}

function componentContext() {
  return {
    button,
    el,
    htmlTokenStyle,
    insertPrompt,
    normalizeDescriptor,
    renderCallout,
    renderComponent,
    renderError,
    renderShell,
    sectionWrap,
    toneClass,
  };
}

function renderLeafComponent(target, descriptor, raw, state, options = {}) {
  const body = options.embedded ? target : options.body || renderShell(target, descriptor, raw, state, `codexmod-${descriptor.type}`);
  const section = options.embedded ? descriptor : withoutSectionTitle(descriptor);
  const renderer = getComponentRenderer(descriptor.type);
  if (renderer) renderer(body, section, declarativeRendererHelpers);
  else if (descriptor.type === "metrics") renderMetrics(body, section, componentContext());
  else if (descriptor.type === "timeline") renderTimeline(body, section, componentContext());
  else if (descriptor.type === "table") renderTable(body, section, componentContext());
  else renderCallout(body, { body: `Unsupported component: ${descriptor.type}` });
}

const declarativeRendererHelpers = Object.freeze({
  alertIcon,
  button,
  el,
  initials,
  insertPrompt,
  sectionWrap,
  toneClass,
});

function renderGroup(target, descriptor, raw, state) {
  return renderGroupModule(target, descriptor, raw, state, componentContext());
}

function renderCallout(body, section) {
  const wrap = sectionWrap(section, "codexmod-callout-section");
  wrap.append(el("p", {}, [section.body || section.text || section.markdown || `Unsupported section: ${section.type || "unknown"}`]));
  body.append(wrap);
}

function toneClass(tone) {
  const normalized = String(tone || "").toLowerCase();
  if (["teal", "success", "good", "up"].includes(normalized)) return "tone-teal";
  if (["green"].includes(normalized)) return "tone-green";
  if (["amber", "warning", "caution", "medium"].includes(normalized)) return "tone-amber";
  if (["red", "danger", "bad", "down", "critical"].includes(normalized)) return "tone-red";
  if (["coral"].includes(normalized)) return "tone-coral";
  if (["pink"].includes(normalized)) return "tone-pink";
  if (["purple"].includes(normalized)) return "tone-purple";
  if (["gray", "grey", "neutral"].includes(normalized)) return "tone-gray";
  return "tone-blue";
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

function renderChoices(target, descriptor, raw, state) {
  return renderChoicesModule(target, descriptor, raw, state, componentContext());
}

function renderHtml(target, descriptor, raw, state) {
  return renderHtmlModule(target, descriptor, raw, state, componentContext());
}

function mountHtmlFrame(body, descriptor, state) {
  return mountHtmlFrameModule(body, descriptor, state, componentContext());
}

function buildHtmlDocument(componentCode) {
  return buildHtmlDocumentModule(componentCode, componentContext());
}

function htmlTokenStyle() {
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
  return /\b(use|using|query|check|analy[sz]e|component|table|graph|chart|metric|funnel|report|posthog|supabase|meta ads|gmail|drive|calendar|stripe|github|plugin|skill|mcp|tool|link|youtube|video)\b/i.test(value);
}

function componentPromptComment() {
  return `<!-- Codex Components prompt contract:
When this answer uses tools, plugins, skills, analytics, links, tables, or structured data, prefer concise visual components over prose-only output.
Emit fenced JSON blocks with language codex-component and one component type: group, metrics, insights, funnel, bars, progress, callouts, records, alerts, comparison, timeline, quote, tags, table, recommendations, actions, choices, or html.
Use group only when combining several components in one surface; otherwise emit the exact component needed directly.
Use choices for selectable follow-up prompts.
Use html only for bounded custom visuals or advanced mini-tools that cannot be expressed with declarative components.
Do not use html for long lists, repeated rows, tables, record grids, or nested card layouts; use table, timeline, records, insights, or group instead.
If html is necessary, keep it bounded, transparent, and mostly non-scrolling; avoid custom overflow containers, position:fixed, and giant repeated row markup.
Keep labels short, include one-line interpretation, and use semantic signal colors only.
Leave YouTube/video URLs and normal URLs as plain links outside tables so Codex Components can render video previews/link cards.
Do not place link preview cards inside tables.
-->`;
}

function renderError(target, message, raw) {
  target.innerHTML = "";
  target.append(el("section", { className: "codex-components codexmod-component codexmod-error" }, [
    el("strong", {}, ["Could not render component"]),
    el("p", {}, [message]),
    el("details", {}, [el("summary", {}, ["View source"]), el("pre", {}, [raw])]),
  ]));
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

function installStyles(state) {
  cleanupStaleStyles();
  const style = document.createElement("style");
  style.id = "codex-components-style";
  style.dataset.codexmodStyle = "components";
  style.textContent = loadComponentCss();
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
