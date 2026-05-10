const { createYouTubeHelpers } = require("./youtube.js");

function createLinkPreviewHelpers({ el, isComposerSurface }) {
  const youtube = createYouTubeHelpers({ el, cleanLinkLabel });

  function enhanceLinksAndMedia(state) {
    if (!state.settings.mediaEmbeds && !state.settings.linkPreviews) return;
    youtube.cleanupVideoCards();
    document.querySelectorAll("a[href]").forEach((link) => {
      if (
        state.enhancedLinks.has(link)
        || link.dataset?.codexmodLinkEnhanced === "true"
        || link.closest?.(".codex-components, .codexmod-settings, .codexmod-link-card, table")
        || isComposerSurface(link)
      ) return;
      const href = link.href;
      const videoId = youtube.parseYouTubeUrl(href);
      if (videoId && state.settings.mediaEmbeds) {
        insertAfterLink(link, youtube.renderYouTubeEmbed(videoId, href, link.textContent || href), { hideStandaloneLink: true });
        state.enhancedLinks.add(link);
        return;
      }
      if (state.settings.linkPreviews && isPreviewableHttpUrl(href)) {
        insertAfterLink(link, renderLinkPreview(href, link.textContent || href));
        state.enhancedLinks.add(link);
      }
    });
  }

  function insertAfterLink(link, node, options = {}) {
    const paragraph = link.closest("p, li, div") || link;
    if (paragraph.nextElementSibling?.dataset?.codexmodLinkPreview === "true") {
      if (options.hideStandaloneLink) youtube.hideStandaloneLinkBlock(link, paragraph);
      return;
    }
    link.dataset.codexmodLinkEnhanced = "true";
    node.dataset.codexmodLinkPreview = "true";
    paragraph.after(node);
    if (options.hideStandaloneLink) youtube.hideStandaloneLinkBlock(link, paragraph);
  }

  function isPreviewableHttpUrl(href) {
    try {
      const url = new URL(href);
      return ["http:", "https:"].includes(url.protocol);
    } catch {
      return false;
    }
  }

  function renderLinkPreview(href, label) {
    const url = new URL(href);
    return el("section", { className: "codexmod-link-card" }, [
      el("div", { className: "codexmod-link-favicon" }, [url.hostname.slice(0, 1).toUpperCase()]),
      el("div", {}, [
        el("strong", {}, [cleanLinkLabel(label, url)]),
        el("span", {}, [url.hostname.replace(/^www\./, "")]),
      ]),
    ]);
  }

  function cleanLinkLabel(label, url) {
    const text = String(label || "").trim();
    if (!text || text === url.href) return url.hostname.replace(/^www\./, "");
    return text.length > 90 ? `${text.slice(0, 87)}...` : text;
  }

  return {
    cleanupVideoCards: youtube.cleanupVideoCards,
    enhanceLinksAndMedia,
    parseYouTubeUrl: youtube.parseYouTubeUrl,
    renderLinkPreview,
    renderYouTubeEmbed: youtube.renderYouTubeEmbed,
  };
}

module.exports = { createLinkPreviewHelpers };
