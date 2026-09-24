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
- **Auto-shutdown** — once the page has been served and all connections
  drain, the server shuts itself down after a short idle grace period
- **Zero-config** — picks a random free port (or use your own), then opens the
  page in your default browser via the `open` command

## Install

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

Examples:

```sh
mdv README.md           # random port, opens browser
mdv docs/spec.md 8080   # specific port
node dist/index.js test.md   # without npm link
```

Starts a local web server on `127.0.0.1`, renders the file, and opens
`http://localhost:<port>/` in your browser. Press `Ctrl+C` to stop.

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
node dist/index.js test.md # try it with the sample fixture
```

Layout:

```
src/
├── index.ts   # CLI entry point and HTTP server
├── render.ts  # markdown → GitHub-style HTML pipeline
└── util.ts    # helpers (HTML escaping)
```

Rendering assets (github-markdown-css, highlight.js, mermaid) are loaded from
CDNs at page load, so no bundling step is needed.

## Acknowledgements

This project was entirely vibe coded — [pi](https://github.com/earendil-works/pi-coding-agent)
(powered by GLM) wrote all of the code from a series of natural-language
prompts.

## License

MIT