/**
 * Update a customer via the BigCommerce Customers V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ customer_id, store_Hash, ...fields } = {}) =>
  request({
    path: "v3/customers",
    method: "PUT",
    // V3 updates are batched and carry the id in the body, not the path.
    body: [{ id: customer_id, ...fields }],
    storeHash: store_Hash,
  });

const apiTool = {
  writes: true,
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "update_customer",
      description:
        "Update an existing customer. Only the fields you pass are changed.",
      parameters: {
        type: "object",
        properties: {
          customer_id: {
            type: "integer",
            description: "The customer ID to update.",
          },
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          email: { type: "string", description: "Customer email address." },
          first_name: { type: "string", description: "First name." },
          last_name: { type: "string", description: "Last name." },
          company: { type: "string", description: "Company name." },
          phone: { type: "string", description: "Phone number." },
          notes: { type: "string", description: "Internal notes." },
          customer_group_id: {
            type: "integer",
            description: "Customer group to assign.",
          },
          tax_exempt_category: {
            type: "string",
            description: "Tax exempt category code.",
          },
        },
        required: ["customer_id"],
      },
    },
  },
};

export { apiTool };
