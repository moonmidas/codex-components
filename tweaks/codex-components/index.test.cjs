const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

process.env.NODE_ENV = "test";
const tweakContext = {};
const tweak = loadTweakForTest(tweakContext);
const {
  createState,
  mountBlock,
  renderChoices,
  renderHtml,
  mountHtmlFrame,
  installRenderer,
  enhanceNativeTables,
  enhanceLinksAndMedia,
  buildHtmlDocument,
  normalizeDescriptor,
  uniqueBlocks,
  scanDocument,
  loadSettings,
  isComponentLanguage,
  renderSettingsPage,
  compareVersions,
  checkForUpdates,
  updatePromptText,
  activeCodexPlusPlusHome,
  loadUpdateCache,
} = tweak.__test;

const DECLARATIVE_COMPONENT_CASES = [
  {
    type: "metrics",
    items: [{ label: "Revenue", value: "$42K", delta: "12%", trend: "up", sparkline: [1, 3, 2, 5] }],
    expected: ".codexmod-metric",
  },
  {
    type: "insights",
    items: [{ title: "Signal", body: "The offer is clear." }],
    expected: ".codexmod-insight",
  },
  {
    type: "funnel",
    steps: [{ label: "Visit", value: 100 }, { label: "Buy", value: 14 }],
    expected: ".codexmod-bar-row",
  },
  {
    type: "bars",
    items: [{ label: "A", value: 8 }, { label: "B", value: 4 }],
    expected: ".codexmod-bar-row",
  },
  {
    type: "progress",
    items: [{ label: "Done", percent: 72, body: "Almost there." }],
    expected: ".codexmod-progress",
  },
  {
    type: "callouts",
    items: [{ rank: 1, value: "High", title: "Risk", body: "Needs review.", recommendation: "Fix first." }],
    expected: ".codexmod-numbered",
  },
  {
    type: "records",
    items: [{ title: "Ada Lovelace", subtitle: "Lead", fields: [{ label: "Status", value: "Active" }], pills: ["VIP"] }],
    expected: ".codexmod-record",
  },
  {
    type: "alerts",
    items: [{ title: "Warning", body: "Watch this.", tone: "amber" }],
    expected: ".codexmod-alert",
  },
  {
    type: "comparison",
    items: [{ title: "Pro", value: "$20", body: "Best fit.", features: ["Fast"], featured: true }],
    expected: ".codexmod-comparison",
  },
  {
    type: "timeline",
    items: [{ title: "Launch", body: "Ship it.", status: "done", meta: "Today" }],
    expected: ".codexmod-timeline-item",
  },
  {
    type: "quote",
    quote: "This is the line.",
    source: "Tester",
    expected: ".codexmod-pullquote",
  },
  {
    type: "tags",
    items: ["analytics", { label: "sales", tone: "teal" }],
    expected: ".codexmod-tag-cloud .codexmod-pill",
  },
  {
    type: "table",
    columns: [{ key: "name", label: "Name" }, { key: "score", label: "Score" }],
    rows: [{ name: "Alpha", score: 10 }],
    expected: ".codexmod-table tbody tr",
  },
  {
    type: "recommendations",
    items: [{ title: "Ship", body: "Do the smallest useful version." }],
    expected: ".codexmod-recommendations li",
  },
  {
    type: "actions",
    items: [{ label: "Continue", prompt: "Continue with the next step." }],
    expected: ".codexmod-actions button",
  },
];

const COMPONENT_TYPES = [
  "group",
  ...DECLARATIVE_COMPONENT_CASES.map((component) => component.type),
  "choices",
  "html",
];

test("renders every declarative component type directly", () => {
  for (const component of DECLARATIVE_COMPONENT_CASES) {
    setupDom();
    const state = testState();
    const descriptor = { version: 1, title: "Smoke Component", ...component };

    mountJson(state, descriptor);

    assert.ok(document.querySelector(component.expected), `${component.type} did not render ${component.expected}`);
  }
});

test("renders group as a component that contains other components", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "group",
    version: 1,
    title: "Worker Activity",
    subtitle: "Recent activity across Codex.",
    components: [
      { type: "metrics", version: 1, title: "Overview", items: [{ label: "Active", value: "3" }] },
      { type: "timeline", version: 1, title: "Recent", items: [{ title: "Worker finished", body: "Tests passed." }] },
      { type: "choices", version: 1, title: "Next step", options: [{ label: "Inspect", prompt: "Inspect workers." }] },
    ],
  });

  assert.ok(document.querySelector(".codexmod-group"));
  assert.ok(document.querySelector(".codexmod-metric"));
  assert.ok(document.querySelector(".codexmod-timeline-item"));
  assert.ok(document.querySelector(".codexmod-choices-option"));
});

test("top-level components do not repeat their title as a section heading", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "metrics",
    version: 1,
    title: "Project Snapshot",
    items: [{ label: "Tests", value: "42 passing", tone: "teal" }],
  });

  assert.equal(document.querySelector(".codexmod-component-title").textContent, "Project Snapshot");
  assert.equal(document.querySelectorAll(".codexmod-section-title").length, 0);
});

