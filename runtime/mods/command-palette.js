export default function setup(api) {
  const disposers = [];

  disposers.push(api.registerCommand({
    id: "focus-composer",
    title: "Focus Composer",
    subtitle: "Jump to the main Codex prompt box",
    keywords: "prompt composer input focus ask new task",
    run() {
      const candidate = document.querySelector("textarea, [contenteditable='true'], input[type='text']");
      if (candidate) {
        candidate.focus();
        api.notify("Focused the task composer");
      } else {
        api.notify("Could not find a task composer", { tone: "warn" });
      }
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

  return () => disposers.splice(0).forEach((dispose) => dispose());
}
