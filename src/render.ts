import { Marked } from "marked";
import hljs from "highlight.js";
import * as fs from "fs";
import * as path from "path";
import { escapeHtml } from "./util";

const marked = new Marked({
  gfm: true,
  breaks: false,
});

const renderer = {
  // Render fenced code blocks. Mermaid blocks become <pre class="mermaid">
  // so the mermaid.js script can render them into SVG diagrams.
  code({ text, lang }: { text: string; lang?: string }) {
    const language = (lang || "").trim().toLowerCase();

    if (language === "mermaid") {
      // Mermaid parses the raw source itself; keep it unescaped.
      return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
    }

    if (language && hljs.getLanguage(language)) {
      const highlighted = hljs.highlight(text, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
    }

    return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`;
  },
};

marked.use({ renderer });

const FRONT_MATTER_RE =
  /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

interface FrontMatter {
  properties: Map<string, string[]>;
  body: string;
}

/**
 * Strip a leading YAML front matter block (Obsidian-style properties) from
 * the document. Returns null when the document does not start with one.
 */
function splitFrontMatter(markdown: string): FrontMatter | null {
  const m = markdown.match(FRONT_MATTER_RE);
  if (!m) return null;
  const properties = parseFrontMatter(m[1]);
  if (!properties) return null;
  return { properties, body: markdown.slice(m[0].length) };
}

/**
 * Minimal YAML subset parser for front matter: scalars, quoted strings,
 * inline arrays (`[a, b]`), and block lists (`- item`). Nested maps are not
 * supported; on anything unparseable it returns null so the document is
 * rendered as-is.
 */
function parseFrontMatter(text: string): Map<string, string[]> | null {
  const properties = new Map<string, string[]>();
  let lastKey: string | null = null;

  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;

    // Block list item belonging to the previous key.
    const listItem = raw.match(/^\s+-\s+(.*)$/);
    if (listItem) {
      if (lastKey === null) return null;
      properties.get(lastKey)!.push(parseScalar(listItem[1]));
      continue;
    }

    // Anything else indented (nested maps, etc.) is unsupported.
    if (/^\s+/.test(raw)) return null;

    const kv = raw.match(/^([^:]+):(?:[ \t]+(.*))?$/);
    if (!kv) return null;

    const key = kv[1].trim();
    let value = (kv[2] ?? "").trim();

    if (value.startsWith("[")) {
      // Inline array: split on commas, respecting double quotes.
      const inner = value.replace(/^\[|\]$/g, "");
      const items = inner
        .match(/"[^"]*"|[^,]+/g)
        ?.map((item) => parseScalar(item.trim())) ?? [];
      properties.set(key, items);
    } else {
      properties.set(key, value === "" ? [] : [parseScalar(value)]);
    }
    lastKey = key;
  }

  return properties.size > 0 ? properties : null;
}

/** Strip surrounding quotes and trailing comments from a scalar value. */
function parseScalar(value: string): string {
  if (/^"[^"]*"$/.test(value) || /^'[^']*'$/.test(value)) {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, "").trim();
}

/**
 * Render front matter properties as a headerless two-column table with
 * bold keys, similar to how GitHub renders front matter.
 */
function renderFrontMatterTable(properties: Map<string, string[]>): string {
  const cell = (text: string) =>
    escapeHtml(text).replace(/\|/g, "&#124;");
  const rows = [...properties]
    .map(
      ([key, values]) =>
        `<tr><td><strong>${cell(key)}</strong></td><td>${cell(
          values.join(", ")
        )}</td></tr>`
    )
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

export function renderMarkdown(markdown: string): string {
  const frontMatter = splitFrontMatter(markdown);
  let tableHtml = "";
  if (frontMatter) {
    tableHtml = renderFrontMatterTable(frontMatter.properties) + "\n";
    markdown = frontMatter.body;
  }
  const html = marked.parse(markdown, { async: false }) as string;
  const body = tableHtml + html;
  // marked emits GFM task list checkboxes but not the `task-list-item` class
  // that github-markdown-css relies on to hide the list bullet.
  return body.replace(
    /<li><input (checked="" )?disabled="" type="checkbox">/g,
    (match) => match.replace("<li>", '<li class="task-list-item">')
  );
}

/**
 * Wrap rendered markdown HTML in a full page styled like GitHub.
 * Uses the same CDN assets GitHub-like renderers commonly rely on:
 * github-markdown-css, highlight.js github theme, and mermaid.
 *
 * In watch mode, a small client script connects back to the server over a
 * websocket and reloads the page when the server says the file changed.
 */
export function renderPage(
  markdown: string,
  title: string,
  opts: { watch?: boolean } = {}
): string {
  const body = renderMarkdown(markdown);
  const watchScript = opts.watch
    ? `<script>
(function () {
  var proto = location.protocol === "https:" ? "wss:" : "ws:";
  var ws = new WebSocket(proto + "//" + location.host);
  ws.onmessage = function (e) {
    try { if (JSON.parse(e.data).type === "changed") location.reload(); } catch (err) { /* ignore */ } };
})();
</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>
  body {
    box-sizing: border-box;
    background-color: #ffffff;
    margin: 0;
    padding: 32px;
  }
  .markdown-body {
    min-width: 200px;
    max-width: 980px;
    margin: 0 auto;
    padding: 32px;
  }
  @media (max-width: 767px) {
    .markdown-body {
      padding: 15px;
    }
  }
  pre.mermaid {
    background: transparent;
    text-align: center;
  }
  pre.mermaid svg {
    max-width: 100%;
  }
</style>
</head>
<body>
<div class="markdown-body">
${body}
${watchScript}
</div>
<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif'
  });
  document.querySelectorAll('pre code.language-mermaid').forEach(function (el) {
    el.classList.add('mermaid');
  });
  document.querySelectorAll('pre:not(.mermaid) > code.hljs').forEach(function (el) {
    hljs.highlightElement(el);
  });
</script>
</body>
</html>
`;
}

export function buildPageForFile(filePath: string, opts: { watch?: boolean } = {}): string {
  const abs = path.resolve(filePath);
  const content = fs.readFileSync(abs, "utf8");
  const title = path.basename(abs);
  return renderPage(content, title, opts);
}