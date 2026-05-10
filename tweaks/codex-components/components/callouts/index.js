function render(body, section, helpers) {
  const { el, sectionWrap, toneClass } = helpers;
  const wrap = sectionWrap(section, "codexmod-numbered-section");
  for (const [index, item] of (section.items || []).entries()) {
    wrap.append(el("article", { className: `codexmod-numbered ${toneClass(item.tone || item.color || item.status)}` }, [
      el("div", { className: "codexmod-numbered-head" }, [
        el("span", { className: "codexmod-rank" }, [`#${item.rank || index + 1}`]),
        el("strong", { className: "codexmod-numbered-value" }, [String(item.value ?? item.metric ?? "")]),
        el("h5", {}, [item.title || item.label || "Finding"]),
      ]),
      item.body ? el("p", {}, [item.body]) : null,
      item.recommendation ? el("div", { className: "codexmod-recommendation-box" }, [item.icon || "Lightbulb", " ", item.recommendation]) : null,
    ]));
  }
  body.append(wrap);
}

module.exports = { type: "callouts", render };
