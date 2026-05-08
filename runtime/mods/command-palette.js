export default function setup(api) {
  const disposers = [];

  function findComposer() {
    const candidates = [...document.querySelectorAll("textarea, [contenteditable='true'], input[type='text']")];
    return candidates.find((node) => !node.disabled && node.offsetParent !== null) || candidates[0] || null;
  }

  function clickByText(patterns) {
    const buttons = [...document.querySelectorAll("button, [role='button'], a")];
    const match = buttons.find((button) => {
      const label = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""} ${button.title || ""}`.toLowerCase();
      return patterns.some((pattern) => label.includes(pattern));
    });
    if (!match) return false;
    match.click();
    return true;
  }

  disposers.push(api.registerCommand({
    id: "focus-composer",
    title: "Focus Composer",
    subtitle: "Jump to the main Codex prompt box",
    keywords: "prompt composer input focus ask new task",
    run() {
      const candidate = findComposer();
      if (candidate) {
        candidate.focus();
        api.notify("Focused the task composer");
      } else {
        api.notify("Could not find a task composer", { tone: "warn" });
      }
    }
  }));

  disposers.push(api.registerCommand({
    id: "clear-composer",
    title: "Clear Composer",
    subtitle: "Empty the current prompt input",
    keywords: "prompt composer input clear delete",
    run() {
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
    }
  }));

  disposers.push(api.registerCommand({
    id: "copy-url",
    title: "Copy Current App URL",
    subtitle: "Copy the renderer URL for debugging",
    keywords: "debug url copy location",
    async run() {
      await navigator.clipboard.writeText(location.href);
      api.notify("Copied current Codex URL");
    }
  }));

  disposers.push(api.registerCommand({
    id: "copy-visible-text",
    title: "Copy Visible Text",
    subtitle: "Copy visible Codex page text to the clipboard",
    keywords: "copy transcript conversation page text visible",
    async run() {
      const root = document.querySelector("main, [role='main']") || document.body;
      await navigator.clipboard.writeText(root.innerText.trim());
      api.notify("Copied visible text");
    }
  }));

  disposers.push(api.registerCommand({
    id: "scroll-bottom",
    title: "Scroll to Bottom",
    subtitle: "Jump to the latest visible output",
    keywords: "bottom latest end scroll",
    run() {
      const scrollers = [...document.querySelectorAll("*")]
        .filter((node) => node.scrollHeight > node.clientHeight + 80)
        .sort((a, b) => b.scrollHeight - a.scrollHeight);
      const target = scrollers[0] || document.scrollingElement;
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    }
  }));

  disposers.push(api.registerCommand({
    id: "scroll-top",
    title: "Scroll to Top",
    subtitle: "Jump to the top of the current view",
    keywords: "top beginning scroll",
    run() {
      const target = document.scrollingElement || document.documentElement;
      target.scrollTo({ top: 0, behavior: "smooth" });
    }
  }));

  disposers.push(api.registerCommand({
    id: "open-codex-settings",
    title: "Open Codex Settings",
    subtitle: "Try to open Codex's native settings screen",
    keywords: "settings preferences account native codex",
    run() {
      if (!clickByText(["settings", "preferences"])) {
        api.notify("Could not find Codex settings", { tone: "warn" });
      }
    }
  }));

  disposers.push(api.registerCommand({
    id: "toggle-compact-density",
    title: "Toggle Compact Density",
    subtitle: "Tighten spacing in the current Codex UI",
    keywords: "compact dense density layout",
    run() {
      document.documentElement.classList.toggle("codexmod-compact-density");
      api.injectStyle("density", `
        .codexmod-compact-density button,
        .codexmod-compact-density textarea,
        .codexmod-compact-density input {
          font-size: 13px;
        }
      `);
      api.notify("Toggled compact density");
    }
  }));

  disposers.push(api.registerCommand({
    id: "show-runtime-status",
    title: "Show CodexMod Status",
    subtitle: "Display loaded command count and runtime version",
    keywords: "status runtime commands mods version",
    run() {
      const commandCount = api.getCommands().length;
      api.notify(`CodexMod ${api.version}: ${commandCount} command(s) loaded`);
    }
  }));

  disposers.push(api.registerCommand({
    id: "list-commands",
    title: "Show Command Count",
    subtitle: "Count registered core and mod commands",
    keywords: "commands list count registry",
    run() {
      api.notify(`${api.getCommands().length} command(s) registered`);
    }
  }));

  return () => disposers.splice(0).forEach((dispose) => dispose());
}
