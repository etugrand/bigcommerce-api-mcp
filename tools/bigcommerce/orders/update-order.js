/**
 * Update an order via the BigCommerce Orders V2 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ order_id, store_Hash, ...fields } = {}) =>
  request({
    path: `v2/orders/${order_id}`,
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
      name: "update_order",
      description:
        "Update an order, most commonly to move it to a new status. Changing status_id can trigger customer emails and inventory changes.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer", description: "The order ID to update." },
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          status_id: {
            type: "integer",
            description:
              "New status ID, e.g. 1 Pending, 2 Shipped, 3 Partially Shipped, 4 Refunded, 5 Cancelled, 6 Declined, 7 Awaiting Payment, 8 Awaiting Pickup, 9 Awaiting Shipment, 10 Completed, 11 Awaiting Fulfillment.",
          },
          staff_notes: { type: "string", description: "Internal staff notes." },
          customer_message: {
            type: "string",
            description: "Message shown to the customer.",
          },
          is_deleted: {
            type: "boolean",
            description: "Archive (true) or restore (false) the order.",
          },
        },
        required: ["order_id"],
      },
    },
  },
};

export { apiTool };
