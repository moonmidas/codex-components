function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-recommendations-section");
  wrap.append(el("ul", { className: "codexmod-recommendations" }, (section.items || []).map((item, index) => {
    const tone = item.tone || item.color || paletteTone(index);
    return el("li", { className: `codexmod-recommendation-row ${toneClass(tone)}` }, [
      el("span", { className: "codexmod-recommendation-row-icon" }, [item.icon || String(index + 1)]),
      el("div", { className: "codexmod-recommendation-row-copy" }, [
        el("strong", {}, [item.title || item.label || "Recommendation"]),
        item.body ? el("p", {}, [item.body]) : null,
      ]),
      el("span", { className: "codexmod-recommendation-row-arrow", "aria-hidden": "true" }, [">"]),
    ]);
  })));
  body.append(wrap);
}

function paletteTone(index) {
  return ["blue", "teal", "amber", "purple", "coral", "pink", "green"][index % 7];
}

module.exports = { type: "recommendations", render };
