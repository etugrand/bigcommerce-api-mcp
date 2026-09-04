/**
 * Create a product via the BigCommerce Catalog V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...product } = {}) =>
  request({
    path: "v3/catalog/products",
    method: "POST",
    body: product,
    storeHash: store_Hash,
  });

const apiTool = {
  writes: true,
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "create_product",
      description:
        "Create a new product in the BigCommerce catalog. Requires name, type, weight and price.",
      parameters: {
        type: "object",
        properties: {
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          name: { type: "string", description: "Product name." },
          type: {
            type: "string",
            enum: ["physical", "digital"],
            description: "Product type.",
          },
          weight: {
            type: "number",
            description: "Weight in the store's default unit.",
          },
          price: {
            type: "number",
            description: "Price excluding tax unless the store is tax-inclusive.",
          },
          sku: { type: "string", description: "Stock keeping unit." },
          description: {
            type: "string",
            description: "Product description; accepts HTML.",
          },
          categories: {
            type: "array",
            items: { type: "integer" },
            description: "Category IDs to assign the product to.",
          },
          brand_id: { type: "integer", description: "Brand ID." },
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
          cost_price: { type: "number", description: "Cost price." },
          retail_price: { type: "number", description: "Retail price." },
          sale_price: { type: "number", description: "Sale price." },
        },
        required: ["name", "type", "weight", "price"],
      },
    },
  },
};

export { apiTool };
