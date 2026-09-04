/**
 * Fetch a single product by ID from the BigCommerce Catalog V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ product_id, store_Hash, ...query } = {}) =>
  request({
    path: `v3/catalog/products/${product_id}`,
    query,
    storeHash: store_Hash,
  });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_product",
      description:
        "Get one product by its ID, optionally including variants, images and custom fields.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "integer",
            description: "The product ID to fetch.",
          },
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          include: {
            type: "string",
            description:
              "Sub-resources to embed, comma-separated: variants, images, custom_fields, bulk_pricing_rules, primary_image, modifiers, options, videos.",
          },
          include_fields: {
            type: "string",
            description: "Comma-separated fields to return.",
          },
        },
        required: ["product_id"],
      },
    },
  },
};

export { apiTool };
