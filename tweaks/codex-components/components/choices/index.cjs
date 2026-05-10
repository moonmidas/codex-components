function renderChoices(target, descriptor, raw, state, context) {
  const { el, insertPrompt, renderShell } = context;
  const body = renderShell(target, descriptor, raw, state, "codexmod-choices");
  const options = Array.isArray(descriptor.options) ? descriptor.options : [];
  body.append(el("div", { className: "codexmod-choices-options" }, options.map((option, index) =>
    el("button", { type: "button", className: "codexmod-choices-option", onclick: () => insertPrompt(option.prompt || option.label || "") }, [
      el("span", {}, [String(index + 1)]),
      el("div", { className: "codexmod-choices-option-copy" }, [
        el("strong", {}, [option.label || option.title || `Option ${index + 1}`]),
        option.description || option.body ? el("small", {}, [option.description || option.body]) : null,
      ]),
    ]),
  )));
}

module.exports = { renderChoices };
