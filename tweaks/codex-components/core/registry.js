const componentModules = [
  require("../components/insights"),
  require("../components/bars"),
  require("../components/progress"),
  require("../components/callouts"),
  require("../components/records"),
  require("../components/alerts"),
  require("../components/comparison"),
  require("../components/quote"),
  require("../components/tags"),
  require("../components/recommendations"),
  require("../components/actions"),
];

const renderers = new Map();

for (const componentModule of componentModules) {
  registerComponentRenderer(componentModule.types || componentModule.type, componentModule.render);
}

function registerComponentRenderer(types, renderer) {
  const typeList = Array.isArray(types) ? types : [types];
  for (const type of typeList) {
    if (!type || typeof renderer !== "function") continue;
    renderers.set(type, renderer);
  }
}

function getComponentRenderer(type) {
  return renderers.get(type);
}

function hasComponentRenderer(type) {
  return renderers.has(type);
}

function registeredComponentTypes() {
  return Array.from(renderers.keys());
}

module.exports = {
  getComponentRenderer,
  hasComponentRenderer,
  registeredComponentTypes,
  registerComponentRenderer,
};
