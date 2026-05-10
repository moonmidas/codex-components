function renderGroup(target, descriptor, raw, state, context) {
  const body = context.renderShell(target, descriptor, raw, state, "codexmod-group");
  const components = Array.isArray(descriptor.components) ? descriptor.components : [];
  if (!components.length) {
    context.renderCallout(body, { body: "No components provided." });
    return;
  }

  for (const child of components) {
    const childMount = context.el("div", { className: "codexmod-group-child" });
    const childRaw = JSON.stringify(child, null, 2);
    body.append(childMount);
    const result = context.normalizeDescriptor(childRaw, "codex-component");
    if (!result.ok) {
      context.renderError(childMount, result.error, childRaw);
      continue;
    }
    context.renderComponent(childMount, result.descriptor, childRaw, state, { embedded: true });
  }
}

module.exports = { renderGroup };
