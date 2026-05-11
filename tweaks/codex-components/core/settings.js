const SETTINGS_KEY = "codexmod.components.settings.v1";

const DEFAULT_SETTINGS = Object.freeze({
  renderer: true,
  mediaEmbeds: true,
  linkPreviews: true,
  tablePolish: true,
  autoPromptHelper: true,
  promptInjection: false,
  onboardingDismissed: false,
  videoPreviewMigration: 2,
});

function createSettings({
  activeCodexPlusPlusHome,
  button,
  checkForUpdates,
  componentPromptComment,
  currentVersion,
  defaultUpdateCheck,
  el,
  insertPrompt,
  rerenderAll,
  updatePromptText,
}) {
  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      const settings = { ...DEFAULT_SETTINGS, ...stored };
      settings.tablePolish = true;
      settings.promptInjection = false;
      delete settings.componentBlocks;
      delete settings.dashboards;
      delete settings.intake;
      delete settings.htmlWidgets;
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
    saveSettings(state);
    rerenderAll(state);
    if (state.pageRoot) renderSettingsPage(state.pageRoot, state);
  }

  function registerSettings(state) {
    const page = {
      id: "main",
      title: "Codex Components",
      description: "Structured Codex components, media cards, link previews, and polished tables.",
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
          el("p", {}, ["Component rendering is ", el("strong", {}, [state.settings.renderer ? "on" : "off"]), ". Configure Codex Components from the sidebar tab."]),
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
          el("p", {}, ["Turn raw tool output into readable components, tables, media cards, and link previews."]),
        ]),
        el("span", { className: "codexmod-settings-pill" }, [settings.renderer ? "Active" : "Paused"]),
      ]),
      settings.onboardingDismissed ? null : onboardingPanel(state),
      updatePanel(state),
      settingsGroup("Rendering", [
        toggleRow(state, "renderer", "Enable renderer", "Render component blocks in chat."),
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
        onboardingStep("1", "Ask for components", "Use direct component types for structured output, choices for follow-up prompts, and html only for compact custom visuals."),
        onboardingStep("2", "Use normal links", "Leave YouTube and useful URLs as plain links outside tables so preview cards can render cleanly."),
        onboardingStep("3", "Stay scroll-safe", "Avoid long custom HTML rows. Use table, timeline, records, or group for tall content."),
      ]),
      el("div", { className: "codexmod-settings-actions" }, [
        button("Copy example prompt", () => navigator.clipboard.writeText(examplePromptText())),
        button("Show component gallery", () => insertPrompt(componentGalleryPromptText())),
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
    const codexPlusPlusHome = activeCodexPlusPlusHome();
    const installedCommit = shortCommit(update.installedCommit);
    const latestCommit = shortCommit(update.latestCommit);
    return el("section", { className: `codexmod-settings-group codexmod-update-panel is-${update.status}` }, [
      el("div", { className: "codexmod-settings-group-head" }, [
        el("div", {}, [
          el("h3", {}, ["Updates"]),
          el("p", { className: "codexmod-settings-muted" }, [status.body]),
        ]),
        el("span", { className: `codexmod-settings-pill ${status.tone}` }, [status.label]),
      ]),
      el("div", { className: "codexmod-update-meta" }, [
        el("span", {}, ["Installed ", el("strong", {}, [currentVersion])]),
        installedCommit ? el("span", {}, ["Commit ", el("strong", {}, [installedCommit])]) : null,
        latestCommit ? el("span", {}, ["Latest ", el("strong", {}, [latestCommit])]) : null,
        update.checkedAt ? el("span", {}, ["Checked ", el("strong", {}, [formatCheckedAt(update.checkedAt)])]) : null,
        codexPlusPlusHome ? el("span", {}, ["Home ", el("strong", {}, [codexPlusPlusHome])]) : null,
      ]),
      update.error ? el("p", { className: "codexmod-settings-error" }, [update.error]) : null,
      el("div", { className: "codexmod-settings-actions" }, [
        button("Update from GitHub", () => insertPrompt(updatePromptText(state.updateCheck?.latestCommit, codexPlusPlusHome))),
        state.settings.onboardingDismissed ? button("Show onboarding", () => showOnboarding(state)) : null,
      ]),
    ]);
  }

  function updateStatusCopy(update) {
    if (update.status === "checking") return { label: "Checking", tone: "tone-blue", body: "Checking GitHub for the latest Codex Components commit." };
    if (update.status === "available") {
      const latest = shortCommit(update.latestCommit);
      return { label: "Update available", tone: "tone-amber", body: latest ? `Commit ${latest} is available on GitHub.` : "A newer Codex Components commit is available on GitHub." };
    }
    if (update.status === "up_to_date") return { label: "Up to date", tone: "tone-teal", body: "You are running the latest published Codex Components commit." };
    if (update.status === "manual") return { label: "Ready", tone: "tone-teal", body: "Update Codex Components from GitHub whenever you want the latest commit." };
    return { label: "Ready", tone: "tone-teal", body: "Update Codex Components from GitHub whenever you want the latest commit." };
  }

  function shortCommit(value) {
    const commit = String(value || "").trim();
    if (!commit || commit === "__CODEX_COMPONENTS_COMMIT__" || commit === "unknown") return "";
    return commit.slice(0, 8);
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
    return "Create a Codex Components group with metrics, insights, progress, timeline, table, recommendations, actions, choices, and one compact html component.";
  }

  function componentGalleryPromptText() {
    return "Create a Codex Components gallery with one example of every supported v0.2 component type: group, metrics, insights, funnel, bars, progress, callouts, records, alerts, comparison, timeline, quote, tags, table, recommendations, actions, choices, and html.";
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
      "When tool results contain analytics, funnel, campaign, revenue, retention, table, comparison data, or structured choices, prefer codex-component blocks over prose-only output.",
      "Use fenced JSON blocks with language codex-component.",
      "Supported component types: group, metrics, insights, funnel, bars, progress, callouts, records, alerts, comparison, timeline, quote, tags, table, recommendations, actions, choices, html.",
      "Use group only to combine several components; otherwise emit the exact component directly.",
      "Use choices for selectable follow-up prompts.",
      "Use html only for bounded custom visuals or advanced mini-tools that cannot be expressed with declarative components.",
      "Do not use html for long lists, repeated rows, tables, record grids, or nested card layouts; use table, timeline, records, insights, or group instead.",
      "If html is necessary, keep it bounded, transparent, and mostly non-scrolling; avoid custom overflow containers, position:fixed, and giant repeated row markup.",
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

  return {
    DEFAULT_SETTINGS,
    SETTINGS_KEY,
    loadSettings,
    registerSettings,
    renderSettingsPage,
    saveSettings,
    setSetting,
  };
}

module.exports = { createSettings, DEFAULT_SETTINGS, SETTINGS_KEY };
