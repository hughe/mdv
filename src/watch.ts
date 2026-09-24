import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { WebSocketServer, WebSocket } from "ws";

const DEBOUNCE_MS = 200; // collapse editor save bursts into one reload
const CLOSE_GRACE_MS = 3000; // allow reload reconnects before treating as window closed

export interface WatchHandle {
  /** Notify all connected pages that the file changed (they reload). */
  broadcastChanged(): void;
}

/**
 * Set up watch mode:
 *  - a websocket server (injected client script connects back)
 *  - file watching; changes broadcast a "changed" message to connected pages
 *  - when every connected page is gone (window closed) and doesn't come back
 *    within a grace period, the process exits
 */
export function setupWatch(server: http.Server, file: string, log: (msg: string) => void): WatchHandle {
  // ── websocket server ───────────────────────────────────────────────────
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();
  let everConnected = false;
  let exitTimer: NodeJS.Timeout | null = null;

  function shutdown(reason: string): void {
    log(reason);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  }

  function scheduleExitCheck(): void {
    if (clients.size > 0 || !everConnected || exitTimer !== null) return;
    // All pages disconnected. A browser reload briefly closes the socket
    // before opening a new one, so wait a moment before declaring the window
    // closed. A reconnect cancels the timer.
    exitTimer = setTimeout(() => {
      exitTimer = null;
      if (clients.size === 0) {
        shutdown("browser window closed; shutting down");
      }
    }, CLOSE_GRACE_MS);
  }

  wss.on("connection", (ws) => {
    everConnected = true;
    if (exitTimer !== null) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
    clients.add(ws);
    ws.on("close", () => {
      clients.delete(ws);
      scheduleExitCheck();
    });
    ws.on("error", () => {
      /* ignore; close will follow */
    });
  });

  // ── file watching ──────────────────────────────────────────────────────
  // Watch both the file and its directory: many editors replace files
  // atomically (write temp + rename), which invalidates a plain file watch.
  let debounceTimer: NodeJS.Timeout | null = null;

  function trigger(): void {
    if (debounceTimer !== null) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!fs.existsSync(file)) return; // mid-rename; ignore
      broadcast({ type: "changed" });
      log("file changed; reloading");
    }, DEBOUNCE_MS);
  }

  try {
    fs.watch(file).on("error", () => {
      /* file may be replaced; the directory watch covers it */
    });
  } catch {
    /* file may not exist yet; the directory watch covers it */
  }
  fs.watch(path.dirname(file), (_event, filename) => {
    if (filename === path.basename(file)) trigger();
  });

  function broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  return {
    broadcastChanged: () => broadcast({ type: "changed" }),
  };
}