test("group children render as compact sections instead of nested titled shells", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "group",
    version: 1,
    title: "Codex Components Demo",
    components: [
      {
        type: "metrics",
        version: 1,
        title: "Launch Snapshot",
        items: [{ label: "Tasks Done", value: "18/24", tone: "teal" }],
      },
      {
        type: "timeline",
        version: 1,
        title: "Workflow",
        items: [{ title: "Read the codebase", body: "Gather patterns.", status: "done" }],
      },
    ],
  });

  assert.equal(document.querySelectorAll(".codexmod-component").length, 1);
  assert.deepEqual(
    Array.from(document.querySelectorAll(".codexmod-section-title")).map((node) => node.textContent),
    ["Launch Snapshot", "Workflow"],
  );
  assert.equal(document.querySelectorAll(".codexmod-component-toolbar").length, 1);
});

test("group does not render old nested component names", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "group",
    version: 1,
    title: "Invalid",
    components: [{ type: "dashboard", version: 1, sections: [] }],
  });

  assert.match(document.querySelector(".codex-components").textContent, /Unknown component type: dashboard/);
});

test("renders choices through the direct renderer", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  renderChoices(target, {
    type: "choices",
    version: 1,
    title: "Choose",
    options: [{ label: "Option A", prompt: "Pick A" }],
  }, "{}", state);
  assert.ok(document.querySelector(".codexmod-choices-option"));
});

test("choices does not repeat the title as a second question heading", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  renderChoices(target, {
    type: "choices",
    version: 1,
    title: "Choose a Test Path",
    subtitle: "Pick one option to continue the component test.",
    options: [{ label: "Inspect", prompt: "Inspect" }],
  }, "{}", state);

  assert.equal(document.querySelectorAll(".codexmod-choices-question").length, 0);
  assert.equal(document.querySelector(".codexmod-component-title").textContent, "Choose a Test Path");
});

test("html frames start in scroll-safe mode until interaction is enabled", () => {
  setupDom();
  const state = testState();

  mountJson(state, {
    type: "html",
    version: 1,
    title: "Frame",
    code: "<button>Inside iframe</button>",
    height: 180,
  });

  const frame = document.querySelector(".codexmod-html-frame");
  const toggle = document.querySelector(".codexmod-html-guard button");
  assert.equal(frame.style.pointerEvents, "none");
  assert.equal(toggle.textContent, "Enable interaction");

  toggle.click();

  assert.equal(frame.style.pointerEvents, "auto");
  assert.equal(toggle.textContent, "Disable interaction");
});

test("renders html blocks through the local scroll-safe iframe", () => {
  setupDom();
  const state = testState();
  const source = document.createElement("pre");
  document.body.append(source);

  mountBlock(state, {
    node: source,
    language: "codex-component",
    raw: JSON.stringify({
      type: "html",
      version: 1,
      title: "Native",
      code: "<div>Native HTML</div>",
    }),
    hideSource: true,
  });

  const frame = document.querySelector(".codexmod-html-frame");
  assert.ok(frame);
  assert.equal(frame.style.pointerEvents, "none");
  assert.equal(document.querySelector(".codexmod-html-guard button").textContent, "Enable interaction");
  assert.equal(source.style.display, "none");
});

test("renders choices even when a native-looking surface is nearby", () => {
  setupDom();
  const state = testState();
  const native = document.createElement("section");
  native.setAttribute("role", "group");
  native.setAttribute("data-native-render", "choices");
  native.innerHTML = "<h2>Native choices</h2><button>Choice</button>";
  const source = document.createElement("pre");
  document.body.append(native, source);

  mountBlock(state, {
    node: source,
    language: "codex-component",
    raw: JSON.stringify({
      type: "choices",
      version: 1,
      title: "Choices",
      options: [{ label: "One", prompt: "One" }],
    }),
    hideSource: true,
  });

  assert.ok(document.querySelector(".codexmod-choices-option"));
  assert.equal(source.style.display, "none");
});

test("renders choices when a native-looking surface is elsewhere in the same message", () => {
  setupDom(`
    <main>
      <article data-message-author-role="assistant">
        <section role="group" data-native-render="choices" class="codex-native-choices">
          <h2>Native choices</h2>
          <button>Choice</button>
        </section>
        <p>Some streamed text between the native surface and source.</p>
        <div>
          <pre class="language-codex-component">{"type":"choices","version":1,"title":"Choices","options":[{"label":"One","prompt":"One"}]}</pre>
        </div>
      </article>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 1);
  assert.ok(document.querySelector(".codexmod-choices-option"));
  assert.equal(document.querySelector("pre").style.display, "none");
});

test("renders html when the same message has an unrelated native-looking surface", () => {
  setupDom(`
    <main>
      <article data-message-author-role="assistant">
        <section role="group" data-native-render="metrics" class="codex-native-metrics">
          <h2>Native metrics</h2>
          <strong>42</strong>
        </section>
        <pre class="language-codex-component">{"type":"html","version":1,"title":"HTML","code":"<button>Inside iframe</button>"}</pre>
      </article>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  assert.ok(document.querySelector(".codexmod-html-frame"));
});

test("does not mount the same source node twice across rescans", () => {
  setupDom(`
    <main>
      <pre class="language-codex-component">{"type":"html","version":1,"title":"Choose","code":"<div>One HTML component</div>"}</pre>
    </main>
  `);
  const state = testState();

  scanDocument(state);
  scanDocument(state);

  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 1);
});

