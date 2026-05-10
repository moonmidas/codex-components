function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const items = section.items || [];
  const wrap = sectionWrap(section, "codexmod-progress-section");
  for (const item of items) {
    const value = Math.max(0, Math.min(100, Number(item.percent ?? item.value) || 0));
    wrap.append(el("div", { className: `codexmod-progress ${toneClass(item.tone || item.color)}` }, [
      el("div", { className: "codexmod-progress-head" }, [
        el("span", {}, [item.label || item.name || "Progress"]),
        el("strong", {}, [`${value}%`]),
      ]),
      el("span", { className: "codexmod-progress-track" }, [
        el("span", { className: "codexmod-progress-fill", style: `width:${value}%` }),
      ]),
      item.body ? el("p", {}, [item.body]) : null,
    ]));
  }
  body.append(wrap);
}

module.exports = { type: "progress", render };
