function renderHtml(target, descriptor, raw, state, context) {
  const body = context.renderShell(target, descriptor, raw, state, "codexmod-html");
  mountHtmlFrame(body, descriptor, state, context);
}

function mountHtmlFrame(body, descriptor, state, context) {
  body.innerHTML = "";
  const frame = document.createElement("iframe");
  const bounds = htmlFrameBounds(descriptor, 520);
  frame.className = "codexmod-html-frame";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("scrolling", "yes");
  frame.srcdoc = buildHtmlDocument(descriptor.code || "", context);
  mountHtmlScrollbox(body, frame, bounds, state, context);
  attachFrameInteractionGuard(body, frame, context);
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data || {};
    if (data.method === "ui/notifications/size-changed" && data.params?.height) {
      applyHtmlFrameHeight(frame, bounds, data.params.height);
    } else if (data.method === "codex/send-prompt" && data.params?.text) {
      context.insertPrompt(String(data.params.text));
    } else if (data.method === "codex/open-link" && data.params?.url) {
      window.open(String(data.params.url), "_blank", "noopener,noreferrer");
    } else if (data.method === "codex/scroll-parent" && data.params?.deltaY) {
      scrollNearestContainer(frame, Number(data.params.deltaY) || 0);
    }
  };
  window.addEventListener("message", onMessage);
  state.disposers.push(() => window.removeEventListener("message", onMessage));
}

function mountHtmlScrollbox(body, frame, bounds, state, context) {
  const scrollbox = context.el("div", { className: "codexmod-html-scrollbox" });
  scrollbox.style.height = `${bounds.initial}px`;
  scrollbox.style.overflowY = "auto";
  scrollbox.style.overflowX = "hidden";
  scrollbox.style.overscrollBehavior = "contain";
  frame.style.height = `${bounds.initial}px`;
  scrollbox.append(frame);
  body.append(scrollbox);
  installHtmlScrollAssist(scrollbox, frame, state);
  return scrollbox;
}

function installHtmlScrollAssist(scrollbox, frame, state) {
  const onWheel = (event) => {
    if (frame.dataset.codexmodInteraction === "on") return;
    scrollHtmlFrame(scrollbox, event);
  };
  const onDocumentWheel = (event) => {
    if (frame.dataset.codexmodInteraction === "on") return;
    if (!isPointerInside(event, scrollbox)) return;
    scrollHtmlFrame(scrollbox, event);
  };
  scrollbox.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("wheel", onDocumentWheel, { passive: false, capture: true });
  state?.disposers?.push?.(() => {
    scrollbox.removeEventListener("wheel", onWheel);
    document.removeEventListener("wheel", onDocumentWheel, { capture: true });
  });
}

function scrollHtmlFrame(scrollbox, event) {
  if (!scrollElementBy(scrollbox, Number(event.deltaY) || 0)) return false;
  event.preventDefault?.();
  event.stopPropagation?.();
  return true;
}

