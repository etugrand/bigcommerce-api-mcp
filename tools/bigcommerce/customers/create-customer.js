/**
 * Create a customer via the BigCommerce Customers V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...customer } = {}) =>
  request({
    path: "v3/customers",
    method: "POST",
    // The V3 Customers endpoint takes a batch, so a single customer is wrapped.
    body: [customer],
    storeHash: store_Hash,
  });

const apiTool = {
  writes: true,
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "create_customer",
      description:
        "Create a new customer. Requires email, first_name and last_name. Fails if the email already exists in the store.",
      parameters: {
        type: "object",
        properties: {
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
        required: ["email", "first_name", "last_name"],
      },
    },
  },
};

export { apiTool };
