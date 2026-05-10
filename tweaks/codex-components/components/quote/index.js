function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-pullquote-section");
  wrap.append(el("blockquote", { className: `codexmod-pullquote ${toneClass(section.tone || section.color)}` }, [
    el("p", {}, [section.quote || section.body || section.text || ""]),
    section.source ? el("cite", {}, [section.source]) : null,
  ]));
  body.append(wrap);
}

module.exports = { type: "quote", render };
