function render(body, section, helpers) {
  const { button, el, insertPrompt, sectionWrap } = helpers;
  const wrap = sectionWrap(section, "codexmod-actions-section");
  wrap.append(el("div", { className: "codexmod-actions" }, (section.items || section.actions || []).map((item) =>
    button(item.label || item.text || "Action", () => insertPrompt(item.prompt || item.text || item.label || "")),
  )));
  body.append(wrap);
}

module.exports = { type: "actions", render };
