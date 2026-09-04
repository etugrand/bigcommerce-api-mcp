/**
 * List orders from the BigCommerce Orders V2 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...query } = {}) =>
  request({ path: "v2/orders", query, storeHash: store_Hash });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_all_orders",
      description:
        "List orders. Filter by customer, email, status, date range or total to find a customer's purchase history.",
      parameters: {
        type: "object",
        properties: {
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          customer_id: {
            type: "integer",
            description: "Filter to one customer's orders.",
          },
          email: { type: "string", description: "Filter by customer email." },
          status_id: {
            type: "integer",
            description:
              "Filter by status ID, e.g. 1 Pending, 2 Shipped, 5 Cancelled, 7 Awaiting Payment, 11 Awaiting Fulfillment.",
          },
          min_id: { type: "integer", description: "Minimum order ID." },
          max_id: { type: "integer", description: "Maximum order ID." },
          min_total: { type: "number", description: "Minimum order total." },
          max_total: { type: "number", description: "Maximum order total." },
          min_date_created: {
            type: "string",
            description: "Earliest creation date (RFC 2822 or ISO 8601).",
          },
          max_date_created: {
            type: "string",
            description: "Latest creation date (RFC 2822 or ISO 8601).",
          },
          min_date_modified: {
            type: "string",
            description: "Earliest modification date.",
          },
          max_date_modified: {
            type: "string",
            description: "Latest modification date.",
          },
          channel_id: { type: "integer", description: "Filter by channel ID." },
          payment_method: {
            type: "string",
            description: "Filter by payment method, e.g. credit_card, paypal.",
          },
          cart_id: { type: "string", description: "Filter by cart ID." },
          external_order_id: {
            type: "string",
            description: "Filter by external order ID.",
          },
          is_deleted: {
            type: "boolean",
            description: "Return archived orders instead of active ones.",
          },
          sort: {
            type: "string",
            description: "Sort expression, e.g. date_created:desc, id:asc.",
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
