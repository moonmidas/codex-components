"use strict";

const COMPONENT_TYPES = Object.freeze([
  "group",
  "metrics",
  "insights",
  "funnel",
  "bars",
  "progress",
  "callouts",
  "records",
  "alerts",
  "comparison",
  "timeline",
  "quote",
  "tags",
  "table",
  "recommendations",
  "actions",
  "choices",
  "html",
]);

const COMPONENT_TYPE_SET = new Set(COMPONENT_TYPES);

function normalizeDescriptor(raw) {
  let descriptor;
  try {
    descriptor = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: `Invalid component JSON: ${error.message}` };
  }
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    return { ok: false, error: "Component descriptor must be an object." };
  }
  if (typeof descriptor.type !== "string" || !descriptor.type.trim()) {
    return { ok: false, error: "Component descriptor requires a type." };
  }
  if (typeof descriptor.version !== "number") {
    return { ok: false, error: "Component descriptor requires a numeric version." };
  }
  descriptor.type = descriptor.type.trim();
  descriptor = normalizeLegacyDescriptor(descriptor);
  if (!COMPONENT_TYPE_SET.has(descriptor.type)) {
    return { ok: false, error: `Unknown component type: ${descriptor.type}` };
  }
  return { ok: true, descriptor };
}

function isComponentLanguage(language) {
  return String(language || "").trim() === "codex-component";
}

function normalizeLegacyDescriptor(descriptor) {
  if (descriptor.type === "dashboard") return legacyDashboardToGroup(descriptor);
  return descriptor;
}

function legacyDashboardToGroup(dashboard) {
  return {
    type: "group",
    version: dashboard.version,
    title: dashboard.title,
    subtitle: dashboard.subtitle,
    components: (Array.isArray(dashboard.sections) ? dashboard.sections : [])
      .map(normalizeLegacySection)
      .filter(Boolean),
  };
}

function normalizeLegacySection(section) {
  if (!section || typeof section !== "object" || Array.isArray(section)) return null;
  const next = { ...section, version: section.version || 1 };

  if (next.type === "metric_strip") {
    next.type = "metrics";
    next.items = next.items || next.metrics || [];
    delete next.metrics;
    return next;
  }

  if (next.type === "bar_chart") {
    next.type = "bars";
    next.items = legacyChartItems(next);
    delete next.x;
    delete next.y;
    return next;
  }

  if (next.type === "numbered_callouts") {
    next.type = "callouts";
    return next;
  }

  if (next.type === "table") {
    const columns = Array.isArray(next.columns) ? next.columns : [];
    next.columns = columns.map((column) => {
      if (column && typeof column === "object") return column;
      return { key: String(column), label: String(column) };
    });
    next.rows = legacyTableRows(next.rows, next.columns);
    return next;
  }

  return next;
}

function legacyChartItems(section) {
  const labels = Array.isArray(section.x) ? section.x : [];
  const values = Array.isArray(section.y) ? section.y : [];
  if (!labels.length && Array.isArray(section.items)) return section.items;
  return labels.map((label, index) => ({
    label,
    value: values[index] ?? 0,
  }));
}

function legacyTableRows(rows, columns) {
  if (!Array.isArray(rows)) return [];
  const keys = columns.map((column) => column.key || column.label);
  return rows.map((row) => {
    if (!Array.isArray(row)) return row;
    return Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""]));
  });
}

module.exports = {
  COMPONENT_TYPES,
  COMPONENT_TYPE_SET,
  normalizeDescriptor,
  isComponentLanguage,
};
