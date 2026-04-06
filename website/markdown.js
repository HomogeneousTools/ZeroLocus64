import { marked } from "./assets/vendor/marked.esm.js";

import { renderDisplayMath, renderInlineMath } from "./typesetting.js";

marked.use({
  gfm: true,
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start(source) {
        const index = source.indexOf("$$");
        return index >= 0 ? index : undefined;
      },
      tokenizer(source) {
        const match = /^\$\$\s*\n?([\s\S]+?)\n?\$\$(?:\n|$)/.exec(source);
        if (!match) {
          return undefined;
        }
        return {
          type: "blockMath",
          raw: match[0],
          text: match[1].trim()
        };
      },
      renderer(token) {
        return `<div class="math-block-wrap">${renderDisplayMath(token.text)}</div>`;
      }
    },
    {
      name: "inlineMath",
      level: "inline",
      start(source) {
        const index = source.indexOf("$");
        return index >= 0 ? index : undefined;
      },
      tokenizer(source) {
        const match = /^\$((?:\\\$|[^$\n])+?)\$(?!\$)/.exec(source);
        if (!match) {
          return undefined;
        }
        return {
          type: "inlineMath",
          raw: match[0],
          text: match[1].trim()
        };
      },
      renderer(token) {
        return renderInlineMath(token.text);
      }
    }
  ]
});

export function renderMarkdown(markdown) {
  return marked.parse(markdown, { async: false });
}