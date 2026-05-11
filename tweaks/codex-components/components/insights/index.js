function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-insights-section");
  const grid = el("div", { className: "codexmod-insights" });
  (section.items || section.insights || []).forEach((item, index) => {
    const tone = item.tone || item.color || paletteTone(index);
    grid.append(el("article", { className: `codexmod-insight ${toneClass(tone)}` }, [
      el("h5", {}, [item.title || item.label || "Insight"]),
      el("p", {}, [item.body || item.text || item.value || ""]),
    ]));
  });
  wrap.append(grid);
  body.append(wrap);
}

function paletteTone(index) {
  return ["blue", "teal", "purple", "amber", "coral", "pink", "green"][index % 7];
}

module.exports = { type: "insights", render };
