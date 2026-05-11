function createUpdateChecks({
  currentCommit,
  currentVersion,
  updateCacheKey,
  updateCommitUrl,
  updateCheckIntervalMs,
  getRenderSettingsPage,
}) {
  function startUpdateChecks(state) {
    const timer = setInterval(() => checkForUpdates(state, { force: false }), updateCheckIntervalMs);
    state.disposers.push(() => clearInterval(timer));
  }

  function defaultUpdateCheck() {
    return {
      status: "idle",
      installedCommit: currentCommit,
      installedVersion: currentVersion,
      latestCommit: "",
      latestCommitUrl: "",
      checkedAt: 0,
      error: "",
    };
  }

  function loadUpdateCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(updateCacheKey) || "{}");
      if (!cached || typeof cached !== "object") return defaultUpdateCheck();
      return {
        ...defaultUpdateCheck(),
        ...cached,
        installedCommit: currentCommit,
        installedVersion: currentVersion,
      };
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
    state.updateCheck = {
      ...previous,
      status: "checking",
      installedCommit: currentCommit,
      installedVersion: currentVersion,
      error: "",
    };
    rerenderSettings(state);

    state.updatePromise = (async () => {
      try {
        if (typeof fetch !== "function") throw new Error("Fetch is unavailable in this renderer.");
        const response = await fetch(updateCommitUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const commit = normalizeCommitResponse(await response.json());
        const latestCommit = String(commit?.sha || "").trim();
        if (!latestCommit) throw new Error("Remote commit response did not include a SHA.");
        const next = {
          status: isSameCommit(latestCommit, currentCommit) ? "up_to_date" : "available",
          installedCommit: currentCommit,
          installedVersion: currentVersion,
          latestCommit,
          latestCommitUrl: String(commit?.html_url || "").trim(),
          checkedAt: Date.now(),
          error: "",
        };
        state.updateCheck = next;
        saveUpdateCache(next);
        return next;
      } catch (error) {
        const next = {
          ...previous,
          status: "manual",
          installedCommit: currentCommit,
          installedVersion: currentVersion,
          checkedAt: Date.now(),
          error: "",
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

  function normalizeCommitResponse(payload) {
    if (Array.isArray(payload)) return payload[0] || {};
    if (payload?.sha) return payload;
    if (payload?.object?.sha) {
      return {
        sha: payload.object.sha,
        html_url: payload.object.html_url || payload.object.url || payload.html_url || "",
      };
    }
    return payload;
  }

  function isSameCommit(left, right) {
    const a = cleanCommit(left);
    const b = cleanCommit(right);
    if (!a || !b) return false;
    return a === b || a.startsWith(b) || b.startsWith(a);
  }

  function cleanCommit(value) {
    const commit = String(value || "").trim();
    if (!commit || commit === "__CODEX_COMPONENTS_COMMIT__" || commit === "unknown") return "";
    return commit;
  }

  function activeCodexPlusPlusHome() {
    const tweaksDir = String(window.__codexpp_tweaks_dir__ || "").trim();
    if (!tweaksDir) return "";
    return tweaksDir.replace(/\/tweaks\/?$/, "");
  }

  function updatePromptText(latestCommit = "", codexPlusPlusHome = "") {
    const commitLine = latestCommit ? ` Latest detected commit: ${latestCommit}.` : "";
    const homeLine = codexPlusPlusHome
      ? ` Use this exact active Codex++ home when running the installer: CODEX_PLUSPLUS_HOME="${codexPlusPlusHome}".`
      : " If Codex++ is using a copied app home, detect and update that active home instead of assuming the default codex-plusplus folder.";
    return `Update Codex Components from GitHub:
https://github.com/moonmidas/codex-components

Please inspect the README and installer first, then run the macOS installer.${commitLine}${homeLine} Preserve existing Codex++ settings and tell me when to restart Codex++.`;
  }

  return {
    activeCodexPlusPlusHome,
    checkForUpdates,
    defaultUpdateCheck,
    loadUpdateCache,
    normalizeCommitResponse,
    startUpdateChecks,
    updatePromptText,
  };
}

module.exports = { createUpdateChecks };