test("rerenders the same component JSON after Codex++ replaces the chat DOM", () => {
  const raw = "{\"type\":\"html\",\"version\":1,\"title\":\"Choose\",\"code\":\"<div>One HTML component</div>\"}";
  setupDom(`<main><pre class="language-codex-component">${raw}</pre></main>`);
  const state = testState();

  scanDocument(state);
  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 1);

  document.querySelector("main").innerHTML = `<pre class="language-codex-component">${raw}</pre>`;
  scanDocument(state);

  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 1);
  assert.equal(document.querySelector("pre").style.display, "none");
});

test("does not hide a streaming message container that later receives more blocks", () => {
  const firstRaw = "{\"type\":\"metrics\",\"version\":1,\"title\":\"First\",\"items\":[{\"label\":\"One\",\"value\":\"1\"}]}";
  const secondRaw = "{\"type\":\"choices\",\"version\":1,\"title\":\"Second\",\"options\":[{\"label\":\"Go\",\"prompt\":\"Go\"}]}";
  setupDom(`
    <main>
      <article data-message-author-role="assistant">
        <div class="streaming-markdown">
          <pre class="language-codex-component">${firstRaw}</pre>
        </div>
      </article>
    </main>
  `);
  const state = testState();
  const streaming = document.querySelector(".streaming-markdown");

  scanDocument(state);
  streaming.insertAdjacentHTML("beforeend", `<pre class="language-codex-component">${secondRaw}</pre>`);
  scanDocument(state);

  assert.equal(streaming.style.display, "");
  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 2);
  assert.ok(document.querySelector(".codexmod-choices"));
});

test("hides the native code fence wrapper without hiding the message container", () => {
  const raw = "{\"type\":\"metrics\",\"version\":1,\"title\":\"First\",\"items\":[{\"label\":\"One\",\"value\":\"1\"}]}";
  setupDom(`
    <main>
      <article data-message-author-role="assistant">
        <div class="streaming-markdown">
          <div class="native-code-shell">
            <div class="native-language-label">codex</div>
            <button aria-label="Copy code">copy</button>
            <pre class="language-codex-component">${raw}</pre>
          </div>
        </div>
      </article>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  const streaming = document.querySelector(".streaming-markdown");
  const shell = document.querySelector(".native-code-shell");
  assert.equal(streaming.style.display, "");
  assert.equal(shell.style.display, "none");
  assert.equal(shell.nextElementSibling?.dataset.codexmodComponentMount, "true");
});

test("hides nested native code card chrome around component blocks", () => {
  const raw = "{\"type\":\"metrics\",\"version\":1,\"title\":\"First\",\"items\":[{\"label\":\"One\",\"value\":\"1\"}]}";
  setupDom(`
    <main>
      <article data-message-author-role="assistant">
        <div class="streaming-markdown">
          <div class="native-code-card">
            <div class="native-code-header">
              <span>codex</span>
              <button aria-label="Copy code">copy</button>
            </div>
            <div class="native-code-body">
              <pre class="language-codex-component">${raw}</pre>
            </div>
          </div>
        </div>
      </article>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  const streaming = document.querySelector(".streaming-markdown");
  const card = document.querySelector(".native-code-card");
  const body = document.querySelector(".native-code-body");
  assert.equal(streaming.style.display, "");
  assert.equal(card.style.display, "none");
  assert.equal(body.style.display, "");
  assert.equal(card.nextElementSibling?.dataset.codexmodComponentMount, "true");
});

test("html has a scroll-safe default frame height", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    code: "<section><h1>HTML</h1><button>One</button><button>Two</button></section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  const scrollbox = document.querySelector(".codexmod-html-scrollbox");
  assert.equal(frame.style.height, "520px");
  assert.equal(scrollbox.style.height, "520px");
  assert.equal(frame.getAttribute("scrolling"), "yes");
  assert.equal(frame.style.pointerEvents, "none");
  assert.equal(document.querySelector(".codexmod-html-guard button").textContent, "Enable interaction");
  assert.match(frame.srcdoc, /overflow:hidden/);
  assert.match(frame.srcdoc, /typeof ResizeObserver === "function"/);
  assert.match(frame.srcdoc, /setInterval/);
});

test("html renders its iframe immediately instead of swapping a lazy placeholder", () => {
  setupDom();
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  tweakContext.IntersectionObserver = global.IntersectionObserver;
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  renderHtml(target, {
    type: "html",
    version: 1,
    code: "<section>Immediate HTML</section>",
  }, "{}", state);

  assert.ok(document.querySelector(".codexmod-html-frame"));
  assert.equal(document.querySelector(".codexmod-html-loading"), null);
});

test("html does not shrink below its default height after resize messages", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    code: "<section>Short report</section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  const scrollbox = document.querySelector(".codexmod-html-scrollbox");
  window.dispatchEvent(new window.MessageEvent("message", {
    source: frame.contentWindow,
    data: { method: "ui/notifications/size-changed", params: { height: 90 } },
  }));

  assert.equal(frame.style.height, "520px");
  assert.equal(scrollbox.style.height, "520px");
});

test("html caps oversized content in a parent scrollbox", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    height: 1280,
    code: "<section>Tall gallery</section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  const scrollbox = document.querySelector(".codexmod-html-scrollbox");
  assert.equal(frame.style.height, "720px");
  assert.equal(scrollbox.style.height, "720px");

  window.dispatchEvent(new window.MessageEvent("message", {
    source: frame.contentWindow,
    data: { method: "ui/notifications/size-changed", params: { height: 1600 } },
  }));

  assert.equal(frame.style.height, "1600px");
  assert.equal(scrollbox.style.height, "720px");
  assert.ok(scrollbox.classList.contains("codexmod-html-scrollbox-scrollable"));
});

