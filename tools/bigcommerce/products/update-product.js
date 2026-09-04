/**
 * Update a product via the BigCommerce Catalog V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ product_id, store_Hash, ...fields } = {}) =>
  request({
    path: `v3/catalog/products/${product_id}`,
    method: "PUT",
    body: fields,
    storeHash: store_Hash,
  });

const apiTool = {
  writes: true,
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "update_product",
      description:
        "Update an existing product. Only the fields you pass are changed; everything else is left as-is.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "integer",
            description: "The product ID to update.",
          },
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          name: { type: "string", description: "Product name." },
          price: { type: "number", description: "Price." },
          sale_price: { type: "number", description: "Sale price." },
          cost_price: { type: "number", description: "Cost price." },
          retail_price: { type: "number", description: "Retail price." },
          sku: { type: "string", description: "Stock keeping unit." },
          weight: { type: "number", description: "Weight." },
          description: {
            type: "string",
            description: "Product description; accepts HTML.",
          },
          inventory_level: {
            type: "integer",
            description: "Current stock level.",
          },
          inventory_tracking: {
            type: "string",
            enum: ["none", "product", "variant"],
            description: "How inventory is tracked.",
          },
          is_visible: {
            type: "boolean",
            description: "Whether the product shows on the storefront.",
          },
          categories: {
            type: "array",
            items: { type: "integer" },
            description: "Replaces the product's category assignments.",
          },
          brand_id: { type: "integer", description: "Brand ID." },
        },
        required: ["product_id"],
      },
    },
  },
};

export { apiTool };
