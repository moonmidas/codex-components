function renderTable(body, section, context) {
  const { el, sectionWrap } = context;
  const columns = normalizeColumns(section.columns);
  const table = el("table", { className: "codexmod-table" }, [
    el("thead", {}, [el("tr", {}, columns.map((column) => el("th", {}, [column.label || column.key])))]),
    el("tbody", {}, (section.rows || []).map((row) => (
      el("tr", {}, columns.map((column, index) => el("td", {}, [cellValue(row, column, index)])))
    ))),
  ]);
  const wrap = sectionWrap(section, "codexmod-table-section");
  wrap.append(table);
  body.append(wrap);
}

function normalizeColumns(columns) {
  return (Array.isArray(columns) ? columns : []).map((column) => {
    if (column && typeof column === "object") return column;
    return { key: String(column), label: String(column) };
  });
}

function cellValue(row, column, index) {
  if (Array.isArray(row)) return row[index] ?? "";
  if (!row || typeof row !== "object") return "";
  return row[column.key] ?? row[column.label] ?? "";
}

module.exports = { renderTable };
