import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";

/**
 * Drives the real MCP server over stdio against a stub BigCommerce API, so the
 * tools/call response shape is checked end to end without live credentials.
 */
describe("tools/call response shape", () => {
  let api;
  let apiPort;

  before(async () => {
    api = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url.includes("/v2/orders/1/products")) {
        // V2 endpoints return a bare array, which structuredContent cannot hold.
        return res.end(JSON.stringify([{ id: 9, name: "Widget", quantity: 2 }]));
      }
      if (req.url.includes("/v3/catalog/products/404")) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ title: "Not Found", status: 404 }));
      }
      res.end(JSON.stringify({ data: [{ id: 1, name: "Widget" }], meta: { total: 1 } }));
    });
    api.listen(0, "127.0.0.1");
    await once(api, "listening");
    apiPort = api.address().port;
  });

  after(() => api?.close());

  /** Sends a batch of requests over stdio and returns the responses by id. */
  async function rpc(requests) {
    const child = spawn("node", ["mcpServer.js"], {
      stdio: ["pipe", "pipe", "ignore"],
      env: {
        ...process.env,
        BIGCOMMERCE_API_BASE_URL: `http://127.0.0.1:${apiPort}/stores`,
        BIGCOMMERCE_API_KEY: "test-key",
        BIGCOMMERCE_STORE_HASH: "testhash",
      },
    });

    child.stdin.write(
      requests.map((r) => JSON.stringify({ jsonrpc: "2.0", ...r })).join("\n") + "\n"
    );

    const responses = new Map();
    let buffer = "";
    for await (const chunk of child.stdout) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines.filter(Boolean)) {
        const message = JSON.parse(line);
        if (message.id !== undefined) responses.set(message.id, message);
      }
      if (responses.size === requests.filter((r) => r.id !== undefined).length) break;
    }
    child.kill();
    return responses;
  }

  const init = {
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    },
  };

  test("an object response is returned as both text and structuredContent", async () => {
    const responses = await rpc([
      init,
      { id: 2, method: "tools/call", params: { name: "get_all_products", arguments: { limit: 1 } } },
    ]);
    const result = responses.get(2).result;

    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      data: [{ id: 1, name: "Widget" }],
      meta: { total: 1 },
    });
    assert.equal(result.content[0].type, "text");
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  });

  test("a bare array response is wrapped, since structuredContent must be an object", async () => {
    const responses = await rpc([
      init,
      { id: 2, method: "tools/call", params: { name: "get_order_products", arguments: { order_id: 1 } } },
    ]);
    const result = responses.get(2).result;

    assert.deepEqual(result.structuredContent, { data: [{ id: 9, name: "Widget", quantity: 2 }] });
    // The text content keeps the API's own shape.
    assert.ok(Array.isArray(JSON.parse(result.content[0].text)));
  });

  test("an API failure comes back as isError, not a protocol error", async () => {
    const responses = await rpc([
      init,
      { id: 2, method: "tools/call", params: { name: "get_product", arguments: { product_id: 404 } } },
    ]);
    const result = responses.get(2).result;

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /HTTP 404/);
    assert.equal(responses.get(2).error, undefined);
  });

  test("a missing required parameter is rejected before any API call", async () => {
    const responses = await rpc([
      init,
      { id: 2, method: "tools/call", params: { name: "get_product", arguments: {} } },
    ]);
    assert.match(responses.get(2).error.message, /Missing required parameter: product_id/);
  });

  test("an unknown tool is rejected", async () => {
    const responses = await rpc([
      init,
      { id: 2, method: "tools/call", params: { name: "delete_everything", arguments: {} } },
    ]);
    assert.match(responses.get(2).error.message, /Unknown tool/);
  });
});
