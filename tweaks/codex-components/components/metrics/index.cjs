function renderMetrics(body, section, context) {
  const { el, sectionWrap, toneClass } = context;
  const wrap = sectionWrap(section, "codexmod-metrics-section");
  const grid = el("div", { className: "codexmod-metrics" });
  (section.items || section.metrics || []).forEach((item, index) => {
    const tone = item.tone || item.color || paletteTone(index);
    grid.append(el("article", { className: `codexmod-metric ${toneClass(tone)}` }, [
      el("span", { className: "codexmod-label" }, [item.label || item.name || "Metric"]),
      el("strong", { className: "codexmod-value" }, [String(item.value ?? "")]),
      item.sparkline ? renderSparkline(item.sparkline, tone, context) : null,
      item.delta ? el("span", { className: "codexmod-note" }, [trendIcon(item.trend || item.status), item.delta]) : null,
    ]));
  });
  wrap.append(grid);
  body.append(wrap);
}

function renderSparkline(values, tone, context) {
  const { el, toneClass } = context;
  const nums = Array.isArray(values) ? values.map(Number).filter((value) => Number.isFinite(value)) : [];
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const points = nums.map((value, index) => {
    const x = (index / (nums.length - 1)) * 100;
    const y = 28 - ((value - min) / range) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return el("svg", { className: `codexmod-sparkline ${toneClass(tone)}`, viewBox: "0 0 100 32", role: "img" }, [
    el("polyline", { points, fill: "none", "stroke-width": "3", "stroke-linecap": "round", "stroke-linejoin": "round" }),
  ]);
}

function trendIcon(trend) {
  const normalized = String(trend || "").toLowerCase();
  if (["up", "increase", "good"].includes(normalized)) return "↗ ";
  if (["down", "decrease", "bad"].includes(normalized)) return "↘ ";
  if (["warning", "caution"].includes(normalized)) return "⚠ ";
  return "";
}

function paletteTone(index) {
  return ["blue", "teal", "amber", "purple", "coral", "pink", "green"][index % 7];
}

module.exports = { renderMetrics, renderSparkline, trendIcon };
