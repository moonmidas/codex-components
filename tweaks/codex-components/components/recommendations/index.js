function render(body, section, helpers) {
  const { el, sectionWrap } = helpers;
  const wrap = sectionWrap(section, "codexmod-recommendations-section");
  wrap.append(el("ul", { className: "codexmod-recommendations" }, (section.items || []).map((item) =>
    el("li", {}, [el("strong", {}, [item.title || item.label || "Recommendation"]), item.body ? el("p", {}, [item.body]) : null]),
  )));
  body.append(wrap);
}

module.exports = { type: "recommendations", render };
