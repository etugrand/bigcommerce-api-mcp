import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { buildQuery, request } from "../lib/bigcommerce.js";
import { discoverTools } from "../lib/tools.js";

const TOKEN = "test-token-123";
const PORT = 3987;
const MCP = `http://127.0.0.1:${PORT}/mcp`;

const rpc = (method, params) =>
  JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });

const headers = (extra = {}) => ({
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  ...extra,
});

/** The streamable-HTTP transport answers with SSE frames, not bare JSON. */
async function parseBody(response) {
  const text = await response.text();
  const line = text
    .split("\n")
    .find((l) => l.startsWith("data: "));
  return JSON.parse(line ? line.slice(6) : text);
}

describe("lib/bigcommerce", () => {
  test("buildQuery drops empty values and encodes the rest", () => {
    assert.equal(buildQuery({}), "");
    assert.equal(buildQuery({ a: undefined, b: null, c: "" }), "");
    assert.equal(buildQuery({ limit: 50, page: 1 }), "?limit=50&page=1");
    assert.equal(buildQuery({ "name:like": "red shirt" }), "?name%3Alike=red+shirt");
    assert.equal(buildQuery({ is_visible: false }), "?is_visible=false");
  });

  test("missing credentials return an error instead of hitting undefined URLs", async () => {
    const key = process.env.BIGCOMMERCE_API_KEY;
    const hash = process.env.BIGCOMMERCE_STORE_HASH;
    delete process.env.BIGCOMMERCE_API_KEY;
    delete process.env.BIGCOMMERCE_STORE_HASH;
    try {
      const result = await request({ path: "v3/catalog/products" });
      assert.match(result.error, /BIGCOMMERCE_API_KEY is not set/);

      process.env.BIGCOMMERCE_API_KEY = "x";
      const noHash = await request({ path: "v3/catalog/products" });
      assert.match(noHash.error, /No store hash available/);
    } finally {
      if (key) process.env.BIGCOMMERCE_API_KEY = key;
      else delete process.env.BIGCOMMERCE_API_KEY;
      if (hash) process.env.BIGCOMMERCE_STORE_HASH = hash;
      else delete process.env.BIGCOMMERCE_STORE_HASH;
    }
  });
});

describe("tool discovery", () => {
  test("write tools stay hidden unless BIGCOMMERCE_ENABLE_WRITES is set", async () => {
    const previous = process.env.BIGCOMMERCE_ENABLE_WRITES;
    try {
      delete process.env.BIGCOMMERCE_ENABLE_WRITES;
      const readOnly = (await discoverTools()).map((t) => t.definition.function.name);
      assert.ok(readOnly.includes("get_all_products"));
      assert.ok(!readOnly.some((n) => n.startsWith("create_") || n.startsWith("update_")));

      process.env.BIGCOMMERCE_ENABLE_WRITES = "true";
      const all = (await discoverTools()).map((t) => t.definition.function.name);
      for (const name of ["create_product", "update_product", "create_customer", "update_customer", "update_order"]) {
        assert.ok(all.includes(name), `${name} should appear when writes are enabled`);
      }
    } finally {
      if (previous) process.env.BIGCOMMERCE_ENABLE_WRITES = previous;
      else delete process.env.BIGCOMMERCE_ENABLE_WRITES;
    }
  });

  test("every tool exposes a name, description and object schema", async () => {
    process.env.BIGCOMMERCE_ENABLE_WRITES = "true";
    const tools = await discoverTools();
    delete process.env.BIGCOMMERCE_ENABLE_WRITES;
    assert.ok(tools.length >= 13, `expected 13+ tools, got ${tools.length}`);
    for (const tool of tools) {
      const fn = tool.definition.function;
      assert.equal(typeof tool.function, "function", `${fn.name} has no implementation`);
      assert.ok(fn.description?.length > 20, `${fn.name} needs a real description`);
      assert.equal(fn.parameters.type, "object", `${fn.name} schema must be an object`);
      for (const required of fn.parameters.required ?? []) {
        assert.ok(fn.parameters.properties[required], `${fn.name} requires undeclared "${required}"`);
      }
    }
  });
});

describe("streamable-http transport", () => {
  let server;

  before(async () => {
    server = spawn("node", ["mcpServer.js", "--streamable-http"], {
      env: {
        ...process.env,
        PORT: String(PORT),
        MCP_AUTH_TOKEN: TOKEN,
        ALLOWED_ORIGINS: "https://allowed.example",
      },
      stdio: "ignore",
    });
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(`http://127.0.0.1:${PORT}/health`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error("server never came up");
  });

  after(() => server?.kill());

  test("rejects requests with no bearer token", async () => {
    const res = await fetch(MCP, { method: "POST", headers: headers(), body: rpc("tools/list") });
    assert.equal(res.status, 401);
  });

  test("rejects a wrong token of the same length", async () => {
    const res = await fetch(MCP, {
      method: "POST",
      headers: headers({ Authorization: `Bearer ${"x".repeat(TOKEN.length)}` }),
      body: rpc("tools/list"),
    });
    assert.equal(res.status, 401);
  });

  test("accepts the configured token and lists tools", async () => {
    const res = await fetch(MCP, {
      method: "POST",
      headers: headers({ Authorization: `Bearer ${TOKEN}` }),
      body: rpc("tools/list"),
    });
    assert.equal(res.status, 200);
    const names = (await parseBody(res)).result.tools.map((t) => t.name);
    assert.ok(names.includes("get_all_products"));
    assert.ok(names.includes("get_order_products"));
  });

  test("blocks a browser origin that is not allowlisted", async () => {
    const res = await fetch(MCP, {
      method: "POST",
      headers: headers({ Authorization: `Bearer ${TOKEN}`, Origin: "https://evil.example" }),
      body: rpc("tools/list"),
    });
    assert.equal(res.status, 403, "cross-origin browser requests must be refused");
  });

  test("allows an allowlisted origin and echoes it back", async () => {
    const res = await fetch(MCP, {
      method: "POST",
      headers: headers({ Authorization: `Bearer ${TOKEN}`, Origin: "https://allowed.example" }),
      body: rpc("tools/list"),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "https://allowed.example");
  });

  test("health reports tool count and write status without a token", async () => {
    const body = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
    assert.equal(body.status, "healthy");
    assert.equal(body.writesEnabled, false);
    assert.ok(body.tools > 0);
  });
});

describe("stdio transport", () => {
  test("writes nothing but JSON-RPC to stdout", async () => {
    const child = spawn("node", ["mcpServer.js"], { stdio: ["pipe", "pipe", "ignore"] });
    child.stdin.write(
      rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      }) + "\n"
    );

    let stdout = "";
    for await (const chunk of child.stdout) {
      stdout += chunk;
      if (stdout.includes("\n")) break;
    }
    child.kill();

    for (const line of stdout.split("\n").filter(Boolean)) {
      assert.doesNotThrow(
        () => JSON.parse(line),
        `stdout must carry only JSON-RPC, got: ${line}`
      );
    }
    assert.equal(JSON.parse(stdout.split("\n")[0]).result.serverInfo.name, "bigcommerce-api-mcp");
  });
});
