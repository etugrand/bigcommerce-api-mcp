import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { discoverTools } from "../lib/tools.js";

/**
 * Verifies the HTTP request each tool actually builds. The BigCommerce write
 * endpoints are inconsistent — V3 customers take a batch array with the id in
 * the body, catalog and V2 orders take a single object with the id in the path
 * — so these shapes are asserted rather than assumed.
 */
let calls;
const realFetch = globalThis.fetch;

async function callTool(name, args) {
  process.env.BIGCOMMERCE_ENABLE_WRITES = "true";
  process.env.BIGCOMMERCE_API_KEY = "test-key";
  process.env.BIGCOMMERCE_STORE_HASH = "testhash";

  const tools = await discoverTools();
  const tool = tools.find((t) => t.definition.function.name === name);
  assert.ok(tool, `tool ${name} not found`);
  await tool.function(args);
  assert.equal(calls.length, 1, `${name} should make exactly one request`);
  const [url, init] = calls[0];
  return {
    url: new URL(url),
    method: init.method,
    body: init.body ? JSON.parse(init.body) : undefined,
    headers: init.headers,
  };
}

describe("request construction", () => {
  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push([url, init]);
      return new Response('{"data":{}}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.BIGCOMMERCE_ENABLE_WRITES;
    delete process.env.BIGCOMMERCE_API_KEY;
    delete process.env.BIGCOMMERCE_STORE_HASH;
  });

  test("reads authenticate with X-Auth-Token against the configured store", async () => {
    const req = await callTool("get_all_products", { limit: 5 });
    assert.equal(req.method, "GET");
    assert.equal(req.url.pathname, "/stores/testhash/v3/catalog/products");
    assert.equal(req.url.searchParams.get("limit"), "5");
    assert.equal(req.headers["X-Auth-Token"], "test-key");
    assert.equal(req.body, undefined);
  });

  test("store_Hash overrides the environment and never leaks into the query", async () => {
    const req = await callTool("get_all_orders", { store_Hash: "other", limit: 1 });
    assert.equal(req.url.pathname, "/stores/other/v2/orders");
    assert.equal(req.url.searchParams.get("store_Hash"), null);
  });

  test("id parameters go in the path, not the query", async () => {
    const req = await callTool("get_order_products", { order_id: 42, limit: 10 });
    assert.equal(req.url.pathname, "/stores/testhash/v2/orders/42/products");
    assert.equal(req.url.searchParams.get("order_id"), null);
    assert.equal(req.url.searchParams.get("limit"), "10");
  });

  test("create_product POSTs a single object", async () => {
    const req = await callTool("create_product", {
      name: "Widget",
      type: "physical",
      weight: 1,
      price: 9.99,
    });
    assert.equal(req.method, "POST");
    assert.equal(req.url.pathname, "/stores/testhash/v3/catalog/products");
    assert.deepEqual(req.body, { name: "Widget", type: "physical", weight: 1, price: 9.99 });
  });

  test("update_product PUTs to the product path with only the changed fields", async () => {
    const req = await callTool("update_product", { product_id: 7, price: 12.5 });
    assert.equal(req.method, "PUT");
    assert.equal(req.url.pathname, "/stores/testhash/v3/catalog/products/7");
    assert.deepEqual(req.body, { price: 12.5 });
  });

  test("create_customer wraps the customer in the batch array V3 requires", async () => {
    const req = await callTool("create_customer", {
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });
    assert.equal(req.method, "POST");
    assert.equal(req.url.pathname, "/stores/testhash/v3/customers");
    assert.deepEqual(req.body, [{ email: "a@b.com", first_name: "A", last_name: "B" }]);
  });

  test("update_customer carries the id inside the array element, not the path", async () => {
    const req = await callTool("update_customer", { customer_id: 3, phone: "555" });
    assert.equal(req.method, "PUT");
    assert.equal(req.url.pathname, "/stores/testhash/v3/customers");
    assert.deepEqual(req.body, [{ id: 3, phone: "555" }]);
  });

  test("update_order PUTs the V2 order path with the id stripped from the body", async () => {
    const req = await callTool("update_order", { order_id: 100, status_id: 10 });
    assert.equal(req.method, "PUT");
    assert.equal(req.url.pathname, "/stores/testhash/v2/orders/100");
    assert.deepEqual(req.body, { status_id: 10 });
  });

  test("a non-2xx response surfaces as an error result, not a throw", async () => {
    globalThis.fetch = async () =>
      new Response('{"title":"Not Found","status":404}', { status: 404 });
    process.env.BIGCOMMERCE_API_KEY = "k";
    process.env.BIGCOMMERCE_STORE_HASH = "h";
    const [tool] = (await discoverTools()).filter(
      (t) => t.definition.function.name === "get_product"
    );
    const result = await tool.function({ product_id: 1 });
    assert.match(result.error, /HTTP 404/);
    assert.match(result.error, /Not Found/);
  });
});
