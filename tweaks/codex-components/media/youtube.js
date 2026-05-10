function createYouTubeHelpers({ el, cleanLinkLabel }) {
  function cleanupVideoCards() {
    document.querySelectorAll(".codexmod-video-card").forEach((card) => {
      const link = findAssociatedYouTubeLink(card);
      if (link) hideStandaloneLinkBlock(link);
      if (isCurrentVideoCard(card)) return;
      if (!link) return;
      const videoId = parseYouTubeUrl(link.href);
      if (!videoId) return;
      const replacement = renderYouTubeEmbed(videoId, link.href, link.textContent || link.href);
      replacement.dataset.codexmodLinkPreview = "true";
      link.dataset.codexmodLinkEnhanced = "true";
      card.replaceWith(replacement);
      hideStandaloneLinkBlock(link);
    });
  }

  function isCurrentVideoCard(card) {
    const hasCurrentSurface = card.querySelector?.(".codexmod-video-surface.codexmod-video-thumb");
    const hasLegacyChrome =
      card.querySelector?.(".codexmod-video-actions, .codexmod-video-framebar, .codexmod-video-meta")
      || /\b(Hide video|Open on YouTube)\b/i.test(card.textContent || "");
    return Boolean(hasCurrentSurface && !hasLegacyChrome);
  }

  function findAssociatedYouTubeLink(card) {
    const candidates = [];
    for (let node = card.previousElementSibling, hops = 0; node && hops < 4; node = node.previousElementSibling, hops += 1) {
      candidates.push(...Array.from(node.querySelectorAll?.("a[href]") || []));
      if (node.matches?.("a[href]")) candidates.push(node);
    }
    candidates.push(...Array.from(card.querySelectorAll?.("a[href]") || []));
    return candidates.find((link) => parseYouTubeUrl(link.href));
  }

  function hideStandaloneLinkBlock(link, block = link.closest("p, li, div")) {
    if (!isStandaloneLinkBlock(link, block)) return false;
    block.dataset.codexmodLinkSource = "youtube";
    block.style.display = "none";
    return true;
  }

  function isStandaloneLinkBlock(link, block) {
    if (!block || block === link) return false;
    const links = Array.from(block.querySelectorAll?.("a[href]") || []);
    if (links.length !== 1 || links[0] !== link) return false;
    const clone = block.cloneNode(true);
    clone.querySelector?.("a[href]")?.remove();
    return !(clone.textContent || "").trim();
  }

  function parseYouTubeUrl(href) {
    try {
      const url = new URL(href);
      if (url.hostname === "youtu.be") return url.pathname.slice(1);
      if (url.hostname.endsWith("youtube.com")) {
        if (url.pathname === "/watch") return url.searchParams.get("v");
        if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/") || url.pathname.startsWith("/live/")) return url.pathname.split("/")[2];
      }
    } catch {
      return null;
    }
    return null;
  }

  function renderYouTubeEmbed(videoId, href, label) {
    const safeId = encodeURIComponent(videoId);
    const url = new URL(href);
    const title = cleanLinkLabel(label, url);
    const host = url.hostname.replace(/^www\./, "");
    const card = el("section", { className: "codexmod-link-card codexmod-video-card" });
    renderYouTubePreview(card, safeId, href, title, host);
    return card;
  }

  function renderYouTubePreview(card, safeId, href, title, host) {
    card.className = "codexmod-link-card codexmod-video-card codexmod-video-card-preview";
    card.innerHTML = "";
    card.append(
      el("a", {
        className: "codexmod-video-surface codexmod-video-thumb",
        href,
        target: "_blank",
        rel: "noreferrer",
        "aria-label": `Open YouTube video: ${title}`,
      }, [
        el("img", {
          src: `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg`,
          alt: "YouTube video thumbnail",
          loading: "lazy",
        }),
        el("span", { className: "codexmod-video-play", "aria-hidden": "true" }, ["▶"]),
      ]),
      el("div", { className: "codexmod-video-overlay" }, [
        el("a", { className: "codexmod-video-title", href, target: "_blank", rel: "noreferrer" }, [title]),
        el("span", { className: "codexmod-video-domain" }, [host]),
      ]),
    );
  }

  return {
    cleanupVideoCards,
    hideStandaloneLinkBlock,
    parseYouTubeUrl,
    renderYouTubeEmbed,
  };
}

module.exports = { createYouTubeHelpers };
