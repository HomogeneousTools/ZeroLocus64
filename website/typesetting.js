import katex from "./assets/vendor/katex/katex.mjs";

const DEFAULT_KATEX_OPTIONS = {
  displayMode: false,
  output: "html",
  strict: "ignore",
  throwOnError: false,
  trust: false
};

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderMath(latex, options = {}) {
  return katex.renderToString(String(latex).trim(), {
    ...DEFAULT_KATEX_OPTIONS,
    ...options
  });
}

export function renderInlineMath(latex) {
  return renderMath(latex);
}

export function renderDisplayMath(latex) {
  return renderMath(latex, { displayMode: true });
}