test("html forwards edge wheel events to the nearest scroll parent", () => {
  setupDom("<main><section class=\"scroll-host\"><div id=\"target\"></div></section></main>");
  const host = document.querySelector(".scroll-host");
  Object.defineProperties(host, {
    scrollHeight: { value: 1200, configurable: true },
    clientHeight: { value: 400, configurable: true },
  });
  host.style.overflowY = "auto";
  const state = testState();
  const target = document.querySelector("#target");

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    code: "<section>Scrollable HTML</section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  window.dispatchEvent(new window.MessageEvent("message", {
    source: frame.contentWindow,
    data: { method: "codex/scroll-parent", params: { deltaY: 96 } },
  }));

  assert.equal(host.scrollTop, 96);
  assert.match(frame.srcdoc, /codex\/scroll-parent/);
});

test("html iframe wheel handler delegates all wheel deltas to the parent scrollbox", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    height: 1280,
    code: "<section>Scrollable HTML</section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  assert.match(frame.srcdoc, /event\.preventDefault\(\)/);
  assert.match(frame.srcdoc, /passive: false/);
  assert.doesNotMatch(frame.srcdoc, /atTop|atBottom/);
});

test("html forwarded wheel deltas move the parent scrollbox up and down", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    height: 1280,
    code: "<section>Scrollable HTML</section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  const scrollbox = document.querySelector(".codexmod-html-scrollbox");
  Object.defineProperties(scrollbox, {
    scrollHeight: { value: 1600, configurable: true },
    clientHeight: { value: 720, configurable: true },
  });

  window.dispatchEvent(new window.MessageEvent("message", {
    source: frame.contentWindow,
    data: { method: "codex/scroll-parent", params: { deltaY: 500 } },
  }));
  assert.equal(scrollbox.scrollTop, 500);

  window.dispatchEvent(new window.MessageEvent("message", {
    source: frame.contentWindow,
    data: { method: "codex/scroll-parent", params: { deltaY: -180 } },
  }));
  assert.equal(scrollbox.scrollTop, 320);
});

test("html scroll-safe mode scrolls the parent scrollbox under the pointer", () => {
  setupDom();
  const state = testState();
  const target = document.createElement("div");
  document.body.append(target);

  mountHtmlFrame(target, {
    type: "html",
    version: 1,
    height: 1280,
    code: "<section>Tall gallery</section>",
  }, state);

  const frame = document.querySelector(".codexmod-html-frame");
  const scrollbox = document.querySelector(".codexmod-html-scrollbox");
  Object.defineProperties(scrollbox, {
    scrollHeight: { value: 1600, configurable: true },
    clientHeight: { value: 720, configurable: true },
  });
  scrollbox.getBoundingClientRect = () => ({
    left: 20,
    top: 40,
    right: 620,
    bottom: 760,
    width: 600,
    height: 720,
  });
  frame.style.pointerEvents = "none";

  const event = new window.WheelEvent("wheel", {
    deltaY: 120,
    clientX: 100,
    clientY: 100,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);

  assert.equal(scrollbox.scrollTop, 120);
  assert.equal(event.defaultPrevented, true);
});

test("install renderer removes stale component mounts from a previous reload", () => {
  setupDom(`
    <main>
      <pre data-codexmod-component-source="true" style="display:none">source</pre>
      <div data-codexmod-component-mount="true">stale</div>
    </main>
  `);
  const state = testState();

  installRenderer(state);

  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 0);
  assert.equal(document.querySelector("[data-codexmod-component-source]"), null);
  assert.equal(document.querySelector("pre").style.display, "");
  disposeAll(state);
});

test("install renderer strips leaked prompt contracts from composer text", () => {
  setupDom(`
    <main></main>
    <section data-testid="composer">
      <textarea>Ask for a video

<!-- Codex Components prompt contract:
Do not leak this.
--></textarea>
    </section>
  `);
  const state = testState();

  installRenderer(state);

  assert.equal(document.querySelector("textarea").value, "Ask for a video");
  disposeAll(state);
});

