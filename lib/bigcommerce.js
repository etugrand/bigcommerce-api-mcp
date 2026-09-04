/**
 * Shared BigCommerce REST client.
 *
 * Every tool routes through here so credential handling, query building,
 * error shaping and response parsing exist in exactly one place.
 *
 * Env loading lives in the entry points (mcpServer.js, index.js), not here:
 * dotenv writes a banner to stdout, which corrupts the stdio JSON-RPC stream.
 */
// Overridable so tests can point at a stub; unset in every real deployment.
const baseUrl = () =>
  process.env.BIGCOMMERCE_API_BASE_URL ?? "https://api.bigcommerce.com/stores";

/** Write tools are only registered when this is explicitly enabled. */
export const writesEnabled = () =>
  /^(1|true|yes)$/i.test(process.env.BIGCOMMERCE_ENABLE_WRITES ?? "");

/**
 * Reads credentials from the environment, failing loudly when they are absent.
 * @param {string} [storeHashOverride] - Per-call store hash; falls back to BIGCOMMERCE_STORE_HASH.
 */
function credentials(storeHashOverride) {
  const apiKey = process.env.BIGCOMMERCE_API_KEY;
  const storeHash = storeHashOverride || process.env.BIGCOMMERCE_STORE_HASH;

  if (!apiKey) {
    throw new Error(
      "BIGCOMMERCE_API_KEY is not set. Add it to .env or the server environment."
    );
  }
  if (!storeHash) {
    throw new Error(
      "No store hash available. Set BIGCOMMERCE_STORE_HASH or pass store_Hash."
    );
  }
  return { apiKey, storeHash };
}

/**
 * Builds a query string, dropping undefined/null/empty values.
 * @param {Object} params - Raw parameters, may contain undefined values.
 * @returns {string} - Query string including the leading "?", or "".
 */
export function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.append(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Performs a request against the BigCommerce API.
 *
 * @param {Object} options
 * @param {string} options.path - Path after the store hash, e.g. "v3/catalog/products".
 * @param {string} [options.method] - HTTP method, defaults to GET.
 * @param {Object} [options.query] - Query parameters; undefined values are dropped.
 * @param {Object|Array} [options.body] - JSON request body.
 * @param {string} [options.storeHash] - Overrides BIGCOMMERCE_STORE_HASH.
 * @returns {Promise<Object>} - Parsed response, or `{ error }` on failure.
 */
export async function request({ path, method = "GET", query, body, storeHash }) {
  try {
    const { apiKey, storeHash: hash } = credentials(storeHash);
    const url = `${baseUrl()}/${hash}/${path}${buildQuery(query)}`;

    const response = await fetch(url, {
      method,
      headers: {
        "X-Auth-Token": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      // BigCommerce returns a JSON error envelope for most failures, HTML for a few.
      throw new Error(
        `HTTP ${response.status} ${method} ${path}: ${
          text ? text.slice(0, 500) : response.statusText
        }`
      );
    }

    // 204 No Content, and DELETE responses generally, have an empty body.
    if (!text.trim()) return { data: null, meta: {} };

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
