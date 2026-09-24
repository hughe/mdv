import { test, expect } from "@playwright/test";
import { spawn, ChildProcess, execFileSync } from "child_process";
import * as fs from "fs";
import * as fspath from "path";
import * as os from "os";

const BIN = fspath.join(__dirname, "..", "dist", "index.js");

interface ServerHandle {
  proc: ChildProcess;
  url: string;
  /** Resolves when the server process exits. */
  exited(timeoutMs?: number): Promise<void>;
  kill(): void;
}

/**
 * Spawn the mdv CLI and wait until it logs its serving URL.
 * MDV_NO_OPEN keeps it from trying to open a browser.
 */
function startServer(args: string[]): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [BIN, ...args], {
      env: { ...process.env, MDV_NO_OPEN: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      proc.kill();
      reject(err);
    };

    const timeout = setTimeout(
      () => fail(new Error(`server did not start in time; stderr: ${stderr}`)),
      10_000
    );

    proc.stdout!.on("data", (chunk: Buffer) => {
      const m = chunk.toString().match(/http:\/\/localhost:(\d+)\//);
      if (m && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({
          proc,
          url: m[0],
          exited: (timeoutMs = 15_000) =>
            new Promise((resolveExit, rejectExit) => {
              const t = setTimeout(
                () => rejectExit(new Error("server did not exit within timeout")),
                timeoutMs
              );
              proc.once("exit", () => {
                clearTimeout(t);
                resolveExit();
              });
            }),
          kill: () => proc.kill(),
        });
      }
    });
    proc.stderr!.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    proc.on("exit", (code) => {
      fail(new Error(`server exited early (code ${code}); stderr: ${stderr}`));
    });
  });
}

/** Create a temp directory with a markdown file; returns its path. */
function makeTempFile(content: string): string {
  const dir = fs.mkdtempSync(fspath.join(os.tmpdir(), "mdv-test-"));
  const file = fspath.join(dir, "doc.md");
  fs.writeFileSync(file, content);
  return file;
}

const SAMPLE = `# Sample

| col | val |
| --- | --- |
| a   | b   |

- [x] done
- [ ] todo

\`\`\`ts
const x: number = 1;
\`\`\`

> quoted text

\`\`\`mermaid
graph TD
    A --> B
\`\`\`
`;

test("renders GFM features and mermaid diagram", async ({ page }) => {
  const file = makeTempFile(SAMPLE);
  const server = await startServer([file]);

  await page.goto(server.url);

  // GFM table
  await expect(page.locator("table")).toContainText("b");
  // GFM task list
  await expect(page.locator("li.task-list-item input[checked]")).toHaveCount(1);
  await expect(page.locator("li.task-list-item input:not([checked])")).toHaveCount(1);
  // Syntax-highlighted code fence
  await expect(page.locator("pre code.hljs.language-ts")).toContainText("const");
  // Blockquote
  await expect(page.locator("blockquote")).toContainText("quoted text");
  // Mermaid diagram rendered as SVG (assets come from CDN; allow time)
  await expect(page.locator("svg", { has: page.locator("path") })).toBeVisible({
    timeout: 20_000,
  });

  server.kill();
});

test("mermaid fences render diagrams", async ({ page }) => {
  const file = makeTempFile(
    "# Diagrams\n\n```mermaid\nsequenceDiagram\n    A->>B: hi\n```\n"
  );
  const server = await startServer([file]);

  await page.goto(server.url);
  // Mermaid replaces the <pre class="mermaid"> content with an SVG.
  await expect(page.locator("pre.mermaid svg")).toBeVisible({ timeout: 20_000 });

  server.kill();
});

test("one-shot mode (--no-watch) exits after serving", async ({ page }) => {
  const file = makeTempFile(SAMPLE);
  const server = await startServer([file, "-n"]);

  await page.goto(server.url);
  await expect(page.locator("h1")).toHaveText("Sample");

  // Idle auto-shutdown kicks in shortly after the page is served.
  await server.exited();
});

test("watch mode (default) reloads on file change and exits on window close", async ({
  page,
}) => {
  const file = makeTempFile("# Original\n\nFIRST-MARKER\n");
  const server = await startServer([file]);

  await page.goto(server.url);
  await expect(page.locator("h1")).toHaveText("Original");
  await expect(page.locator("text=FIRST-MARKER")).toBeVisible();

  // Edit the file; the page should reload and show the new content.
  fs.writeFileSync(file, "# Changed\n\nSECOND-MARKER\n");
  await expect(page.locator("h1")).toHaveText("Changed", { timeout: 15_000 });
  await expect(page.locator("text=SECOND-MARKER")).toBeVisible();

  // Closing the window (all websockets gone) should terminate the server.
  await page.close();
  await server.exited();
});

test("--version prints the version", () => {
  const out = execFileSync(process.execPath, [BIN, "--version"], {
    encoding: "utf8",
  });
  expect(out.trim()).toMatch(/^mdv \d+\.\d+\.\d+$/);
});

test("--help prints usage", () => {
  const out = execFileSync(process.execPath, [BIN, "--help"], { encoding: "utf8" });
  expect(out).toContain("Usage:");
  expect(out).toContain("--no-watch");
});