test("link previews and YouTube previews are enabled by default", () => {
  setupDom(`
    <main>
      <p><a href="https://youtu.be/dQw4w9WgXcQ">Video</a></p>
      <p><a href="https://example.com/report">Report</a></p>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  assert.ok(document.querySelector(".codexmod-video-card"));
  assert.equal(document.querySelectorAll("[data-codexmod-link-preview='true']").length, 2);
});

test("polishes native tables and renders link previews without touching table links", () => {
  setupDom("<main><p><a href=\"https://example.com/report\">Report</a></p><table><tr><td><a href=\"https://example.com/in-table\">Cell</a></td></tr></table></main>");
  const state = testState();
  state.settings.tablePolish = true;
  state.settings.linkPreviews = true;

  enhanceNativeTables(state);
  enhanceLinksAndMedia(state);

  assert.ok(document.querySelector("table").classList.contains("codexmod-native-table"));
  assert.equal(document.querySelectorAll("[data-codexmod-link-preview='true']").length, 1);
  assert.match(document.querySelector("[data-codexmod-link-preview='true']").textContent, /example.com/);
});

test("renders YouTube links as same-surface thumbnail previews with title overlays", () => {
  setupDom("<main><p><a href=\"https://youtu.be/dQw4w9WgXcQ\">OpenAI: Introducing GPT-4o</a></p></main>");
  const state = testState();
  state.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(state);

  const card = document.querySelector(".codexmod-video-card");
  const title = card.querySelector(".codexmod-video-title");
  assert.ok(card);
  assert.ok(card.classList.contains("codexmod-video-card-preview"));
  assert.ok(card.querySelector(".codexmod-video-surface.codexmod-video-thumb"));
  assert.ok(card.querySelector(".codexmod-video-overlay"));
  assert.equal(title.textContent, "OpenAI: Introducing GPT-4o");
  assert.equal(title.getAttribute("href"), "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(card.querySelector(".codexmod-video-actions"), null);
  assert.equal(card.querySelector(".codexmod-video-framebar"), null);
});

test("hides standalone YouTube link rows after rendering the preview card", () => {
  setupDom("<main><p id=\"source\"><svg aria-hidden=\"true\"></svg><a href=\"https://youtu.be/dQw4w9WgXcQ\">OpenAI: Introducing GPT-4o</a></p></main>");
  const state = testState();
  state.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(state);

  assert.equal(document.querySelector("#source").style.display, "none");
  assert.equal(document.querySelector(".codexmod-video-title").textContent, "OpenAI: Introducing GPT-4o");
});

test("upgrades legacy YouTube video cards left behind by older tweak builds", () => {
  setupDom(`
    <main>
      <p id="source"><a href="https://youtu.be/dQw4w9WgXcQ">OpenAI: Introducing GPT-4o</a></p>
      <section class="codexmod-link-card codexmod-video-card" data-codexmod-link-preview="true">
        <div class="codexmod-video-framebar">
          <button>Hide video</button>
          <a href="https://youtu.be/dQw4w9WgXcQ">Open on YouTube</a>
        </div>
        <iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"></iframe>
      </section>
    </main>
  `);
  const state = testState();
  state.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(state);

  const card = document.querySelector(".codexmod-video-card");
  assert.ok(card.classList.contains("codexmod-video-card-preview"));
  assert.ok(card.querySelector(".codexmod-video-surface.codexmod-video-thumb"));
  assert.equal(card.querySelector(".codexmod-video-framebar"), null);
  assert.equal(card.textContent.includes("Hide video"), false);
  assert.equal(document.querySelector("#source").style.display, "none");
});

test("YouTube preview opens as a normal link instead of swapping to an iframe", () => {
  setupDom("<main><p><a href=\"https://youtu.be/dQw4w9WgXcQ\">OpenAI: Introducing GPT-4o</a></p></main>");
  const state = testState();
  state.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(state);
  const card = document.querySelector(".codexmod-video-card");
  const previewSurface = card.querySelector(".codexmod-video-surface");

  previewSurface.click();

  assert.equal(previewSurface.tagName, "A");
  assert.equal(previewSurface.getAttribute("href"), "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(previewSurface.getAttribute("target"), "_blank");
  assert.ok(card.classList.contains("codexmod-video-card-preview"));
  assert.equal(card.querySelector("iframe"), null);
  assert.equal(card.querySelector(".codexmod-video-actions"), null);
  assert.equal(card.querySelector(".codexmod-video-framebar"), null);
});

test("legacy loaded YouTube player cards are replaced with link previews", () => {
  setupDom(`
    <main>
      <p id="source" style="display:none"><a href="https://youtu.be/dQw4w9WgXcQ">OpenAI: Introducing GPT-4o</a></p>
      <section class="codexmod-link-card codexmod-video-card codexmod-video-card-loaded" data-codexmod-link-preview="true">
        <div class="codexmod-video-surface codexmod-video-player">
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"></iframe>
        </div>
      </section>
    </main>
  `);
  const state = testState();
  state.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(state);
  const card = document.querySelector(".codexmod-video-card");

  assert.ok(card.classList.contains("codexmod-video-card-preview"));
  assert.ok(card.querySelector(".codexmod-video-surface.codexmod-video-thumb"));
  assert.equal(card.querySelector("iframe"), null);
  assert.equal(document.querySelector("#source").style.display, "none");
});

test("renders YouTube live links and does not enhance composer links", () => {
  setupDom(`
    <main>
      <p><a href="https://www.youtube.com/live/dQw4w9WgXcQ?si=abc">Live</a></p>
      <section data-testid="composer"><div contenteditable="true"><a href="https://youtu.be/abc12345678">Draft</a></div></section>
    </main>
  `);
  const state = testState();
  state.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(state);

  assert.equal(document.querySelectorAll(".codexmod-video-card").length, 1);
  assert.match(document.querySelector(".codexmod-video-thumb img").getAttribute("src"), /dQw4w9WgXcQ/);
});

test("does not duplicate YouTube cards after renderer state is recreated", () => {
  setupDom("<main><p><a href=\"https://youtu.be/dQw4w9WgXcQ\">Video</a></p></main>");
  const first = testState();
  first.settings.mediaEmbeds = true;
  const second = testState();
  second.settings.mediaEmbeds = true;

  enhanceLinksAndMedia(first);
  enhanceLinksAndMedia(second);

  assert.equal(document.querySelectorAll(".codexmod-video-card").length, 1);
});

test("normalizes html descriptors and sanitizes disallowed browser APIs", () => {
  setupDom();
  const normalized = normalizeDescriptor(JSON.stringify({ type: "html", version: 1, code: "<div>Hi</div>" }), "codex-component");
  assert.equal(normalized.ok, true);
  assert.equal(normalized.descriptor.type, "html");
  assert.equal(normalized.descriptor.version, 1);

  const html = buildHtmlDocument(`
    <script src="https://evil.example/app.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <button onclick="localStorage.setItem('x','y');sessionStorage.clear()">Go</button>
  `);
  assert.doesNotMatch(html, /evil\.example/);
  assert.match(html, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(html, /localStorage\.setItem/);
  assert.doesNotMatch(html, /sessionStorage\.clear/);
});

test("deduplicates identical component blocks discovered through multiple DOM paths", () => {
  const raw = JSON.stringify({ type: "html", version: 1, code: "<div>Hi</div>" });
  const blocks = uniqueBlocks([
    { language: "codex-component", raw },
    { language: "codex-component", raw },
  ]);

  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks.map((block) => block.language), ["codex-component"]);
});

test("does not render component fences from composer surfaces", () => {
  setupDom(`
    <main>
      <section data-testid="composer">
        <div contenteditable="true">\`\`\`codex-component
{"type":"metrics","version":1,"title":"Draft","items":[{"label":"Draft","value":"Nope"}]}
\`\`\`</div>
      </section>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  assert.equal(document.querySelectorAll("[data-codexmod-component-mount]").length, 0);
});

test("renders metrics blocks through the local renderer by default", () => {
  setupDom(`
    <main>
      <pre class="language-codex-component">{"type":"metrics","version":1,"title":"Native","items":[{"label":"One","value":"1"}]}</pre>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  assert.ok(document.querySelector(".codexmod-metric"));
});

test("renders choices blocks through the local renderer by default", () => {
  setupDom(`
    <main>
      <pre class="language-codex-component">{"type":"choices","version":1,"title":"Choose a Path","options":[{"label":"Analytics view","prompt":"Create an analytics view."}]}</pre>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  assert.ok(document.querySelector(".codexmod-choices-option"));
});

test("renders html blocks through the local renderer by default", () => {
  setupDom(`
    <main>
      <pre class="language-codex-component">{"type":"html","version":1,"title":"HTML","code":"<button>Inside iframe</button>"}</pre>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  const frame = document.querySelector(".codexmod-html-frame");
  assert.ok(frame);
  assert.equal(frame.style.pointerEvents, "none");
});

test("does not mount incomplete streaming html JSON and retries when complete", () => {
  setupDom(`
    <main>
      <pre class="language-codex-component">{"type":"html","version":1,"title":"HTML","code":"&lt;button&gt;Inside</pre>
    </main>
  `);
  const state = testState();
  const source = document.querySelector("pre");

  scanDocument(state);

  assert.equal(document.querySelector("[data-codexmod-component-mount]"), null);
  assert.equal(source.style.display, "");

  source.textContent = JSON.stringify({
    type: "html",
    version: 1,
    title: "HTML",
    code: "<button>Inside iframe</button>",
  });
  scanDocument(state);

  assert.ok(document.querySelector(".codexmod-html-frame"));
});

test("renders html blocks through the local scroll-safe iframe by default", () => {
  setupDom(`
    <main>
      <pre class="language-codex-component">{"type":"html","version":1,"title":"Local","height":180,"code":"<button>Inside iframe</button>"}</pre>
    </main>
  `);
  const state = testState();

  scanDocument(state);

  const frame = document.querySelector(".codexmod-html-frame");
  assert.ok(frame);
  assert.equal(frame.style.pointerEvents, "none");
  assert.equal(document.querySelector(".codexmod-html-guard button").textContent, "Enable interaction");
});

test("forces legacy component block rendering off even when stale settings enabled it", () => {
  setupDom();
  localStorage.setItem("codexmod.components.settings.v1", JSON.stringify({
    componentBlocks: true,
    mediaEmbeds: false,
    linkPreviews: false,
    promptInjection: true,
    videoPreviewMigration: 1,
  }));

  const settings = loadSettings();
  assert.equal(Object.hasOwn(settings, "componentBlocks"), false);
  assert.equal(Object.hasOwn(settings, "dashboards"), false);
  assert.equal(Object.hasOwn(settings, "intake"), false);
  assert.equal(Object.hasOwn(settings, "htmlWidgets"), false);
  assert.equal(settings.mediaEmbeds, true);
  assert.equal(settings.linkPreviews, true);
  assert.equal(settings.promptInjection, false);
});

test("recognizes only the v0.2 component schema", () => {
  setupDom();
  const allowed = {
    group: { type: "group", version: 1, components: [] },
    metrics: { type: "metrics", version: 1 },
    insights: { type: "insights", version: 1 },
    funnel: { type: "funnel", version: 1 },
    bars: { type: "bars", version: 1 },
    progress: { type: "progress", version: 1 },
    callouts: { type: "callouts", version: 1 },
    records: { type: "records", version: 1 },
    alerts: { type: "alerts", version: 1 },
    comparison: { type: "comparison", version: 1 },
    timeline: { type: "timeline", version: 1 },
    quote: { type: "quote", version: 1 },
    tags: { type: "tags", version: 1 },
    table: { type: "table", version: 1 },
    recommendations: { type: "recommendations", version: 1 },
    actions: { type: "actions", version: 1 },
    choices: { type: "choices", version: 1 },
    html: { type: "html", version: 1, code: "<div>Advanced</div>" },
  };

  for (const [type, descriptor] of Object.entries(allowed)) {
    const result = normalizeDescriptor(JSON.stringify(descriptor), "codex-component");
    assert.equal(result.ok, true, `${type} should be accepted`);
    assert.equal(result.descriptor.type, type);
  }
});

test("rejects pre-reset component type names instead of aliasing them", () => {
  setupDom();
  const oldTypes = ["dashboard", "intake", "html_widget", "show_widget"];

  for (const type of oldTypes) {
    const result = normalizeDescriptor(JSON.stringify({ type, version: 1 }), "codex-component");
    assert.equal(result.ok, false, `${type} should be rejected`);
    assert.match(result.error, /Unknown component type/);
  }
});

test("only codex-component fences are component fences", () => {
  assert.equal(isComponentLanguage("codex-component"), true);
  assert.equal(isComponentLanguage("codex-widget"), false);
  assert.equal(isComponentLanguage("show_widget"), false);
  assert.equal(isComponentLanguage("show-widget"), false);
});

test("compares semantic versions for update checks", () => {
  assert.equal(compareVersions("0.1.1", "0.1.0"), 1);
  assert.equal(compareVersions("0.1.0", "0.1.1"), -1);
  assert.equal(compareVersions("0.1.0", "0.1.0"), 0);
  assert.equal(compareVersions("0.10.0", "0.2.9"), 1);
  assert.equal(compareVersions("1.0.0-beta.2", "1.0.0-beta.1"), 1);
});

test("checks GitHub manifest and records an available update", async () => {
  setupDom();
  let requestedUrl = "";
  tweakContext.fetch = async (url, options) => {
    requestedUrl = String(url);
    assert.equal(options.cache, "no-store");
    return {
      ok: true,
      json: async () => ({ version: "9.9.9" }),
    };
  };
  const state = testState();

  const update = await checkForUpdates(state, { force: true });

  assert.match(requestedUrl, /raw\.githubusercontent\.com\/moonmidas\/codex-components/);
  assert.equal(update.status, "available");
  assert.equal(update.latestVersion, "9.9.9");
  assert.equal(loadUpdateCache().latestVersion, "9.9.9");
});

test("uses cached update check results for non-forced checks inside the hourly window", async () => {
  setupDom();
  let fetchCount = 0;
  tweakContext.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({ version: "0.1.0" }),
    };
  };
  const state = testState();

  await checkForUpdates(state, { force: true });
  await checkForUpdates(state, { force: false });

  assert.equal(fetchCount, 1);
});

