import { renderMarkdown } from "./markdown.js";
import { escapeHtml } from "./typesetting.js";

const statusPanel = document.querySelector("#specification-status");
const content = document.querySelector("#specification-content");
const toc = document.querySelector("#toc");

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setStatus(message, variant = "default") {
  statusPanel.textContent = message;
  statusPanel.hidden = false;
  statusPanel.classList.remove("is-error", "is-success");
  if (variant === "error") {
    statusPanel.classList.add("is-error");
  }
  if (variant === "success") {
    statusPanel.classList.add("is-success");
  }
}

function assignHeadingIds() {
  const seen = new Map();
  [...content.querySelectorAll("h1, h2, h3")].forEach((heading) => {
    const base = slugify(heading.textContent ?? "section") || "section";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    heading.id = count === 1 ? base : `${base}-${count}`;
  });
}

function buildToc() {
  const headings = [...content.querySelectorAll("h2, h3")];
  toc.innerHTML = headings
    .map(
      (heading) =>
        `<a class="toc-level-${heading.tagName.toLowerCase()}" href="#${heading.id}">${escapeHtml(heading.textContent ?? "")}</a>`,
    )
    .join("");
}

async function loadSpecification() {
  try {
    const response = await fetch(
      new URL("./specification.md", import.meta.url),
    );
    if (!response.ok) {
      throw new Error(`Unable to fetch specification.md (${response.status})`);
    }
    const markdown = await response.text();
    content.innerHTML = renderMarkdown(markdown);
    assignHeadingIds();
    buildToc();
    statusPanel.hidden = true;
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : "Unable to load the specification.",
      "error",
    );
  }
}

loadSpecification();
