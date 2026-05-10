function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-comparison-section");
  const grid = el("div", { className: "codexmod-comparisons" });
  for (const item of section.items || section.cards || []) {
    grid.append(el("article", { className: `codexmod-comparison ${toneClass(item.tone || item.color)} ${item.featured || item.popular ? "is-featured" : ""}` }, [
      item.badge ? el("span", { className: `codexmod-pill ${toneClass(item.tone || item.color)}` }, [item.badge]) : null,
      el("h5", {}, [item.title || item.label || "Option"]),
      item.price || item.value ? el("strong", { className: "codexmod-comparison-value" }, [item.price || item.value]) : null,
      item.body ? el("p", {}, [item.body]) : null,
      item.features ? el("ul", {}, item.features.map((feature) => el("li", {}, [feature]))) : null,
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

module.exports = { type: "comparison", render };
