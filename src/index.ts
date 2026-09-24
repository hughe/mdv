#!/usr/bin/env node
import * as http from "http";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import { buildPageForFile } from "./render";
import { escapeHtml } from "./util";

const USAGE = `mdv - markdown viewer with mermaid diagram support

Usage:
  mdv <markdown-file> [port]

Options:
  <markdown-file>  Path to a markdown (.md) file to render
  [port]           Optional port to listen on (default: 0 = random free port)
  -h, --help       Show this help

Starts a local web server rendering the file GitHub-style,
then opens the URL in your default browser.
`;

function fail(message: string): never {
  console.error(`error: ${message}\n`);
  console.error(USAGE);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let file: string | undefined;
  let port = 0;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    }
    if (file === undefined) {
      file = arg;
    } else {
      const parsed = Number(arg);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        fail(`invalid port: ${arg}`);
      }
      port = parsed;
    }
  }

  if (file === undefined) {
    fail("no markdown file given");
  }
  return { file, port };
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

/**
 * Serve relative assets (images etc.) from the markdown file's directory
 * so `![](image.png)` links resolve the same way they would on GitHub.
 */
async function serveAsset(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  baseDir: string,
  urlPath: string
): Promise<boolean> {
  const relative = decodeURIComponent(urlPath).replace(/^\/+/, "");
  if (relative.includes("..")) return false;

  const assetPath = path.join(baseDir, relative);
  if (!assetPath.startsWith(baseDir + path.sep)) return false;

  try {
    const stat = await fsp.stat(assetPath);
    if (!stat.isFile()) return false;

    const ext = path.extname(assetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(assetPath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function openUrl(url: string): void {
  // `open` (macOS) with fallbacks for other platforms.
  const candidates = process.platform === "darwin" ? ["open"] : ["xdg-open", "open"];
  for (const cmd of candidates) {
    try {
      const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
      child.on("error", () => {
        /* try next candidate on next tick */
      });
      child.unref();
      return;
    } catch {
      /* try next */
    }
  }
  console.log(`Could not open browser automatically; please visit: ${url}`);
}

function main(): void {
  const { file, port } = parseArgs(process.argv.slice(2));

  const absFile = path.resolve(file);
  if (!fs.existsSync(absFile) || !fs.statSync(absFile).isFile()) {
    fail(`file not found: ${file}`);
  }
  const baseDir = path.dirname(absFile);

  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0];

    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed");
        return;
      }

      // Serve the rendered markdown page.
      if (urlPath === "/" || urlPath === "/index.html") {
        const html = buildPageForFile(absFile);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(req.method === "HEAD" ? undefined : html);
        return;
      }

      // Serve relative assets (images, etc.) from the markdown's directory.
      if (await serveAsset(req, res, baseDir, urlPath)) {
        return;
      }

      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<h1>404 Not Found</h1><p>${escapeHtml(urlPath)} was not found next to <code>${escapeHtml(absFile)}</code></p>`
      );
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const addr = server.address();
    const actualPort = typeof addr === "object" && addr !== null ? addr.port : port;
    const url = `http://localhost:${actualPort}/`;
    console.log(`mdv: serving ${path.basename(absFile)} at ${url} (Ctrl+C to stop)`);
    openUrl(url);
  });

  process.on("SIGINT", () => {
    console.log("\nmdv: shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

main();