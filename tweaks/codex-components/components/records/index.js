function render(body, section, helpers) {
  const { el, sectionWrap, toneClass, initials } = helpers;
  const wrap = sectionWrap(section, "codexmod-records-section");
  const grid = el("div", { className: "codexmod-records" });
  for (const record of section.items || section.records || []) {
    grid.append(el("article", { className: `codexmod-record ${toneClass(record.tone || record.status)}` }, [
      el("div", { className: "codexmod-record-head" }, [
        el("span", { className: "codexmod-avatar" }, [record.avatar || initials(record.title || record.name || "?")]),
        el("div", {}, [
          el("h5", {}, [record.title || record.name || "Record"]),
          record.subtitle ? el("p", {}, [record.subtitle]) : null,
        ]),
      ]),
      el("div", { className: "codexmod-record-fields" }, (record.fields || []).map((field) =>
        el("div", {}, [el("span", {}, [field.label || field.key || "Field"]), el("strong", {}, [field.value ?? ""])]),
      )),
      record.pills ? el("div", { className: "codexmod-pills" }, record.pills.map((pill) =>
        el("span", { className: `codexmod-pill ${toneClass(pill.tone || pill.color)}` }, [pill.label || pill]),
      )) : null,
    ]));
  }
  wrap.append(grid);
  body.append(wrap);
}

module.exports = { type: "records", render };
