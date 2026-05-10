"use strict";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    if (key === "className") node.className = value;
    else if (key === "onclick") node.addEventListener("click", value);
    else if (key === "style") node.setAttribute("style", value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function button(label, onClick) {
  return el("button", { type: "button", onclick: onClick }, [label]);
}

module.exports = {
  el,
  button,
};
