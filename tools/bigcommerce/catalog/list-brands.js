/**
 * List catalog brands from the BigCommerce Catalog V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...query } = {}) =>
  request({ path: "v3/catalog/brands", query, storeHash: store_Hash });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "list_brands",
      description:
        "List catalog brands. Use this to resolve a brand name to the ID that get_all_products expects.",
      parameters: {
        type: "object",
        properties: {
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          name: { type: "string", description: "Filter by exact name." },
          "name:like": { type: "string", description: "Partial name match." },
          sort: {
            type: "string",
            description: "Sort field, e.g. name, id.",
          },
          limit: {
            type: "integer",
            description: "Results per page (default 50, max 250).",
          },
          page: { type: "integer", description: "Page number (default 1)." },
        },
        required: [],
      },
    },
  },
};

export { apiTool };
