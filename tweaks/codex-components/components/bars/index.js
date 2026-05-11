function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const items = section.items || section.bars || section.steps || [];
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  const wrap = sectionWrap(section, "codexmod-bars-section");
  items.forEach((item, index) => {
    const tone = item.tone || item.color || paletteTone(index);
    wrap.append(el("div", { className: `codexmod-bar-row ${toneClass(tone)}` }, [
      el("span", { className: "codexmod-bar-label" }, [item.label || item.name || "Item"]),
      el("span", { className: "codexmod-bar-track" }, [
        el("span", {
          className: "codexmod-bar-fill",
          style: `width:${Math.max(3, ((Number(item.value) || 0) / max) * 100)}%`,
        }),
      ]),
      el("strong", { className: "codexmod-bar-value" }, [String(item.value ?? "")]),
    ]));
  });
  body.append(wrap);
}

function paletteTone(index) {
  return ["blue", "teal", "amber", "coral", "purple", "pink", "green"][index % 7];
}

module.exports = { types: ["funnel", "bars"], render };
