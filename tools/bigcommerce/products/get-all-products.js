/**
 * List products from the BigCommerce Catalog V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...query } = {}) =>
  request({ path: "v3/catalog/products", query, storeHash: store_Hash });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_all_products",
      description:
        "List products from the BigCommerce catalog. Supports filtering, sorting and pagination. Store hash defaults to BIGCOMMERCE_STORE_HASH.",
      parameters: {
        type: "object",
        properties: {
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          name: { type: "string", description: "Filter by exact product name." },
          keyword: {
            type: "string",
            description:
              "Fuzzy search across name, SKU and description. Use this for partial-text search; there is no name:like filter.",
          },
          sku: { type: "string", description: "Filter by exact SKU." },
          "sku:in": {
            type: "string",
            description: "Comma-separated SKUs to include.",
          },
          upc: { type: "string", description: "Filter by exact UPC." },
          "id:in": {
            type: "string",
            description: "Comma-separated product IDs to include.",
          },
          categories: {
            type: "integer",
            description: "Filter by category ID.",
          },
          brand_id: { type: "integer", description: "Filter by brand ID." },
          type: {
            type: "string",
            enum: ["physical", "digital"],
            description: "Filter by product type.",
          },
          is_visible: {
            type: "boolean",
            description: "Filter by storefront visibility.",
          },
          price: {
            type: "number",
            description:
              "Filter by exact price. The catalog API has no price range filter.",
          },
          availability: {
            type: "string",
            enum: ["available", "disabled", "preorder"],
            description: "Filter by availability.",
          },
          is_featured: {
            type: "boolean",
            description: "Filter to featured products.",
          },
          out_of_stock: {
            type: "boolean",
            description: "Return only products that are out of stock.",
          },
          inventory_low: {
            type: "integer",
            description: "Set to 1 to return products at or below their low-stock warning level.",
          },
          "date_modified:min": {
            type: "string",
            description: "Earliest modification date (ISO 8601).",
          },
          "date_modified:max": {
            type: "string",
            description: "Latest modification date (ISO 8601).",
          },
          "inventory_level:min": {
            type: "integer",
            description: "Minimum inventory level.",
          },
          "inventory_level:max": {
            type: "integer",
            description: "Maximum inventory level.",
          },
          include: {
            type: "string",
            description:
              "Sub-resources to embed, comma-separated: variants, images, custom_fields, bulk_pricing_rules, primary_image, modifiers, options, videos.",
          },
          include_fields: {
            type: "string",
            description:
              "Comma-separated fields to return. Use this to keep responses small.",
          },
          sort: {
            type: "string",
            description:
              "Sort field, e.g. name, price, date_modified, inventory_level, total_sold.",
          },
          direction: {
            type: "string",
            enum: ["asc", "desc"],
            description: "Sort direction.",
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
