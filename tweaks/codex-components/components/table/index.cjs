function renderTable(body, section, context) {
  const { el, sectionWrap } = context;
  const columns = normalizeColumns(section.columns);
  const table = el("table", { className: "codexmod-native-table" }, [
    el("thead", {}, [el("tr", {}, columns.map((column) => el("th", {}, [column.label || column.key])))]),
    el("tbody", {}, (section.rows || []).map((row) => (
      el("tr", {}, columns.map((column, index) => el("td", {}, [cellNode(row, column, index, el)])))
    ))),
  ]);
  const wrap = sectionWrap(section, "codexmod-table-section");
  wrap.append(el("div", { className: "codexmod-native-table-wrap" }, [table]));
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

function cellNode(row, column, index, el) {
  const value = cellValue(row, column, index);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const text = value.value ?? value.label ?? value.text ?? "";
    if (value.monospace || value.code || value.format === "code") return el("code", {}, [text]);
    return text;
  }
  const text = String(value ?? "");
  const backtickMatch = text.match(/^`([^`]+)`$/);
  if (backtickMatch) return el("code", {}, [backtickMatch[1]]);
  if (column.format === "code" || column.monospace || shouldAutoCode(column, text)) return el("code", {}, [text]);
  return text;
}

function shouldAutoCode(column, text) {
  const label = String(column.key || column.label || "").toLowerCase();
  return label === "component" && /^[a-z][a-z0-9_.:-]*$/i.test(text);
}

module.exports = { renderTable };
