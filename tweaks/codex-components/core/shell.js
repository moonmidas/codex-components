"use strict";

const { el, button } = require("./dom.js");

function createShellHelpers({ copyText } = {}) {
  function renderShell(target, descriptor, raw, state, className) {
    target.innerHTML = "";
    const shell = el("section", { className: `codexmod-component ${className}` });
    const header = el("header", { className: "codexmod-component-header" }, [
      el("div", {}, [
        el("h3", { className: "codexmod-component-title" }, [descriptor.title || "Component"]),
        descriptor.subtitle ? el("p", { className: "codexmod-component-subtitle" }, [descriptor.subtitle]) : null,
      ]),
      toolbar(descriptor, raw, state),
    ]);
    const body = el("div", { className: "codexmod-component-body" });
    shell.append(header, body);
    target.append(shell);
    return body;
  }

  function toolbar(descriptor, raw, state) {
    const bar = el("div", { className: "codexmod-component-toolbar" });
    const copy = button("Copy", () => copyText?.(raw || JSON.stringify(descriptor, null, 2), state));
    copy.setAttribute("aria-label", "Copy component JSON");
    copy.setAttribute("title", "Copy component JSON");
    bar.append(copy);
    return bar;
  }

  return {
    renderShell,
    toolbar,
    sectionWrap,
    withoutSectionTitle,
  };
}

function sectionWrap(section, className) {
  return el("section", { className: `codexmod-section ${className}` }, [
    section.title ? el("h4", { className: "codexmod-section-title" }, [section.title]) : null,
  ]);
}

function withoutSectionTitle(descriptor) {
  if (!descriptor?.title) return descriptor;
  return { ...descriptor, title: "" };
}

module.exports = {
  createShellHelpers,
  sectionWrap,
  withoutSectionTitle,
};
