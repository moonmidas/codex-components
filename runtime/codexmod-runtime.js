(() => {
  if (window.CodexModRuntime?.version) return;

  const state = {
    version: "0.1.0",
    mods: new Map(),
    availableMods: [],
    commands: new Map(),
    componentTypes: new Map(),
    outputHooks: new Set(),
    disposers: [],
    palette: null,
    settings: null,
    payload: null,
    controlBaseUrl: ""
  };

  function log(level, ...args) {
    console[level]("[CodexMod]", ...args);
  }

  function safe(fn, label) {
    try {
      return fn();
    } catch (error) {
      log("warn", `${label} failed:`, error);
      return undefined;
    }
  }

  function injectStyle(id, css) {
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function createApi(modName) {
    return {
      version: state.version,
      modName,
      domReady,
      injectStyle: (id, css) => injectStyle(`codexmod-${modName}-${id}`, css),
      notify: (message, options = {}) => notify(message, options),
      requestControl,
      reload: () => reloadCodexMod(),
      openSettings,
      openDevTools,
      getConfig: () => structuredClone(state.payload?.config || {}),
      setConfig: (config) => saveConfig(config),
      listMods: () => requestControl("/mods").then((result) => result.mods || []),
      registerCommand(command) {
        if (!command?.id || !command?.title || typeof command.run !== "function") {
          throw new Error("registerCommand requires { id, title, run }");
        }
        const id = `${modName}:${command.id}`;
        state.commands.set(id, { ...command, id, modName });
        refreshPalette();
        return () => {
          state.commands.delete(id);
          refreshPalette();
        };
      },
      registerComponentType(type, factory) {
        if (!type || typeof factory !== "function") {
          throw new Error("registerComponentType requires a type string and factory function");
        }
        state.componentTypes.set(type, { modName, factory });
        return () => state.componentTypes.delete(type);
      },
      renderComponent(target, descriptor) {
        const registration = state.componentTypes.get(descriptor?.type);
        if (!registration) throw new Error(`Unknown CodexMod component type: ${descriptor?.type}`);
        return registration.factory(target, descriptor.props || {}, descriptor);
      },
      hookOutputRendering(handler) {
        if (typeof handler !== "function") throw new Error("hookOutputRendering requires a function");
        state.outputHooks.add(handler);
        return () => state.outputHooks.delete(handler);
      },
      observe(selector, callback, options = {}) {
        return observe(selector, callback, options);
      },
      getCommands() {
        return [...state.commands.values()];
      },
      openPalette,
      closePalette
    };
  }

  async function requestControl(path, options = {}) {
    if (!state.controlBaseUrl) throw new Error("CodexMod control server is unavailable");
    const response = await fetch(`${state.controlBaseUrl}${path}`, {
      method: options.method || "GET",
      headers: { "content-type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const body = await response.json();
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed: ${path}`);
    return body;
  }

  function domReady() {
    if (document.readyState !== "loading") return Promise.resolve();
    return new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
  }

  function notify(message, options = {}) {
    if (state.payload?.config?.dev?.showToasts === false && !options.force) return;
    const host = document.createElement("div");
    host.className = `codexmod-toast codexmod-toast-${options.tone || "info"}`;
    host.textContent = message;
    document.body.appendChild(host);
    positionToasts();
    requestAnimationFrame(() => host.classList.add("is-visible"));
    setTimeout(() => {
      host.classList.remove("is-visible");
      setTimeout(() => {
        host.remove();
        positionToasts();
      }, 160);
    }, options.duration || 5200);
  }

  function positionToasts() {
    [...document.querySelectorAll(".codexmod-toast")].reverse().forEach((toast, index) => {
      toast.style.setProperty("--codexmod-toast-offset", `${18 + index * 54}px`);
    });
  }

  function ensureCoreButton() {
    if (document.querySelector(".codexmod-core-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "codexmod-core-button";
    button.title = "CodexMod";
    button.textContent = "CM";
    button.addEventListener("click", openSettings);
    document.body.appendChild(button);
    state.disposers.push(() => button.remove());
  }

  function ensureSettings() {
    if (state.settings) return state.settings;

    const overlay = document.createElement("div");
    overlay.className = "codexmod-settings-overlay";
    overlay.innerHTML = `
      <div class="codexmod-settings" role="dialog" aria-modal="true" aria-label="CodexMod settings">
        <header class="codexmod-settings-header">
          <div>
            <h2>CodexMod</h2>
            <p>The unofficial extension system OpenAI never shipped.</p>
          </div>
          <button type="button" class="codexmod-icon-button" data-action="close" aria-label="Close">×</button>
        </header>
        <section class="codexmod-settings-grid">
          <div class="codexmod-settings-panel">
            <h3>Runtime</h3>
            <dl class="codexmod-kv">
              <div><dt>Version</dt><dd data-field="version"></dd></div>
              <div><dt>Loaded mods</dt><dd data-field="loadedMods"></dd></div>
              <div><dt>Mod folder</dt><dd data-field="modsPath"></dd></div>
            </dl>
            <div class="codexmod-settings-actions">
              <button type="button" data-action="reload">Reload Mods</button>
              <button type="button" data-action="devtools">DevTools</button>
            </div>
          </div>
          <div class="codexmod-settings-panel">
            <h3>Installed Mods</h3>
            <div class="codexmod-mod-list" data-field="modList"></div>
          </div>
          <div class="codexmod-settings-panel">
            <h3>Developer</h3>
            <label class="codexmod-switch"><input type="checkbox" data-field="liveReload" /> <span>Live reload changed files</span></label>
            <label class="codexmod-switch"><input type="checkbox" data-field="showToasts" /> <span>Show runtime toasts</span></label>
          </div>
        </section>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.dataset.action === "close") closeSettings();
      if (event.target.dataset.action === "reload") reloadCodexMod();
      if (event.target.dataset.action === "devtools") openDevTools();
    });

    overlay.querySelector('[data-field="liveReload"]').addEventListener("change", (event) => {
      const config = createUpdatedConfig((draft) => {
        draft.dev.liveReload = event.target.checked;
      });
      saveConfig(config);
    });

    overlay.querySelector('[data-field="showToasts"]').addEventListener("change", (event) => {
      const config = createUpdatedConfig((draft) => {
        draft.dev.showToasts = event.target.checked;
      });
      saveConfig(config);
    });

    state.settings = { overlay };
    state.disposers.push(() => overlay.remove());
    return state.settings;
  }

  function createUpdatedConfig(mutator) {
    const current = structuredClone(state.payload?.config || {});
    current.dev ||= {};
    current.ui ||= {};
    mutator(current);
    return current;
  }

  async function refreshSettings() {
    const settings = ensureSettings();
    const config = state.payload?.config || {};
    const loadedMods = [...state.mods.keys()];
    settings.overlay.querySelector('[data-field="version"]').textContent = state.version;
    settings.overlay.querySelector('[data-field="loadedMods"]').textContent = String(loadedMods.length);
    settings.overlay.querySelector('[data-field="modsPath"]').textContent = state.payload?.paths?.userModsDir || "";
    settings.overlay.querySelector('[data-field="liveReload"]').checked = config.dev?.liveReload !== false;
    settings.overlay.querySelector('[data-field="showToasts"]').checked = config.dev?.showToasts !== false;

    const list = settings.overlay.querySelector('[data-field="modList"]');
    list.replaceChildren();
    const installed = await requestControl("/mods")
      .then((result) => result.mods?.length ? result.mods : state.availableMods)
      .catch(() => state.availableMods.length ? state.availableMods : loadedMods);
    const enabled = Array.isArray(config.enabledMods) ? new Set(config.enabledMods) : null;

    installed.forEach((modName) => {
      const row = document.createElement("label");
      row.className = "codexmod-mod-row";
      row.innerHTML = `
        <input type="checkbox" />
        <span></span>
        <small></small>`;
      row.querySelector("span").textContent = modName;
      row.querySelector("small").textContent = loadedMods.includes(modName) ? "loaded" : "disabled";
      const checkbox = row.querySelector("input");
      checkbox.checked = !enabled || enabled.has(modName);
      checkbox.addEventListener("change", () => toggleMod(modName, checkbox.checked));
      list.appendChild(row);
    });

    if (!installed.length) {
      const empty = document.createElement("div");
      empty.className = "codexmod-palette-empty";
      empty.textContent = "No mods installed";
      list.appendChild(empty);
    }
  }

  function openSettings() {
    ensureSettings().overlay.classList.add("is-open");
    refreshSettings();
  }

  function closeSettings() {
    if (state.settings) state.settings.overlay.classList.remove("is-open");
  }

  async function saveConfig(config) {
    await requestControl("/config", { method: "POST", body: { config } });
    state.payload.config = config;
    notify("CodexMod settings saved");
  }

  async function toggleMod(modName, enabled) {
    const installed = await requestControl("/mods").then((result) => result.mods || []);
    const config = createUpdatedConfig((draft) => {
      const current = Array.isArray(draft.enabledMods) ? new Set(draft.enabledMods) : new Set(installed);
      if (enabled) current.add(modName);
      else current.delete(modName);
      draft.enabledMods = [...current].sort();
    });
    await saveConfig(config);
  }

  async function reloadCodexMod() {
    await requestControl("/reload", { method: "POST" });
    notify("CodexMod reloaded", { force: true });
  }

  async function openDevTools() {
    const result = await requestControl("/open-devtools", { method: "POST" });
    if (!result.devtoolsUrl) {
      notify("No DevTools target found", { tone: "warn", force: true });
      return;
    }
    notify("Opening DevTools", { force: true });
  }

  function observe(selector, callback, options = {}) {
    const seen = new WeakSet();
    const root = options.root || document.documentElement;
    const visit = () => {
      document.querySelectorAll(selector).forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        safe(() => callback(node), `observe(${selector})`);
      });
    };
    visit();
    const observer = new MutationObserver(visit);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }

  function ensurePalette() {
    if (state.palette) return state.palette;

    const overlay = document.createElement("div");
    overlay.className = "codexmod-palette-overlay";
    overlay.innerHTML = `
      <div class="codexmod-palette" role="dialog" aria-modal="true" aria-label="CodexMod command palette">
        <div class="codexmod-palette-input-row">
          <span class="codexmod-palette-mark">⌘K</span>
          <input class="codexmod-palette-input" placeholder="Search Codex commands..." autocomplete="off" />
        </div>
        <div class="codexmod-palette-list" role="listbox"></div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector(".codexmod-palette-input");
    const list = overlay.querySelector(".codexmod-palette-list");
    const palette = { overlay, input, list, selected: 0, filtered: [] };

    input.addEventListener("input", () => {
      palette.selected = 0;
      refreshPalette();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        palette.selected = Math.min(palette.selected + 1, palette.filtered.length - 1);
        renderPalette();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        palette.selected = Math.max(palette.selected - 1, 0);
        renderPalette();
      } else if (event.key === "Enter") {
        event.preventDefault();
        runSelectedCommand();
      }
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closePalette();
    });

    state.palette = palette;
    refreshPalette();
    return palette;
  }

  function scoreCommand(command, query) {
    const haystack = `${command.title} ${command.subtitle || ""} ${command.keywords || ""}`.toLowerCase();
    if (!query) return 1;
    return query.toLowerCase().split(/\s+/).every((part) => haystack.includes(part)) ? 1 : 0;
  }

  function refreshPalette() {
    if (!state.palette) return;
    const query = state.palette.input.value.trim();
    state.palette.filtered = [...state.commands.values()]
      .filter((command) => scoreCommand(command, query))
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    renderPalette();
  }

  function renderPalette() {
    const palette = ensurePalette();
    palette.list.replaceChildren();

    if (!palette.filtered.length) {
      const empty = document.createElement("div");
      empty.className = "codexmod-palette-empty";
      empty.textContent = "No commands found";
      palette.list.appendChild(empty);
      return;
    }

    palette.filtered.forEach((command, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `codexmod-palette-item${index === palette.selected ? " is-selected" : ""}`;
      item.setAttribute("role", "option");
      item.innerHTML = `
        <span class="codexmod-palette-item-main">
          <span class="codexmod-palette-item-title"></span>
          <span class="codexmod-palette-item-subtitle"></span>
        </span>
        <span class="codexmod-palette-item-mod"></span>`;
      item.querySelector(".codexmod-palette-item-title").textContent = command.title;
      item.querySelector(".codexmod-palette-item-subtitle").textContent = command.subtitle || "";
      item.querySelector(".codexmod-palette-item-mod").textContent = command.modName;
      item.addEventListener("mouseenter", () => {
        palette.selected = index;
        renderPalette();
      });
      item.addEventListener("click", () => {
        palette.selected = index;
        runSelectedCommand();
      });
      palette.list.appendChild(item);
    });
  }

  function openPalette() {
    const palette = ensurePalette();
    palette.overlay.classList.add("is-open");
    palette.input.value = "";
    palette.selected = 0;
    refreshPalette();
    setTimeout(() => palette.input.focus(), 0);
  }

  function closePalette() {
    if (!state.palette) return;
    state.palette.overlay.classList.remove("is-open");
  }

  function runSelectedCommand() {
    const palette = ensurePalette();
    const command = palette.filtered[palette.selected];
    if (!command) return;
    closePalette();
    safe(() => command.run({ api: createApi(command.modName), command }), `command ${command.id}`);
  }

  function bindGlobalShortcut() {
    const handler = (event) => {
      const isK = event.key?.toLowerCase() === "k";
      if (isK && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        openPalette();
      } else if (event.key === "," && (event.metaKey || event.ctrlKey) && event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        openSettings();
      }
    };
    window.addEventListener("keydown", handler, true);
    state.disposers.push(() => window.removeEventListener("keydown", handler, true));
  }

  function registerCoreCommands() {
    const api = createApi("core");
    state.disposers.push(api.registerCommand({
      id: "open-settings",
      title: "Open CodexMod Settings",
      subtitle: "Manage mods, reload, and developer tools",
      keywords: "settings preferences mods manager configure",
      run: openSettings
    }));
    state.disposers.push(api.registerCommand({
      id: "reload",
      title: "Reload CodexMod",
      subtitle: "Reinject runtime and reload enabled mods",
      keywords: "reload refresh reinject mods",
      run: reloadCodexMod
    }));
    state.disposers.push(api.registerCommand({
      id: "open-devtools",
      title: "Open Codex Renderer DevTools",
      subtitle: "Inspect the injected UI through Chrome DevTools",
      keywords: "devtools inspect debug cdp",
      run: openDevTools
    }));
  }

  function installOutputBridge() {
    const dispose = observe("[data-codexmod-output], [data-message-author-role], article, pre", (node) => {
      for (const hook of state.outputHooks) {
        safe(() => hook(node), "output hook");
      }
    });
    state.disposers.push(dispose);
  }

  function uninstallPrevious() {
    if (window.CodexMod?.dispose) window.CodexMod.dispose();
  }

  async function loadCompiledMod(mod, setup) {
    const api = createApi(mod.name.replace(/\.js$/, ""));
    const cleanup = await setup(api);
    state.mods.set(mod.name, { ...mod, cleanup });
    if (typeof cleanup === "function") state.disposers.push(cleanup);
    log("info", `Loaded ${mod.name}`);
  }

  async function loadMod(mod) {
    throw new Error(`${mod.name} was not compiled by the injector`);
  }

  function compileMod(mod) {
    let code = mod.code.trim();
    code = code.replace(/export\s+default\s+async\s+function\s+setup\s*\(/, "return async function setup(");
    code = code.replace(/export\s+default\s+function\s+setup\s*\(/, "return function setup(");
    code = code.replace(/export\s+default\s+async\s+function\s*\(/, "return async function(");
    code = code.replace(/export\s+default\s+function\s*\(/, "return function(");
    code = code.replace(/export\s+default\s+setup\s*;?/, "return setup;");
    code = code.replace(/export\s+\{\s*setup\s+as\s+default\s*\}\s*;?/, "return setup;");
    code = code.replace(/export\s+async\s+function\s+setup\s*\(/, "async function setup(");
    code = code.replace(/export\s+function\s+setup\s*\(/, "function setup(");

    if (!code.includes("return ")) {
      code = `${code}\nreturn typeof setup === "function" ? setup : undefined;`;
    }

    const setup = new Function(`${code}\n//# sourceURL=${mod.url}`)();
    if (typeof setup !== "function") throw new Error("Mod must export default function setup(api)");
    return setup;
  }

  async function install(payload) {
    uninstallPrevious();
    await domReady();
    state.payload = payload;
    state.availableMods = (payload.availableMods || payload.mods || []).map((mod) => mod.name || mod);
    state.controlBaseUrl = payload.control?.port ? `http://127.0.0.1:${payload.control.port}` : "";
    injectStyle("codexmod-base-css", payload.baseCss || "");
    bindGlobalShortcut();
    installOutputBridge();
    ensureCoreButton();
    registerCoreCommands();

    window.CodexMod = {
      version: state.version,
      api: createApi("console"),
      openPalette,
      closePalette,
      openSettings,
      reload: reloadCodexMod,
      openDevTools,
      dispose() {
        while (state.disposers.length) safe(() => state.disposers.pop()(), "dispose");
        document.querySelectorAll('[id^="codexmod-"], .codexmod-palette-overlay, .codexmod-toast').forEach((node) => node.remove());
        state.mods.clear();
        state.commands.clear();
        state.componentTypes.clear();
        state.outputHooks.clear();
        state.palette = null;
        state.settings = null;
      }
    };

    setTimeout(() => notify(`CodexMod loaded ${state.mods.size} mod(s)`), 120);
  }

  window.CodexModRuntime = {
    version: state.version,
    install,
    loadCompiledMod(mod, setup) {
      return loadCompiledMod(mod, setup).catch((error) => {
        log("warn", `Could not load ${mod.name}:`, error);
        notify(`CodexMod could not load ${mod.name}: ${error.message}`, { tone: "warn", duration: 9000, force: true });
      });
    }
  };
})();
