export default function setup(api) {
  const disposers = [];

  disposers.push(api.registerCommand({
    id: "hello",
    title: "Hello from CodexMod",
    subtitle: "Minimal example command",
    keywords: "example starter template",
    run() {
      api.notify("Hello from a user mod");
    }
  }));

  return () => disposers.forEach((dispose) => dispose());
}
