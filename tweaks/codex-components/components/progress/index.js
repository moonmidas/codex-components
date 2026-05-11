function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const items = section.items || [];
  const wrap = sectionWrap(section, "codexmod-progress-section");
  items.forEach((item, index) => {
    const value = Math.max(0, Math.min(100, Number(item.percent ?? item.value) || 0));
    const tone = item.tone || item.color || paletteTone(index);
    wrap.append(el("div", { className: `codexmod-progress ${toneClass(tone)}` }, [
      el("div", { className: "codexmod-progress-head" }, [
        el("span", {}, [item.label || item.name || "Progress"]),
        el("strong", {}, [`${value}%`]),
      ]),
      el("span", { className: "codexmod-progress-track" }, [
        el("span", { className: "codexmod-progress-fill", style: `width:${value}%` }),
      ]),
      item.body ? el("p", {}, [item.body]) : null,
    ]));
  });
  body.append(wrap);
}

function paletteTone(index) {
  return ["blue", "teal", "amber", "coral", "purple", "pink", "green"][index % 7];
}

module.exports = { type: "progress", render };
