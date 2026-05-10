function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-tags-section");
  wrap.append(el("div", { className: "codexmod-tag-cloud" }, (section.items || section.tags || []).map((tag) =>
    el("span", { className: `codexmod-pill ${toneClass(tag.tone || tag.color)}` }, [tag.label || tag]),
  )));
  body.append(wrap);
}

module.exports = { type: "tags", render };
