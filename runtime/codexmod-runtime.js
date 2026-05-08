(() => {
  if (window.CodexModRuntime?.version) return;

  const state = {
    version: "0.1.0",
    mods: new Map(),
    commands: new Map(),
    componentTypes: new Map(),
    outputHooks: new Set(),
    disposers: [],
    palette: null
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

  function domReady() {
    if (document.readyState !== "loading") return Promise.resolve();
    return new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
  }

  function notify(message, options = {}) {
    const host = document.createElement("div");
    host.className = `codexmod-toast codexmod-toast-${options.tone || "info"}`;
    host.textContent = message;
    document.body.appendChild(host);
    requestAnimationFrame(() => host.classList.add("is-visible"));
    setTimeout(() => {
      host.classList.remove("is-visible");
      setTimeout(() => host.remove(), 160);
    }, options.duration || 2600);
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
      }
    };
    window.addEventListener("keydown", handler, true);
    state.disposers.push(() => window.removeEventListener("keydown", handler, true));
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

  async function loadMod(mod) {
    const api = createApi(mod.name.replace(/\.js$/, ""));
    const moduleUrl = URL.createObjectURL(new Blob([`${mod.code}\n//# sourceURL=${mod.url}`], { type: "text/javascript" }));
    try {
      const imported = await import(moduleUrl);
      const setup = imported.default || imported.setup;
      if (typeof setup !== "function") throw new Error("Mod must export default function setup(api)");
      const cleanup = await setup(api);
      state.mods.set(mod.name, { ...mod, cleanup });
      if (typeof cleanup === "function") state.disposers.push(cleanup);
      log("info", `Loaded ${mod.name}`);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  }

  async function install(payload) {
    uninstallPrevious();
    await domReady();
    injectStyle("codexmod-base-css", payload.baseCss || "");
    bindGlobalShortcut();
    installOutputBridge();

    window.CodexMod = {
      version: state.version,
      api: createApi("console"),
      openPalette,
      closePalette,
      dispose() {
        while (state.disposers.length) safe(() => state.disposers.pop()(), "dispose");
        document.querySelectorAll('[id^="codexmod-"], .codexmod-palette-overlay, .codexmod-toast').forEach((node) => node.remove());
        state.mods.clear();
        state.commands.clear();
        state.componentTypes.clear();
        state.outputHooks.clear();
        state.palette = null;
      }
    };

    for (const mod of payload.mods || []) {
      await loadMod(mod).catch((error) => {
        log("warn", `Could not load ${mod.name}:`, error);
        notify(`CodexMod could not load ${mod.name}`, { tone: "warn" });
      });
    }

    notify(`CodexMod loaded ${state.mods.size} mod(s)`);
  }

  window.CodexModRuntime = { version: state.version, install };
})();
