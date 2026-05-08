export default function setup(api) {
  const disposers = [];
  const chatDisposers = [];

  const command = (id, title, subtitle, keywords, run) => {
    disposers.push(api.registerCommand({ id, title, subtitle, keywords, run }));
  };

  function findComposer() {
    const candidates = [...document.querySelectorAll("textarea, [contenteditable='true'], input[type='text']")];
    return candidates.find((node) => !node.disabled && node.offsetParent !== null) || candidates[0] || null;
  }

  function normalizedText(node) {
    return `${node.textContent || ""} ${node.getAttribute("aria-label") || ""} ${node.title || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function clickByText(patterns, selectors = "button, [role='button'], a, [role='menuitem']") {
    const buttons = [...document.querySelectorAll(selectors)];
    const match = buttons.find((button) => {
      const label = normalizedText(button);
      return patterns.some((pattern) => label.includes(pattern));
    });
    if (!match) return false;
    match.click();
    return true;
  }

  function clickOrWarn(patterns, label, selectors) {
    if (!clickByText(patterns, selectors)) api.notify(`Could not find ${label}`, { tone: "warn" });
  }

  function openMenuThenClick(menuPatterns, itemPatterns, label) {
    if (!clickByText(menuPatterns)) {
      api.notify(`Could not find ${label}`, { tone: "warn" });
      return;
    }
    setTimeout(() => clickOrWarn(itemPatterns, label, "[role='menuitem'], button, [role='option']"), 120);
  }

  function setComposerText(text) {
    const composer = findComposer();
    if (!composer) {
      api.notify("Could not find a task composer", { tone: "warn" });
      return;
    }
    composer.focus();
    if ("value" in composer) {
      composer.value = text;
      composer.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      composer.textContent = text;
      composer.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  }

  command("focus-composer", "Focus Composer", "Jump to the main Codex prompt box", "prompt composer input focus ask new task", () => {
      const candidate = findComposer();
      if (candidate) {
        candidate.focus();
        api.notify("Focused the task composer");
      } else {
        api.notify("Could not find a task composer", { tone: "warn" });
      }
  });

  command("clear-composer", "Clear Composer", "Empty the current prompt input", "prompt composer input clear delete", () => {
      const candidate = findComposer();
      if (!candidate) {
        api.notify("Could not find a task composer", { tone: "warn" });
        return;
      }
      candidate.focus();
      if ("value" in candidate) {
        candidate.value = "";
        candidate.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        candidate.textContent = "";
        candidate.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
      api.notify("Cleared the composer");
  });

  command("new-chat", "New Chat", "Start a fresh Codex conversation", "new chat conversation task thread", () => {
    clickOrWarn(["new chat", "new task", "new conversation", "compose", "new"], "New Chat");
  });

  command("search-chats", "Search Chats", "Open Codex search if available", "search chats conversations find raycast", () => {
    clickOrWarn(["search", "find"], "Search");
  });

  command("open-plugins", "Open Plugins", "Open plugin and connector settings", "plugins connectors tools mcp", () => {
    clickOrWarn(["plugins", "connectors", "mcp"], "Plugins");
  });

  command("open-automations", "Open Automations", "Open automations, reminders, or scheduled tasks", "automations reminders recurring scheduled heartbeat", () => {
    clickOrWarn(["automations", "reminders", "scheduled", "recurring"], "Automations");
  });

  command("open-skills", "Open Skills", "Open skills or skill-related UI", "skills superpowers tools", () => {
    clickOrWarn(["skills", "superpowers"], "Skills");
  });

  command("attach-file", "Attach File", "Click Codex's file attachment control", "attach file upload add paperclip", () => {
    clickOrWarn(["attach", "file", "upload", "add file", "paperclip"], "Attach File", "button, [role='button'], input[type='file'], label");
  });

  command("attach-photo", "Attach Photo", "Click Codex's image/photo attachment control", "attach photo image screenshot upload", () => {
    clickOrWarn(["photo", "image", "screenshot", "camera"], "Attach Photo", "button, [role='button'], input[type='file'], label");
  });

  command("mic-input", "Voice Input", "Start Codex microphone input if available", "mic microphone voice audio dictate", () => {
    clickOrWarn(["mic", "microphone", "voice", "dictate"], "Voice Input");
  });

  command("copy-url", "Copy Current App URL", "Copy the renderer URL for debugging", "debug url copy location", async () => {
      await navigator.clipboard.writeText(location.href);
      api.notify("Copied current Codex URL");
  });

  command("copy-visible-text", "Copy Visible Text", "Copy visible Codex page text to the clipboard", "copy transcript conversation page text visible", async () => {
      const root = document.querySelector("main, [role='main']") || document.body;
      await navigator.clipboard.writeText(root.innerText.trim());
      api.notify("Copied visible text");
  });

  command("scroll-bottom", "Scroll to Bottom", "Jump to the latest visible output", "bottom latest end scroll", () => {
      const scrollers = [...document.querySelectorAll("*")]
        .filter((node) => node.scrollHeight > node.clientHeight + 80)
        .sort((a, b) => b.scrollHeight - a.scrollHeight);
      const target = scrollers[0] || document.scrollingElement;
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
  });

  command("scroll-top", "Scroll to Top", "Jump to the top of the current view", "top beginning scroll", () => {
      const target = document.scrollingElement || document.documentElement;
      target.scrollTo({ top: 0, behavior: "smooth" });
  });

  command("open-codex-settings", "Open Codex Settings", "Try to open Codex's native settings screen", "settings preferences account native codex", () => {
      if (!clickByText(["settings", "preferences"])) {
        api.notify("Could not find Codex settings", { tone: "warn" });
      }
  });

  command("open-model-menu", "Open Model Menu", "Open Codex model selector", "model gpt selector choose", () => {
    clickOrWarn(["model", "gpt", "codex"], "Model Menu");
  });

  ["low", "medium", "high", "xhigh"].forEach((effort) => {
    command(`thinking-${effort}`, `Set Thinking: ${effort}`, `Select ${effort} reasoning effort if the menu is available`, `thinking reasoning effort ${effort}`, () => {
      openMenuThenClick(["thinking", "reasoning", "effort"], [effort], `Thinking ${effort}`);
    });
  });

  ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2"].forEach((model) => {
    command(`model-${model.replaceAll(".", "-")}`, `Set Model: ${model}`, `Select ${model} if it is available`, `model ${model} gpt codex`, () => {
      openMenuThenClick(["model", "gpt", "codex"], [model], `Model ${model}`);
    });
  });

  command("toggle-auto-review", "Toggle Auto Review", "Toggle the auto-review setting if available", "auto review approvals reviewer", () => {
    clickOrWarn(["auto review", "auto-review", "reviewer"], "Auto Review");
  });

  command("insert-compact-instruction", "Insert Compact Instruction", "Ask Codex to compact the current context", "compact summarize context skill", () => {
    setComposerText("Please compact this thread/context into a concise, high-signal summary that preserves current goals, decisions, files changed, commands run, and next steps.");
  });

  command("insert-review-instruction", "Insert Review Instruction", "Ask Codex for a code-review pass", "review audit code inspect bugs", () => {
    setComposerText("Please review the current changes with a code-review stance. Prioritize bugs, regressions, missing tests, and risky assumptions. Lead with findings and file/line references.");
  });

  command("toggle-compact-density", "Toggle Compact Density", "Tighten spacing in the current Codex UI", "compact dense density layout", () => {
      document.documentElement.classList.toggle("codexmod-compact-density");
      api.injectStyle("density", `
        .codexmod-compact-density button,
        .codexmod-compact-density textarea,
        .codexmod-compact-density input {
          font-size: 13px;
        }
      `);
      api.notify("Toggled compact density");
  });

  command("show-runtime-status", "Show CodexMod Status", "Display loaded command count and runtime version", "status runtime commands mods version", () => {
      const commandCount = api.getCommands().length;
      api.notify(`CodexMod ${api.version}: ${commandCount} command(s) loaded`);
  });

  command("list-commands", "Show Command Count", "Count registered core and mod commands", "commands list count registry", () => {
      api.notify(`${api.getCommands().length} command(s) registered`);
  });

  function refreshChatCommands() {
    while (chatDisposers.length) chatDisposers.pop()();
    const seen = new Set();
    const candidates = [...document.querySelectorAll("aside a, nav a, aside button, nav button")]
      .map((node) => ({ node, title: normalizedText(node) }))
      .filter(({ title }) => title.length >= 4 && title.length <= 80)
      .filter(({ title }) => !["new chat", "search", "settings", "plugins", "automations"].some((blocked) => title.includes(blocked)))
      .slice(0, 24);

    candidates.forEach(({ node, title }, index) => {
      if (seen.has(title)) return;
      seen.add(title);
      chatDisposers.push(api.registerCommand({
        id: `open-visible-chat-${index}`,
        title: `Open Chat: ${title}`,
        subtitle: "Jump to a visible conversation",
        keywords: `chat conversation history ${title}`,
        run() {
          node.click();
        }
      }));
    });
  }

  refreshChatCommands();
  disposers.push(api.observe("aside, nav", refreshChatCommands));
  disposers.push(() => chatDisposers.splice(0).forEach((dispose) => dispose()));

  return () => disposers.splice(0).forEach((dispose) => dispose());
}
