const ICON_GLYPHS = Object.freeze({
  alertcircle: "!",
  alerttriangle: "!",
  check: "✓",
  checkcircle: "✓",
  circlecheck: "✓",
  info: "i",
  infocircle: "i",
  lightbulb: "✦",
  sparkles: "✦",
  zap: "↯",
});

function iconGlyph(icon, fallback = "✦") {
  const key = String(icon || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return ICON_GLYPHS[key] || fallback;
}

module.exports = {
  iconGlyph,
};
