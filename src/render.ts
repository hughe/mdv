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

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  // marked emits GFM task list checkboxes but not the `task-list-item` class
  // that github-markdown-css relies on to hide the list bullet.
  return html.replace(
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