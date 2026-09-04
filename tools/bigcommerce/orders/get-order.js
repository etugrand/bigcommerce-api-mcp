/**
 * Fetch a single order by ID from the BigCommerce Orders V2 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ order_id, store_Hash } = {}) =>
  request({ path: `v2/orders/${order_id}`, storeHash: store_Hash });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_order",
      description:
        "Get one order by its ID, including totals, status and billing address. Use get_order_products for the line items.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer", description: "The order ID to fetch." },
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
        },
        required: ["order_id"],
      },
    },
  },
};

export { apiTool };