test("starts update checks on tweak startup and repeats them every hour", async () => {
  setupDom();
  let fetchCount = 0;
  let intervalCallback = null;
  let intervalDelay = 0;
  let clearedTimer = null;
  const originalSetInterval = tweakContext.setInterval;
  const originalClearInterval = tweakContext.clearInterval;
  tweakContext.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({ version: "0.1.1" }),
    };
  };
  tweakContext.setInterval = (callback, delay) => {
    intervalCallback = callback;
    intervalDelay = delay;
    return "hourly-update-timer";
  };
  tweakContext.clearInterval = (timer) => {
    clearedTimer = timer;
  };

  try {
    tweak.start({
      log: { info() {}, warn() {} },
      settings: {
        registerPage() {
          return { unregister() {} };
        },
        register() {
          return { unregister() {} };
        },
      },
    });
    await tweak._state.updatePromise;

    assert.equal(fetchCount, 1);
    assert.equal(intervalDelay, 60 * 60 * 1000);
    assert.equal(typeof intervalCallback, "function");

    await intervalCallback();
    assert.equal(fetchCount, 2);

    tweak.stop();
    assert.equal(clearedTimer, "hourly-update-timer");
  } finally {
    tweak.stop();
    tweakContext.setInterval = originalSetInterval;
    tweakContext.clearInterval = originalClearInterval;
  }
});

