/**
 * List customers from the BigCommerce Customers V3 API.
 */
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...query } = {}) =>
  request({ path: "v3/customers", query, storeHash: store_Hash });

const apiTool = {
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "get_all_customers",
      description:
        "List customers. Supports filtering by ID, email, name, company and dates, plus sorting and pagination.",
      parameters: {
        type: "object",
        properties: {
          store_Hash: {
            type: "string",
            description:
              "Optional store hash. Defaults to BIGCOMMERCE_STORE_HASH.",
          },
          "id:in": {
            type: "string",
            description: "Comma-separated customer IDs to include.",
          },
          "email:in": {
            type: "string",
            description: "Comma-separated email addresses to match exactly.",
          },
          "name:in": {
            type: "string",
            description: "Comma-separated full names to match exactly.",
          },
          "name:like": {
            type: "string",
            description: "Partial name match.",
          },
          "company:in": {
            type: "string",
            description: "Comma-separated company names.",
          },
          "phone:in": {
            type: "string",
            description: "Comma-separated phone numbers.",
          },
          "customer_group_id:in": {
            type: "string",
            description: "Comma-separated customer group IDs.",
          },
          "date_created:min": {
            type: "string",
            description: "Earliest creation date (ISO 8601 or RFC 2822).",
          },
          "date_created:max": {
            type: "string",
            description: "Latest creation date (ISO 8601 or RFC 2822).",
          },
          "date_modified:min": {
            type: "string",
            description: "Earliest modification date.",
          },
          "date_modified:max": {
            type: "string",
            description: "Latest modification date.",
          },
          include: {
            type: "string",
            description:
              "Sub-resources to embed, comma-separated: addresses, storecredit, attributes, formfields, shopper_profile_id, segment_ids.",
          },
          sort: {
            type: "string",
            description:
              "Sort expression, e.g. date_created:desc, last_name:asc, email:asc.",
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
