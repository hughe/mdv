# mdv

A CLI tool that renders a local Markdown file in your browser, as close as
possible to how GitHub renders it, including **Mermaid** diagrams.

## Usage

```sh
npm install && npm run build
node dist/index.js <markdown-file> [port]
```

Example:

```sh
node dist/index.js README.md 8080
```

Starts a local web server (random free port unless `port` is given), then
opens the URL in your default browser via the `open` command.

## GitHub-faithful rendering

- [GitHub Flavored Markdown](https://github.github.com/gfm/) via `marked`
  (tables, task lists, strikethrough, autolinks, …)
- [`github-markdown-css`](https://github.com/sindresorhus/github-markdown-css)
  for pixel-accurate GitHub styling
- `highlight.js` with the `github` theme for syntax highlighting
- [Mermaid](https://mermaid.js.org/) v11 (loaded from CDN) for `mermaid` code
  fences, rendered as diagrams just like on GitHub

Relative image links (`![](image.png)`) resolve against the markdown file's
directory, mirroring GitHub repository-relative behavior.

## Development

```sh
npm install
npm run build   # tsc -> dist/
npm test        # manual: try with test.md
```

## Install globally

```sh
npm link
mdv any-file.md
```