test("keeps update check failures contained and visible in settings state", async () => {
  setupDom();
  tweakContext.fetch = async () => ({ ok: false, status: 500 });
  const state = testState();

  const update = await checkForUpdates(state, { force: true });

  assert.equal(update.status, "error");
  assert.match(update.error, /GitHub returned 500/);
});

test("settings page shows onboarding and an update action when a newer version is cached", () => {
  setupDom("<main></main><textarea></textarea>");
  window.__codexpp_tweaks_dir__ = "/Users/moonmidas/Library/Application Support/codex-plusplus-copy/tweaks";
  localStorage.setItem("codexmod.components.update.v1", JSON.stringify({
    status: "available",
    latestVersion: "9.9.9",
    checkedAt: Date.now(),
  }));
  const state = testState();
  state.updateCheck = loadUpdateCache();
  const root = document.querySelector("main");

  renderSettingsPage(root, state);
  findButton(root, "Update Codex Components").click();

  assert.match(root.textContent, /Start Here/);
  assert.match(root.textContent, /Update available/);
  assert.match(root.textContent, /codex-plusplus-copy/);
  assert.match(document.querySelector("textarea").value, /Update Codex Components from GitHub/);
  assert.match(document.querySelector("textarea").value, /Latest detected version: 9\.9\.9/);
  assert.match(document.querySelector("textarea").value, /CODEX_PLUSPLUS_HOME="\/Users\/moonmidas\/Library\/Application Support\/codex-plusplus-copy"/);
});

