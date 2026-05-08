import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import WebSocket from "ws";
import { ensureUserDirs, listJsFiles, readText, runtimeDir, userModsDir } from "./paths.js";

const DEFAULT_PORT = 9229;
const RETRY_MS = 1000;
const REINJECT_MS = 3000;

function parseArgs(argv) {
  const args = { port: DEFAULT_PORT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") args.port = Number(argv[++i]);
  }
  return args;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function looksLikeCodexTarget(target) {
  const text = `${target.title || ""} ${target.url || ""}`.toLowerCase();
  return target.type === "page" && (text.includes("codex") || text.includes("localhost") || text.includes("app://"));
}

class CdpSession {
  constructor(target) {
    this.target = target;
    this.nextId = 1;
    this.pending = new Map();
    this.ws = new WebSocket(target.webSocketDebuggerUrl);

    this.ws.on("message", (message) => {
      const payload = JSON.parse(message.toString());
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
      }
    });
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }

  async send(method, params = {}) {
    await this.ready();
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 10000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function buildInjectionBundle() {
  await ensureUserDirs();
  const runtime = await readText(`${runtimeDir}/codexmod-runtime.js`);
  const baseCss = await readText(`${runtimeDir}/codexmod.css`);
  const modFiles = await listJsFiles(userModsDir);
  const mods = await Promise.all(
    modFiles.map(async (file) => ({
      name: file.split("/").pop(),
      url: pathToFileURL(file).href,
      code: await readFile(file, "utf8")
    }))
  );

  return `
(() => {
  const payload = ${JSON.stringify({ runtime, baseCss, mods })};
  ${runtime}
  window.CodexModRuntime.install(payload);
})();`;
}

async function injectTarget(target) {
  const session = new CdpSession(target);
  const expression = await buildInjectionBundle();
  try {
    await session.send("Runtime.enable");
    await session.send("Page.enable");
    await session.send("Page.addScriptToEvaluateOnNewDocument", { source: expression });
    await session.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    console.log(`[codexmod] Injected into ${target.title || target.url}`);
  } finally {
    session.close();
  }
}

async function scanAndInject(port, injectedIds) {
  const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
  const pages = targets.filter((target) => target.webSocketDebuggerUrl && looksLikeCodexTarget(target));

  for (const page of pages) {
    if (injectedIds.has(page.id)) continue;
    try {
      await injectTarget(page);
      injectedIds.add(page.id);
    } catch (error) {
      console.warn(`[codexmod] Injection failed for ${page.title || page.url}: ${error.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const injectedIds = new Set();
  console.log(`[codexmod] Waiting for CDP on http://127.0.0.1:${args.port}`);

  setInterval(() => {
    scanAndInject(args.port, injectedIds).catch((error) => {
      console.warn(`[codexmod] CDP not ready: ${error.message}`);
    });
  }, REINJECT_MS);

  while (true) {
    try {
      await scanAndInject(args.port, injectedIds);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
}

main().catch((error) => {
  console.error(`[codexmod] ${error.message}`);
  process.exit(1);
});