function isPointerInside(event, node) {
  const rect = node.getBoundingClientRect?.();
  if (!rect) return false;
  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function htmlFrameBounds(descriptor, fallbackHeight) {
  const requested = positiveNumber(descriptor.height) || fallbackHeight;
  const explicitMax = positiveNumber(descriptor.max_height);
  const max = explicitMax || Math.min(Math.max(requested, 360), 720);
  const min = Math.min(requested, max);
  return { initial: min, min, max };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function applyHtmlFrameHeight(frame, bounds, measuredHeight) {
  const measured = positiveNumber(measuredHeight);
  const contentHeight = Math.max(bounds.min, measured || bounds.min);
  const viewportHeight = Math.min(bounds.max, contentHeight);
  const scrollbox = frame.closest?.(".codexmod-html-scrollbox");
  frame.style.height = `${contentHeight}px`;
  if (scrollbox) {
    scrollbox.style.height = `${viewportHeight}px`;
    scrollbox.classList.toggle("codexmod-html-scrollbox-scrollable", contentHeight > bounds.max);
  } else {
    frame.style.height = `${viewportHeight}px`;
    frame.classList.toggle("codexmod-html-frame-scrollable", contentHeight > bounds.max);
  }
}

function scrollNearestContainer(node, deltaY) {
  if (!deltaY) return;
  for (let current = node?.parentElement; current; current = current.parentElement) {
    if (isScrollableContainer(current) && scrollElementBy(current, deltaY)) return;
  }
  const scroller = document.scrollingElement || document.documentElement;
  if (!scrollElementBy(scroller, deltaY)) scroller.scrollTop += deltaY;
}

function isScrollableContainer(node) {
  if (!node) return false;
  if (node.classList?.contains("codexmod-html-scrollbox")) return node.scrollHeight > node.clientHeight;
  const style = getComputedStyle(node);
  return /(auto|scroll|overlay)/.test(style.overflowY || "") && node.scrollHeight > node.clientHeight;
}

function scrollElementBy(node, deltaY) {
  if (!node || !deltaY) return false;
  const maxScroll = Math.max(0, node.scrollHeight - node.clientHeight);
  if (maxScroll <= 1) return false;
  const current = node.scrollTop || 0;
  const next = Math.min(maxScroll, Math.max(0, current + deltaY));
  if (next === current) return false;
  node.scrollTop = next;
  return true;
}

function attachFrameInteractionGuard(container, frame, context, label = "Scroll-safe mode") {
  if (!container || frame.dataset.codexmodInteraction) return;
  frame.dataset.codexmodInteraction = "off";
  frame.style.pointerEvents = "none";
  const toggle = context.button("Enable interaction", () => {
    const active = frame.dataset.codexmodInteraction === "on";
    frame.dataset.codexmodInteraction = active ? "off" : "on";
    frame.style.pointerEvents = active ? "none" : "auto";
    toggle.textContent = active ? "Enable interaction" : "Disable interaction";
  });
  const guard = context.el("div", { className: "codexmod-html-guard" }, [
    context.el("span", {}, [label]),
    toggle,
  ]);
  const anchor = frame.closest?.(".codexmod-html-scrollbox") || frame;
  container.insertBefore(guard, anchor);
}

function buildHtmlDocument(componentCode, context = {}) {
  const code = sanitizeHtmlCode(componentCode);
  const tokens = context.htmlTokenStyle ? context.htmlTokenStyle() : "";
  const svgMode = code.trimStart().toLowerCase().startsWith("<svg");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><style>${tokens}
html,body{margin:0;padding:0;background:transparent;color:var(--color-text-primary);font:inherit;overflow:hidden;}
*{box-sizing:border-box}
a{color:inherit}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
</style></head><body>${code}<script>
(() => {
  window.sendPrompt = (text) => parent.postMessage({ method: "codex/send-prompt", params: { text: String(text || "") } }, "*");
  window.openLink = (url) => parent.postMessage({ method: "codex/open-link", params: { url: String(url || "") } }, "*");
  const contentHeight = () => Math.max(
    document.documentElement.scrollHeight || 0,
    document.body.scrollHeight || 0,
    document.documentElement.offsetHeight || 0,
    document.body.offsetHeight || 0,
    document.documentElement.getBoundingClientRect().height || 0,
    document.body.getBoundingClientRect().height || 0
  );
  const notifySize = () => parent.postMessage({ method: "ui/notifications/size-changed", params: { height: Math.ceil(contentHeight()) } }, "*");
  window.addEventListener("wheel", (event) => {
    const deltaY = Number(event.deltaY) || 0;
    if (!deltaY) return;
    event.preventDefault();
    parent.postMessage({ method: "codex/scroll-parent", params: { deltaY } }, "*");
  }, { passive: false });
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(notifySize).observe(document.body);
  } else {
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      notifySize();
      if (ticks >= 12) clearInterval(timer);
    }, 250);
  }
  window.addEventListener("load", notifySize);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(notifySize);
  else setTimeout(notifySize, 0);
  ${svgMode ? "document.body.style.display='inline-block';" : ""}
})();
</script></body></html>`;
}

function sanitizeHtmlCode(componentCode) {
  return String(componentCode || "")
    .replace(/<script\b([^>]*)\bsrc=(["'])(?!https:\/\/(?:cdnjs\.cloudflare\.com|esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)\/)[\s\S]*?<\/script>/gi, "")
    .replace(/\blocalStorage\b/g, "undefined")
    .replace(/\bsessionStorage\b/g, "undefined");
}

module.exports = {
  renderHtml,
  mountHtmlFrame,
  buildHtmlDocument,
  sanitizeHtmlCode,
  htmlFrameBounds,
  applyHtmlFrameHeight,
};
