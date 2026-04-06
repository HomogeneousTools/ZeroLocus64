import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPagesSite } from "./build-pages.mjs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = await buildPagesSite();
const PORT = Number(process.env.PORT ?? 4173);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function safeResolve(root, requestPath) {
  const resolved = path.resolve(root, `.${requestPath}`);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("path traversal is not allowed");
  }
  return resolved;
}

async function resolveRequest(pathname) {
  if (pathname === "/") {
    return path.join(WEBSITE_ROOT, "index.html");
  }
  if (pathname === "/decode" || pathname === "/decode/") {
    return path.join(WEBSITE_ROOT, "decode", "index.html");
  }
  if (pathname.startsWith("/decode/")) {
    return path.join(WEBSITE_ROOT, "decode", "index.html");
  }
  const cleanPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const directoryCandidate = safeResolve(WEBSITE_ROOT, cleanPath);
  try {
    const directoryStats = await stat(directoryCandidate);
    if (directoryStats.isDirectory()) {
      return path.join(directoryCandidate, "index.html");
    }
  } catch {
    // Fall through to the direct file path.
  }
  return safeResolve(WEBSITE_ROOT, pathname);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    let filePath = await resolveRequest(url.pathname);
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream"
    });
    response.end(body);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found\n");
      return;
    }
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Server error: ${error.message}\n`);
  }
});

server.listen(PORT, () => {
  console.log(`ZeroLocus64 site available at http://localhost:${PORT}`);
});