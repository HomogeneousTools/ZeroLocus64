import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import katex from "katex";
import { marked } from "marked";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..");
const WEBSITE_ROOT = path.join(REPO_ROOT, "website");
const DIST_ROOT = path.join(WEBSITE_ROOT, "dist");

const PAGE_FILES = [
  ["index.html", "index.html"],
  ["index.html", "404.html"],
  ["index.html", path.join("decode", "index.html")],
];

const WEBSITE_FILES = [
  ["styles.css", "styles.css"],
  ["app.js", "app.js"],
  ["typesetting.js", "typesetting.js"],
];

const STATIC_COPIES = [
  [
    path.join(REPO_ROOT, "javascript", "src", "index.js"),
    path.join(DIST_ROOT, "assets", "index.js"),
  ],
  [
    path.join(REPO_ROOT, "javascript", "src", "presentation.js"),
    path.join(DIST_ROOT, "assets", "presentation.js"),
  ],
  [
    path.join(WEBSITE_ROOT, "favicon.png"),
    path.join(DIST_ROOT, "favicon.png"),
  ],
  [
    path.join(WEBSITE_ROOT, "favicon.svg"),
    path.join(DIST_ROOT, "favicon.svg"),
  ],
  [
    path.join(WEBSITE_ROOT, "logo-header.png"),
    path.join(DIST_ROOT, "logo-header.png"),
  ],
  [
    path.join(WEBSITE_ROOT, "logo-header.svg"),
    path.join(DIST_ROOT, "logo-header.svg"),
  ],
];

const STATIC_DIRECTORIES = [
  [
    path.join(REPO_ROOT, "javascript", "node_modules", "lie-js", "src"),
    path.join(DIST_ROOT, "assets", "vendor", "lie-js"),
  ],
  [
    path.join(
      REPO_ROOT,
      "javascript",
      "node_modules",
      "katex",
      "dist",
      "fonts",
    ),
    path.join(DIST_ROOT, "assets", "vendor", "katex", "fonts"),
  ],
];

const STATIC_VENDOR_FILES = [
  [
    path.join(
      REPO_ROOT,
      "javascript",
      "node_modules",
      "katex",
      "dist",
      "katex.mjs",
    ),
    path.join(DIST_ROOT, "assets", "vendor", "katex", "katex.mjs"),
  ],
  [
    path.join(
      REPO_ROOT,
      "javascript",
      "node_modules",
      "katex",
      "dist",
      "katex.min.css",
    ),
    path.join(DIST_ROOT, "assets", "vendor", "katex", "katex.min.css"),
  ],
  [
    path.join(
      REPO_ROOT,
      "javascript",
      "node_modules",
      "marked",
      "lib",
      "marked.esm.js",
    ),
    path.join(DIST_ROOT, "assets", "vendor", "marked.esm.js"),
  ],
];

const SPEC_TEMPLATE = path.join(WEBSITE_ROOT, "specification.html");
const SPEC_MARKDOWN = path.join(REPO_ROOT, "specification.md");
const REPOSITORY_BLOB_BASE =
  "https://github.com/HomogeneousTools/ZeroLocus62/blob/main";

const KATEX_OPTIONS = {
  displayMode: false,
  output: "html",
  strict: "ignore",
  throwOnError: false,
  trust: false,
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMath(latex, options = {}) {
  return katex.renderToString(String(latex).trim(), {
    ...KATEX_OPTIONS,
    ...options,
  });
}

function renderInlineMath(latex) {
  return renderMath(latex);
}

function renderDisplayMath(latex) {
  return renderMath(latex, { displayMode: true });
}

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
          text: match[1].trim(),
        };
      },
      renderer(token) {
        return `<div class="math-block-wrap">${renderDisplayMath(token.text)}</div>`;
      },
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
          text: match[1].trim(),
        };
      },
      renderer(token) {
        return renderInlineMath(token.text);
      },
    },
  ],
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function rewriteRepositoryLinks(html) {
  return html.replace(/<a\s+href="([^"]+)"/g, (match, href) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(href)) {
      return match;
    }
    const normalizedHref = href.replace(/^\.\//, "");
    return `<a href="${escapeHtml(`${REPOSITORY_BLOB_BASE}/${normalizedHref}`)}" target="_blank" rel="noreferrer"`;
  });
}

function linkWorkedExampleLabels(html) {
  return html.replace(
    /<td><code>([0-9A-Za-z._-]+)<\/code><\/td>/g,
    (_match, label) => {
      const encodedLabel = encodeURIComponent(label);
      return `<td><a class="example-link" href="decode/${encodedLabel}"><code>${escapeHtml(label)}</code></a></td>`;
    },
  );
}

function addHeadingIds(html) {
  const seen = new Map();
  const toc = [];
  const content = html.replace(
    /<h([123])>([\s\S]*?)<\/h\1>/g,
    (_match, level, inner) => {
      const text = stripHtml(inner);
      const base = slugify(text) || "section";
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      if (level === "2") {
        toc.push(
          `<a class="toc-level-h2" href="specification#${id}">${escapeHtml(text)}</a>`,
        );
      }
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );
  return { content, toc: toc.join("") };
}

async function renderSpecificationPage() {
  const [template, markdown] = await Promise.all([
    readFile(SPEC_TEMPLATE, "utf8"),
    readFile(SPEC_MARKDOWN, "utf8"),
  ]);
  const renderedMarkdown = linkWorkedExampleLabels(
    rewriteRepositoryLinks(marked.parse(markdown, { async: false })),
  );
  const { content, toc } = addHeadingIds(renderedMarkdown);
  return template
    .replace("{{SPEC_TOC}}", toc)
    .replace("{{SPEC_CONTENT}}", content);
}

export async function buildPagesSite() {
  await rm(DIST_ROOT, { recursive: true, force: true });
  await mkdir(path.join(DIST_ROOT, "assets", "vendor", "katex"), {
    recursive: true,
  });
  await mkdir(path.join(DIST_ROOT, "assets", "vendor", "lie-js"), {
    recursive: true,
  });
  await mkdir(path.join(DIST_ROOT, "decode"), { recursive: true });
  await mkdir(path.join(DIST_ROOT, "specification"), { recursive: true });

  for (const [sourceName, targetName] of PAGE_FILES) {
    await copyFile(
      path.join(WEBSITE_ROOT, sourceName),
      path.join(DIST_ROOT, targetName),
    );
  }

  for (const [sourceName, targetName] of WEBSITE_FILES) {
    await copyFile(
      path.join(WEBSITE_ROOT, sourceName),
      path.join(DIST_ROOT, targetName),
    );
  }

  await writeFile(
    path.join(DIST_ROOT, "specification", "index.html"),
    await renderSpecificationPage(),
    "utf8",
  );

  for (const [sourcePath, targetPath] of STATIC_COPIES) {
    await copyFile(sourcePath, targetPath);
  }

  for (const [sourcePath, targetPath] of STATIC_VENDOR_FILES) {
    await copyFile(sourcePath, targetPath);
  }

  for (const [sourcePath, targetPath] of STATIC_DIRECTORIES) {
    await cp(sourcePath, targetPath, { recursive: true });
  }

  await writeFile(path.join(DIST_ROOT, ".nojekyll"), "", "utf8");
  return DIST_ROOT;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const outputDirectory = await buildPagesSite();
  console.log(`Built static site in ${outputDirectory}`);
}
