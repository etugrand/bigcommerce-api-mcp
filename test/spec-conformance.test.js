import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { discoverTools } from "../lib/tools.js";

/**
 * BigCommerce ignores unknown query parameters instead of rejecting them, so a
 * misspelled or invented filter silently returns UNFILTERED data — a wrong
 * answer rather than an error. Every query parameter a read tool declares is
 * therefore checked against the parameter list in BigCommerce's own OpenAPI
 * specs, captured in test/fixtures/bigcommerce-query-params.json.
 */
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/bigcommerce-query-params.json", import.meta.url))
);

describe("query parameters match the BigCommerce OpenAPI specs", () => {
  for (const [toolName, spec] of Object.entries(fixture.endpoints)) {
    test(`${toolName} declares no parameter the API would ignore`, async () => {
      const tools = await discoverTools();
      const tool = tools.find((t) => t.definition.function.name === toolName);
      assert.ok(tool, `${toolName} is missing`);

      const declared = Object.keys(
        tool.definition.function.parameters.properties ?? {}
      );
      const unknown = declared.filter(
        (name) =>
          name !== "store_Hash" &&
          !spec.path_params.includes(name) &&
          !spec.query_params.includes(name)
      );

      assert.deepEqual(
        unknown,
        [],
        `${toolName} (${spec.path}) declares parameters absent from ${spec.spec}. ` +
          `BigCommerce would ignore them and return unfiltered results.`
      );
    });
  }
});
