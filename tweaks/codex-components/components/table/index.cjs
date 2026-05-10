function renderTable(body, section, context) {
  const { el, sectionWrap } = context;
  const columns = section.columns || [];
  const table = el("table", { className: "codexmod-table" }, [
    el("thead", {}, [el("tr", {}, columns.map((c) => el("th", {}, [c.label || c.key || c])))]),
    el("tbody", {}, (section.rows || []).map((row) => el("tr", {}, columns.map((c) => el("td", {}, [row[c.key || c] ?? ""]))))),
  ]);
  const wrap = sectionWrap(section, "codexmod-table-section");
  wrap.append(table);
  body.append(wrap);
}

module.exports = { renderTable };
