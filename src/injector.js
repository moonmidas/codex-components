import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import WebSocket from "ws";
import {
  ensureUserDirs,
  listJsFiles,
  readConfig,
  readText,
  runtimeDir,
  userConfigPath,
  userModsDir,
  writeConfig
} from "./paths.js";

const DEFAULT_PORT = 9229;
const DEFAULT_CONTROL_PORT = 9230;
const RETRY_MS = 1000;
const REINJECT_MS = 3000;

function parseArgs(argv) {
  const args = { port: DEFAULT_PORT, controlPort: DEFAULT_CONTROL_PORT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") args.port = Number(argv[++i]);
    else if (argv[i] === "--control-port") args.controlPort = Number(argv[++i]);
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

async function buildInjectionBundle(args) {
  await ensureUserDirs();
  const runtime = await readText(`${runtimeDir}/codexmod-runtime.js`);
  const baseCss = await readText(`${runtimeDir}/codexmod.css`);
  const config = await readConfig();
  const modFiles = await listJsFiles(userModsDir);
  const enabledMods = Array.isArray(config.enabledMods) ? new Set(config.enabledMods) : null;
  const mods = await Promise.all(
    modFiles
      .filter((file) => !enabledMods || enabledMods.has(file.split("/").pop()))
      .map(async (file) => ({
        name: file.split("/").pop(),
        url: pathToFileURL(file).href,
        code: await readFile(file, "utf8")
      }))
  );

  return `
(() => {
  const payload = ${JSON.stringify({
    runtime,
    baseCss,
    mods,
    config,
    control: { port: args.controlPort },
    paths: { userModsDir, userConfigPath }
  })};
  ${runtime}
  window.CodexModRuntime.install(payload);
})();`;
}

async function injectTarget(args, target) {
  const session = new CdpSession(target);
  const expression = await buildInjectionBundle(args);
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

async function scanAndInject(args, injectedIds) {
  const targets = await fetchJson(`http://127.0.0.1:${args.port}/json`);
  const pages = targets.filter((target) => target.webSocketDebuggerUrl && looksLikeCodexTarget(target));

  for (const page of pages) {
    if (injectedIds.has(page.id)) continue;
    try {
      await injectTarget(args, page);
      injectedIds.add(page.id);
    } catch (error) {
      console.warn(`[codexmod] Injection failed for ${page.title || page.url}: ${error.message}`);
    }
  }
}

async function injectAll(args, injectedIds) {
  injectedIds.clear();
  await scanAndInject(args, injectedIds);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(body));
}

async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function startControlServer(args, injectedIds) {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        sendJson(response, 200, { ok: true });
        return;
      }

      const url = new URL(request.url, `http://127.0.0.1:${args.controlPort}`);
      if (url.pathname === "/health") {
        sendJson(response, 200, { ok: true });
      } else if (url.pathname === "/reload" && request.method === "POST") {
        await injectAll(args, injectedIds);
        sendJson(response, 200, { ok: true });
      } else if (url.pathname === "/config" && request.method === "GET") {
        sendJson(response, 200, { ok: true, config: await readConfig() });
      } else if (url.pathname === "/config" && request.method === "POST") {
        const body = await readRequestJson(request);
        await writeConfig(body.config);
        await injectAll(args, injectedIds);
        sendJson(response, 200, { ok: true, config: await readConfig() });
      } else if (url.pathname === "/mods" && request.method === "GET") {
        const files = (await listJsFiles(userModsDir)).map((file) => file.split("/").pop());
        sendJson(response, 200, { ok: true, mods: files });
      } else if (url.pathname === "/devtools" && request.method === "GET") {
        const targets = await fetchJson(`http://127.0.0.1:${args.port}/json`);
        const target = targets.find((item) => item.webSocketDebuggerUrl && looksLikeCodexTarget(item));
        const devtoolsUrl = target?.devtoolsFrontendUrl
          ? `http://127.0.0.1:${args.port}${target.devtoolsFrontendUrl}`
          : null;
        sendJson(response, 200, { ok: Boolean(devtoolsUrl), devtoolsUrl });
      } else {
        sendJson(response, 404, { ok: false, error: "Not found" });
      }
    } catch (error) {
      sendJson(response, 500, { ok: false, error: error.message });
    }
  });

  server.listen(args.controlPort, "127.0.0.1", () => {
    console.log(`[codexmod] Control server on http://127.0.0.1:${args.controlPort}`);
  });
}

function startLiveReload(args, injectedIds) {
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      readConfig()
        .then((config) => (config.dev.liveReload ? injectAll(args, injectedIds) : null))
        .catch((error) => console.warn(`[codexmod] Live reload failed: ${error.message}`));
    }, 120);
  };

  watch(userModsDir, { persistent: false }, schedule);
  watch(runtimeDir, { persistent: false }, schedule);
  console.log("[codexmod] Live reload watcher active");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const injectedIds = new Set();
  await ensureUserDirs();
  console.log(`[codexmod] Waiting for CDP on http://127.0.0.1:${args.port}`);
  startControlServer(args, injectedIds);
  startLiveReload(args, injectedIds);

  setInterval(() => {
    scanAndInject(args, injectedIds).catch((error) => {
      console.warn(`[codexmod] CDP not ready: ${error.message}`);
    });
  }, REINJECT_MS);

  while (true) {
    try {
      await scanAndInject(args, injectedIds);
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
