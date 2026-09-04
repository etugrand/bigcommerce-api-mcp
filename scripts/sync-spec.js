#!/usr/bin/env node
/**
 * Regenerates test/fixtures/bigcommerce-query-params.json from BigCommerce's
 * published OpenAPI specs. Run this when BigCommerce adds filters you want to
 * expose, then update the affected tool definitions.
 */
import { writeFileSync } from "fs";
import { parse } from "yaml";

const BASE = "https://raw.githubusercontent.com/bigcommerce/api-specs/main/reference";

const ENDPOINTS = {
  get_all_products: ["catalog/products_catalog.v3.yml", "/catalog/products", "get", []],
  get_product: ["catalog/products_catalog.v3.yml", "/catalog/products/{product_id}", "get", ["product_id"]],
  get_all_customers: ["customers.v3.yml", "/customers", "get", []],
  get_all_orders: ["orders.v2.oas2.yml", "/orders", "get", []],
  get_order: ["orders.v2.oas2.yml", "/orders/{order_id}", "get", ["order_id"]],
  get_order_products: ["orders.v2.oas2.yml", "/orders/{order_id}/products", "get", ["order_id"]],
  list_categories: ["catalog/categories_catalog.v3.yml", "/catalog/categories", "get", []],
  list_brands: ["catalog/brands_catalog.v3.yml", "/catalog/brands", "get", []],
};

const resolve = (doc, node) => {
  while (node?.$ref) {
    node = node.$ref
      .slice(2)
      .split("/")
      .reduce((acc, key) => acc[key], doc);
  }
  return node;
};

const cache = new Map();
async function loadSpec(file) {
  if (!cache.has(file)) {
    const response = await fetch(`${BASE}/${file}`);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    cache.set(file, parse(await response.text()));
  }
  return cache.get(file);
}

const endpoints = {};
for (const [tool, [file, path, method, pathParams]] of Object.entries(ENDPOINTS)) {
  const doc = await loadSpec(file);
  const operation = doc.paths[path];
  const params = [...(operation.parameters ?? []), ...(operation[method].parameters ?? [])];
  endpoints[tool] = {
    spec: `reference/${file}`,
    path: `${method.toUpperCase()} ${path}`,
    path_params: pathParams,
    query_params: [
      ...new Set(
        params
          .map((p) => resolve(doc, p))
          .filter((p) => p?.in === "query")
          .map((p) => p.name)
      ),
    ].sort(),
  };
  console.log(`${tool}: ${endpoints[tool].query_params.length} query params`);
}

writeFileSync(
  new URL("../test/fixtures/bigcommerce-query-params.json", import.meta.url),
  JSON.stringify(
    {
      _comment:
        "Query parameters each endpoint accepts, extracted from BigCommerce's OpenAPI specs. BigCommerce ignores unknown query params silently, so a tool declaring one returns unfiltered data instead of an error. Regenerate with: npm run sync-spec",
      _source: "https://github.com/bigcommerce/api-specs",
      endpoints,
    },
    null,
    2
  ) + "\n"
);
console.log("\nwrote test/fixtures/bigcommerce-query-params.json");
