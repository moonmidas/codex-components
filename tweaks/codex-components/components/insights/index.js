function render(body, section, helpers) {
  const { el, sectionWrap } = helpers;
  const wrap = sectionWrap(section, "codexmod-insights-section");
  const grid = el("div", { className: "codexmod-insights" });
  for (const item of section.items || section.insights || []) {
    grid.append(el("article", { className: "codexmod-insight" }, [
      el("h5", {}, [item.title || item.label || "Insight"]),
      el("p", {}, [item.body || item.text || item.value || ""]),
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

module.exports = { type: "insights", render };
