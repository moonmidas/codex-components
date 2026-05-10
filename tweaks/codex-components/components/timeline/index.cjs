function renderTimeline(body, section, context) {
  const { el, sectionWrap, toneClass } = context;
  const wrap = sectionWrap(section, "codexmod-timeline-section");
  const list = el("ol", { className: "codexmod-timeline" });
  for (const item of section.items || section.steps || []) {
    list.append(el("li", { className: `codexmod-timeline-item ${toneClass(item.tone || item.status)}` }, [
      el("span", { className: "codexmod-timeline-dot" }, [timelineIcon(item.status || item.tone)]),
      el("div", {}, [
        el("strong", {}, [item.title || item.label || "Step"]),
        item.body ? el("p", {}, [item.body]) : null,
        item.meta ? el("span", { className: "codexmod-timeline-meta" }, [item.meta]) : null,
      ]),
    ]));
  }
  wrap.append(list);
  body.append(wrap);
}

function timelineIcon(status) {
  const normalized = String(status || "").toLowerCase();
  if (["complete", "completed", "success", "done", "green", "teal"].includes(normalized)) return "✓";
  if (["warning", "blocked", "caution", "amber"].includes(normalized)) return "!";
  return "";
}

module.exports = { renderTimeline, timelineIcon };
