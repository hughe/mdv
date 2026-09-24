# mdv — Markdown Viewer

`mdv` is a small CLI tool that renders a local Markdown file in your browser,
as close as possible to the way GitHub renders it — including **Mermaid**
diagrams.

```mermaid
graph LR
    A[mdv file.md] --> B[Local web server]
    B --> C[Open browser]
    C --> D["GitHub-style render with Mermaid"]
```

## Features

- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks,
  and more, rendered with the same CSS GitHub uses
  ([github-markdown-css](https://github.com/sindresorhus/github-markdown-css))
- **Mermaid diagram support** — ` ```mermaid ` code fences are rendered as
  diagrams, just like on GitHub (flowcharts, sequence diagrams, gantt
  charts, …)
- **Syntax highlighting** — code fences highlighted with
  [highlight.js](https://highlightjs.org/) using the `github` theme
- **Relative assets** — image links such as `![](image.png)` resolve against
  the markdown file's directory, mirroring GitHub repository-relative behavior
- **Auto-shutdown** — the server shuts down when you close the browser
  window (default), or after serving once in one-shot mode (`--no-watch`)
- **Live reload** (default) — the rendered page stays connected over a
  websocket; when the file changes it reloads instantly
- **Zero-config** — picks a random free port (or use your own), then opens the
  page in your default browser via the `open` command

## Install

The easiest way is the install script:

```sh
git clone git@github.com:hughe/mdv.git
cd mdv
./install.sh
```

The script:

1. Verifies Node.js 18+ and npm are installed
2. Installs dependencies (`npm ci`)
3. Compiles with `tsc` (`npm run build`)
4. Symlinks the `mdv` command into `~/.local/bin` by default
   (override with `MDV_BIN_DIR=... ./install.sh`)

If the install directory isn't on your `PATH`, the script prints the exact
`export PATH=...` line to add to your shell profile.

To install manually instead:

```sh
npm install
npm run build
npm link        # alternative: puts `mdv` on your PATH via npm
```

## Usage

```sh
mdv <markdown-file> [port]
```

| Argument | Description |
| ------- | ---------- |
| `<markdown-file>` | Path to the markdown file to render |
| `[port]` | Optional port to listen on (default: random free port) |
| `-n`, `--no-watch` | One-shot mode: no live reload; server exits after serving |

Examples:

```sh
mdv README.md           # live reload, exits when the window closes
mdv -w NOTES.md         # -w is the default (kept for compatibility)
mdv docs/spec.md 8080   # specific port
mdv -n QUICK.md         # one-shot mode
node dist/index.js test.md   # without npm link
```

Starts a local web server on `127.0.0.1`, renders the file, and opens
`http://localhost:<port>/` in your browser. In the default watch mode the
page reloads whenever the file changes and the server exits when the browser
window is closed. With `--no-watch`, the server shuts down automatically
once the page has been served. Press `Ctrl+C` to stop at any time.

Set `MDV_NO_OPEN=1` to skip opening a browser (useful for headless
environments).

## Options

```
-h, --help    Show help
```

## What it looks like

Given this markdown:

````markdown
## Deployment

```mermaid
graph TD
    A[Push] --> B{CI passes?}
    B -- yes --> C[Deploy]
    B -- no --> D[Fix]
```
````

You get a GitHub-styled page with a rendered flowchart diagram.

## Development

```sh
npm install
npm run build              # compile TypeScript to dist/
npm test                   # build + run Playwright end-to-end tests
node dist/index.js test.md # try it with the sample fixture
```

The Playwright tests spawn the real CLI and drive it in headless Chromium,
covering GFM/mermaid rendering, live reload, and auto-shutdown in both
watch and one-shot modes. Browsers are managed by Playwright
(`npx playwright install chromium` if missing).

Layout:

```
src/
├── index.ts   # CLI entry point and HTTP server
├── render.ts  # markdown → GitHub-style HTML pipeline
├── watch.ts   # watch mode: websocket live reload + exit-on-close
└── util.ts    # helpers (HTML escaping)
tests/
└── mdv.spec.ts  # Playwright end-to-end tests
```

Rendering assets (github-markdown-css, highlight.js, mermaid) are loaded from
CDNs at page load, so no bundling step is needed.

## Acknowledgements

This project was entirely vibe coded — [pi](https://github.com/earendil-works/pi-coding-agent)
(powered by GLM) wrote all of the code from a series of natural-language
prompts.

## License

MIT