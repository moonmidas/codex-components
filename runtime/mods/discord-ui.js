export default function setup(api) {
  api.injectStyle("discord-ui", `
    .codexmod-discord-card {
      display: grid;
      gap: 8px;
      margin: 10px 0;
      padding: 12px;
      border: 1px solid var(--codexmod-border);
      border-left: 3px solid var(--codexmod-accent);
      border-radius: 8px;
      background: color-mix(in srgb, var(--codexmod-panel) 88%, var(--codexmod-accent) 12%);
    }
    .codexmod-discord-card-title {
      font-weight: 700;
    }
    .codexmod-discord-card-body {
      color: var(--codexmod-muted);
    }
  `);

  const disposers = [];

  disposers.push(api.registerComponentType("discord.card", (target, props) => {
    const card = document.createElement("section");
    card.className = "codexmod-discord-card";
    card.innerHTML = `
      <div class="codexmod-discord-card-title"></div>
      <div class="codexmod-discord-card-body"></div>`;
    card.querySelector(".codexmod-discord-card-title").textContent = props.title || "CodexMod";
    card.querySelector(".codexmod-discord-card-body").textContent = props.body || "";
    target.appendChild(card);
    return () => card.remove();
  }));

  disposers.push(api.registerCommand({
    id: "new-task",
    title: "Focus New Task Composer",
    subtitle: "Jump to the main Codex prompt box",
    keywords: "prompt composer input focus ask",
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
    id: "toggle-density",
    title: "Toggle Compact Density",
    subtitle: "Tighten spacing in the current Codex UI",
    keywords: "compact dense density layout",
    run() {
      document.documentElement.classList.toggle("codexmod-compact-density");
      api.injectStyle("density", `
        .codexmod-compact-density main,
        .codexmod-compact-density [role="main"] {
          --codexmod-density-active: 1;
        }
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
    id: "show-runtime-card",
    title: "Insert CodexMod Demo Component",
    subtitle: "Render an example interactive component in the page",
    keywords: "component demo discord card",
    run() {
      const target = document.querySelector("main, [role='main'], body");
      api.renderComponent(target, {
        type: "discord.card",
        props: {
          title: "CodexMod is active",
          body: "This card was rendered through the modding API."
        }
      });
    }
  }));

  disposers.push(api.hookOutputRendering((node) => {
    if (node.dataset?.codexmodDiscordSeen) return;
    if (!node.textContent?.includes("[[codexmod:card")) return;
    node.dataset.codexmodDiscordSeen = "true";
    const match = node.textContent.match(/\[\[codexmod:card\s+title="([^"]+)"\s+body="([^"]+)"\]\]/);
    if (!match) return;
    api.renderComponent(node, {
      type: "discord.card",
      props: { title: match[1], body: match[2] }
    });
  }));

  return () => disposers.splice(0).forEach((dispose) => dispose());
}