test("settings page can manually refresh update state from GitHub", async () => {
  setupDom("<main></main>");
  tweakContext.fetch = async () => ({
    ok: true,
    json: async () => ({ version: "9.9.9" }),
  });
  const state = testState();
  const root = document.querySelector("main");

  renderSettingsPage(root, state);
  findButton(root, "Refresh from GitHub").click();
  await state.updatePromise;

  assert.match(root.textContent, /Update available/);
  assert.match(root.textContent, /Latest 9\.9\.9/);
});

test("dismisses and restores the onboarding panel from settings", () => {
  setupDom();
  const state = testState();
  const root = document.querySelector("main");

  renderSettingsPage(root, state);
  findButton(root, "Got it").click();

  assert.equal(state.settings.onboardingDismissed, true);
  assert.doesNotMatch(root.textContent, /Start Here/);

  findButton(root, "Show onboarding").click();

  assert.equal(state.settings.onboardingDismissed, false);
  assert.match(root.textContent, /Start Here/);
});

test("settings prompt contract advertises only v0.2 component names", () => {
  setupDom();
  const state = testState();
  const root = document.querySelector("main");

  renderSettingsPage(root, state);

  assert.match(root.textContent, /Supported component types: group, metrics, insights/);
  assert.doesNotMatch(root.textContent, /metric_strip|insight_grid|progress_bars|action_chips|show_widget|html_widget|intake/);
});

test("update prompt tells Codex to preserve existing Codex++ settings", () => {
  const prompt = updatePromptText("9.9.9", "/Users/moonmidas/Library/Application Support/codex-plusplus-copy");

  assert.match(prompt, /github\.com\/moonmidas\/codex-components/);
  assert.match(prompt, /Preserve existing Codex\+\+ settings/);
  assert.match(prompt, /Latest detected version: 9\.9\.9/);
  assert.match(prompt, /CODEX_PLUSPLUS_HOME="\/Users\/moonmidas\/Library\/Application Support\/codex-plusplus-copy"/);
});

test("active Codex++ home is derived from the runtime tweaks directory", () => {
  setupDom();
  window.__codexpp_tweaks_dir__ = "/Users/moonmidas/Library/Application Support/codex-plusplus-copy/tweaks";

  assert.equal(activeCodexPlusPlusHome(), "/Users/moonmidas/Library/Application Support/codex-plusplus-copy");
});

test("package, manifest, and runtime component versions stay in sync", () => {
  const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(__dirname, "manifest.json"), "utf8"));
  const source = readFileSync(join(__dirname, "index.js"), "utf8");
  const runtimeVersion = /const CURRENT_VERSION = "([^"]+)"/.exec(source)?.[1];

  assert.equal(packageJson.version, manifest.version);
  assert.equal(packageJson.version, runtimeVersion);
});

test("README and examples list every v0.2 component type", () => {
  const readme = readFileSync(join(__dirname, "..", "..", "README.md"), "utf8");
  const examples = readFileSync(join(__dirname, "..", "..", "docs", "examples", "all-components.md"), "utf8");
  for (const type of COMPONENT_TYPES) {
    assert.match(readme, new RegExp(`\\| \`${type}\``), `${type} is missing from README.md`);
    assert.match(examples, new RegExp(`"type": "${type}"`), `${type} is missing from all-components.md`);
  }
  assert.doesNotMatch(readme, /metric_strip|insight_grid|progress_bars|action_chips|show_widget|html_widget|widget_code|intake/);
});

function mountJson(state, descriptor) {
  const source = document.createElement("pre");
  document.body.append(source);
  mountBlock(state, {
    node: source,
    language: "codex-component",
    raw: JSON.stringify(descriptor),
    hideSource: true,
  });
}

function testState() {
  return createState({
    log: {
      info() {},
      warn() {},
    },
    storage: {
      get() {},
      set() {},
    },
  });
}

function setupDom(html = "<main></main>") {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: "https://codex.local/",
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.NodeFilter = dom.window.NodeFilter;
  global.Node = dom.window.Node;
  global.InputEvent = dom.window.InputEvent;
  global.MutationObserver = dom.window.MutationObserver;
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  global.localStorage = dom.window.localStorage;
  window.open = () => {};
  Object.assign(tweakContext, {
    window: dom.window,
    document: dom.window.document,
    NodeFilter: dom.window.NodeFilter,
    Node: dom.window.Node,
    InputEvent: dom.window.InputEvent,
    MutationObserver: dom.window.MutationObserver,
    IntersectionObserver: global.IntersectionObserver,
    ResizeObserver: global.ResizeObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    localStorage: dom.window.localStorage,
  });
}

function disposeAll(state) {
  while (state.disposers.length) state.disposers.pop()();
}

function findButton(root, text) {
  const button = Array.from(root.querySelectorAll("button")).find((candidate) => candidate.textContent === text);
  assert.ok(button, `Expected button "${text}"`);
  return button;
}

function loadTweakForTest(context) {
  const module = { exports: {} };
  const filename = join(__dirname, "index.js");
  const source = readFileSync(filename, "utf8");
  const script = new vm.Script(source, { filename });
  Object.assign(context, {
    module,
    exports: module.exports,
    process,
    console,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  script.runInNewContext(context);
  return module.exports;
}
