const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const STYLE_LAYER_FILES = Object.freeze([
  "theme.css",
  "base.css",
  "primitives.css",
  "toolbar.css",
  "settings.css",
  "media.css",
  "html.css",
]);

function loadComponentCss(componentRoot = join(__dirname, "..")) {
  const stylesRoot = join(componentRoot, "styles");
  return STYLE_LAYER_FILES
    .map((file) => `/* ${file} */\n${readFileSync(join(stylesRoot, file), "utf8").trim()}`)
    .join("\n\n");
}

module.exports = {
  STYLE_LAYER_FILES,
  loadComponentCss,
};
