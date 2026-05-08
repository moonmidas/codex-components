# CodexMod Modding API

Every mod is an ES module in `~/.codexmod/mods/` that exports a default setup function:

```js
export default function setup(api) {
  const dispose = api.registerCommand({
    id: "hello",
    title: "Say Hello",
    subtitle: "Show a CodexMod toast",
    run() {
      api.notify("Hello from my mod");
    }
  });

  return dispose;
}
```

The setup function may return a cleanup function. CodexMod calls it before reinjection or disposal.

## API

### `api.registerCommand(command)`

Registers a command palette item.

```js
api.registerCommand({
  id: "focus-input",
  title: "Focus Composer",
  subtitle: "Jump to the main prompt input",
  keywords: "prompt input composer",
  run({ api, command }) {}
});
```

Returns a disposer.

### `api.openPalette()` and `api.closePalette()`

Opens or closes the global command palette.

### `api.openSettings()`

Opens the core CodexMod settings modal. This UI is part of the runtime, not a mod, so users can recover if a mod breaks.

### `api.reload()`

Asks the local CodexMod control server to reinject the runtime and reload enabled mods.

### `api.openDevTools()`

Opens the Chrome DevTools frontend for the current Codex renderer target.

### `api.getConfig()` and `api.setConfig(config)`

Reads or writes `~/.codexmod/config.json`. Saving config triggers a reload.

### `api.listMods()`

Returns the installed `.js` mods in `~/.codexmod/mods/`.

### `api.injectStyle(id, css)`

Adds or replaces a namespaced style tag for your mod.

```js
api.injectStyle("theme", ".my-mod-button { color: #10a37f; }");
```

### `api.notify(message, options)`

Shows a native-looking toast.

```js
api.notify("Done");
api.notify("Could not find composer", { tone: "warn", duration: 4000 });
```

### `api.registerComponentType(type, factory)`

Registers a reusable component renderer.

```js
api.registerComponentType("my.card", (target, props) => {
  const el = document.createElement("div");
  el.textContent = props.title;
  target.appendChild(el);
  return () => el.remove();
});
```

### `api.renderComponent(target, descriptor)`

Renders a registered component.

```js
api.renderComponent(document.body, {
  type: "my.card",
  props: { title: "Rendered by CodexMod" }
});
```

### `api.hookOutputRendering(handler)`

Runs a handler when likely output nodes appear or change.

```js
api.hookOutputRendering((node) => {
  if (node.textContent.includes("[[my-widget]]")) {
    // Replace or augment output.
  }
});
```

This is intentionally generic because Codex DOM internals may change.

### `api.observe(selector, callback, options)`

Watches the document for nodes matching a selector and calls the callback once per node.

```js
api.observe("textarea", (textarea) => {
  textarea.dataset.myModSeen = "true";
});
```

### `api.domReady()`

Resolves once the document is ready.

### `api.getCommands()`

Returns all currently registered commands.

## Best Practices

- Prefix DOM classes and data attributes with your mod name.
- Always return disposers for event listeners, observers, and inserted nodes.
- Avoid relying on Codex private class names unless there is no better selector.
- Treat output hooks as progressive enhancement. Codex should remain usable if your hook misses.
- Keep mods small and focused.
