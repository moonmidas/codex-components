const { iconGlyph } = require("../../core/icons.js");

function render(body, section, helpers) {
  const { alertIcon, el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-alerts-section");
  for (const item of section.items || section.alerts || []) {
    const fallback = alertIcon(item.tone || item.status);
    wrap.append(el("article", { className: `codexmod-alert ${toneClass(item.tone || item.status || item.color)}` }, [
      el("span", { className: "codexmod-alert-icon" }, [iconGlyph(item.icon, fallback)]),
      el("div", {}, [
        el("strong", {}, [item.title || item.label || "Note"]),
        item.body ? el("p", {}, [item.body]) : null,
      ]),
    ]));
  }
  body.append(wrap);
}

module.exports = { type: "alerts", render };
