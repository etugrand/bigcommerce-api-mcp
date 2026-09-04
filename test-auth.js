#!/usr/bin/env node
// Regression check: MCP_AUTH_TOKEN must gate every transport route, not just /mcp.
import { spawn } from "child_process";
import assert from "assert";

const TOKEN = "test-token-123";
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

async function withServer(flag, fn) {
  const proc = spawn("node", ["mcpServer.js", flag], {
    env: { ...process.env, PORT: String(PORT), MCP_AUTH_TOKEN: TOKEN },
    stdio: "ignore",
  });
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      try {
        await fetch(`${BASE}/health`);
        up = true;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(up, `server (${flag}) never came up on ${BASE}`);
    await fn();
  } finally {
    proc.kill();
  }
}

const body = JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 });
const json = { "Content-Type": "application/json" };

await withServer("--sse", async () => {
  // ponytail: AbortSignal.timeout because /sse never ends the response when it succeeds.
  let status;
  try {
    status = (await fetch(`${BASE}/sse`, { signal: AbortSignal.timeout(1500) })).status;
  } catch {
    status = 200; // stream stayed open past the timeout => anonymous client got a session
  }
  assert.strictEqual(status, 401, "GET /sse must reject requests without a token");

  const msg = await fetch(`${BASE}/messages?sessionId=x`, { method: "POST", headers: json, body });
  assert.strictEqual(msg.status, 401, "POST /messages must reject requests without a token");
  console.log("sse: /sse and /messages both require the token");
});

await withServer("--streamable-http", async () => {
  const anon = await fetch(`${BASE}/mcp`, { method: "POST", headers: json, body });
  assert.strictEqual(anon.status, 401, "POST /mcp must reject requests without a token");

  const authed = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { ...json, Accept: "application/json, text/event-stream", Authorization: `Bearer ${TOKEN}` },
    body,
  });
  assert.notStrictEqual(authed.status, 401, "POST /mcp must accept the configured token");
  console.log("streamable-http: /mcp rejects anonymous, accepts the token");
});

console.log("\nAll auth checks passed.");
