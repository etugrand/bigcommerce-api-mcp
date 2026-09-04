/**
 * Fetch the line items of an order from the BigCommerce Orders V2 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ order_id, store_Hash, ...query } = {}) =>
  request({
    path: `v2/orders/${order_id}/products`,
    query,
    storeHash: store_Hash,
  });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_order_products",
      description:
        "List the line items of an order: which products were bought, at what quantity and price. Pair with get_all_orders to find what a customer has purchased.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer", description: "The order ID." },
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          limit: {
            type: "integer",
            description: "Results per page (default 50, max 250).",
          },
          page: { type: "integer", description: "Page number (default 1)." },
        },
        required: ["order_id"],
      },
    },
  },
};

export { apiTool };
