function createUpdateChecks({
  currentVersion,
  updateCacheKey,
  updateManifestUrl,
  updateCheckIntervalMs,
  getRenderSettingsPage,
}) {
  function startUpdateChecks(state) {
    checkForUpdates(state, { force: true });
    const timer = setInterval(() => checkForUpdates(state, { force: true }), updateCheckIntervalMs);
    state.disposers.push(() => clearInterval(timer));
  }

  function defaultUpdateCheck() {
    return {
      status: "idle",
      installedVersion: currentVersion,
      latestVersion: "",
      checkedAt: 0,
      error: "",
    };
  }

  function loadUpdateCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(updateCacheKey) || "{}");
      if (!cached || typeof cached !== "object") return defaultUpdateCheck();
      return { ...defaultUpdateCheck(), ...cached, installedVersion: currentVersion };
    } catch {
      return defaultUpdateCheck();
    }
  }

  function saveUpdateCache(updateCheck) {
    try {
      localStorage.setItem(updateCacheKey, JSON.stringify(updateCheck));
    } catch {
      // Non-critical: update checks should never break rendering.
    }
  }

  async function checkForUpdates(state, options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();
    if (!force && state.updateCheck?.checkedAt && now - state.updateCheck.checkedAt < updateCheckIntervalMs) {
      return state.updateCheck;
    }
    if (state.updatePromise) return state.updatePromise;

    const previous = state.updateCheck || defaultUpdateCheck();
    state.updateCheck = { ...previous, status: "checking", installedVersion: currentVersion, error: "" };
    rerenderSettings(state);

    state.updatePromise = (async () => {
      try {
        if (typeof fetch !== "function") throw new Error("Fetch is unavailable in this renderer.");
        const response = await fetch(updateManifestUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const manifest = normalizeManifestResponse(await response.json());
        const latestVersion = String(manifest?.version || "").trim();
        if (!latestVersion) throw new Error("Remote manifest did not include a version.");
        const comparison = compareVersions(latestVersion, currentVersion);
        const next = {
          status: comparison > 0 ? "available" : "up_to_date",
          installedVersion: currentVersion,
          latestVersion,
          checkedAt: Date.now(),
          error: "",
        };
        state.updateCheck = next;
        saveUpdateCache(next);
        return next;
      } catch (error) {
        const next = {
          ...previous,
          status: "error",
          installedVersion: currentVersion,
          checkedAt: Date.now(),
          error: error?.message || "Unable to check for updates.",
        };
        state.updateCheck = next;
        saveUpdateCache(next);
        state.api.log.warn("Codex Components update check failed", error);
        return next;
      } finally {
        state.updatePromise = null;
        rerenderSettings(state);
      }
    })();

    return state.updatePromise;
  }

  function rerenderSettings(state) {
    if (!state.pageRoot) return;
    getRenderSettingsPage()(state.pageRoot, state);
  }

  function compareVersions(a, b) {
    const left = parseVersionParts(a);
    const right = parseVersionParts(b);
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const diff = (left[index] || 0) - (right[index] || 0);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  function parseVersionParts(version) {
    return String(version || "")
      .split(/[.-]/)
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part));
  }

  function normalizeManifestResponse(payload) {
    if (payload?.version) return payload;
    if (payload?.encoding === "base64" && typeof payload.content === "string") {
      const json = decodeBase64(payload.content.replace(/\s/g, ""));
      return JSON.parse(json);
    }
    return payload;
  }

  function decodeBase64(value) {
    if (typeof atob === "function") return atob(value);
    if (typeof Buffer !== "undefined") return Buffer.from(value, "base64").toString("utf8");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let index = 0;
    while (index < value.length) {
      const enc1 = chars.indexOf(value.charAt(index++));
      const enc2 = chars.indexOf(value.charAt(index++));
      const enc3 = chars.indexOf(value.charAt(index++));
      const enc4 = chars.indexOf(value.charAt(index++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    try {
      return decodeURIComponent(escape(output));
    } catch {
      return output;
    }
  }

  function activeCodexPlusPlusHome() {
    const tweaksDir = String(window.__codexpp_tweaks_dir__ || "").trim();
    if (!tweaksDir) return "";
    return tweaksDir.replace(/\/tweaks\/?$/, "");
  }

  function updatePromptText(latestVersion = "", codexPlusPlusHome = "") {
    const versionLine = latestVersion ? ` Latest detected version: ${latestVersion}.` : "";
    const homeLine = codexPlusPlusHome
      ? ` Use this exact active Codex++ home when running the installer: CODEX_PLUSPLUS_HOME="${codexPlusPlusHome}".`
      : " If Codex++ is using a copied app home, detect and update that active home instead of assuming the default codex-plusplus folder.";
    return `Update Codex Components from GitHub:
https://github.com/moonmidas/codex-components

Please inspect the README and installer first, then run the macOS installer.${versionLine}${homeLine} Preserve existing Codex++ settings and tell me when to restart Codex++.`;
  }

  return {
    activeCodexPlusPlusHome,
    checkForUpdates,
    compareVersions,
    defaultUpdateCheck,
    loadUpdateCache,
    normalizeManifestResponse,
    startUpdateChecks,
    updatePromptText,
  };
}

module.exports = { createUpdateChecks };
