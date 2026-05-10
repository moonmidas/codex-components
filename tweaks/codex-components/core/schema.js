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
  if (!COMPONENT_TYPE_SET.has(descriptor.type)) {
    return { ok: false, error: `Unknown component type: ${descriptor.type}` };
  }
  return { ok: true, descriptor };
}

function isComponentLanguage(language) {
  return String(language || "").trim() === "codex-component";
}

module.exports = {
  COMPONENT_TYPES,
  COMPONENT_TYPE_SET,
  normalizeDescriptor,
  isComponentLanguage,
};
