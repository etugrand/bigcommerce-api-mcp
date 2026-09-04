# BigCommerce MCP Server

A Model Context Protocol (MCP) server for the BigCommerce REST API. It gives an
AI assistant read access to your catalog, customers and orders — and, when you
explicitly turn it on, the ability to change them.

## Tools

**Read (always available)**

| Tool | What it does |
| --- | --- |
| `get_all_products` | List products with filtering, sorting and pagination |
| `get_product` | Fetch one product by ID, optionally with variants and images |
| `get_all_customers` | List customers by ID, email, name, company or date range |
| `get_all_orders` | List orders by customer, status, date range or total |
| `get_order` | Fetch one order by ID |
| `get_order_products` | List an order's line items — what was actually bought |
| `list_categories` | Resolve category names to the IDs the product filters need |
| `list_brands` | Resolve brand names to the IDs the product filters need |

**Write (requires `BIGCOMMERCE_ENABLE_WRITES=true`)**

| Tool | What it does |
| --- | --- |
| `create_product` | Create a catalog product |
| `update_product` | Update a product's price, stock, visibility, categories… |
| `create_customer` | Create a customer record |
| `update_customer` | Update a customer's details |
| `update_order` | Change an order's status, staff notes or customer message |

Write tools are **not registered at all** unless you enable them, so a default
deployment cannot modify your store even if someone reaches its endpoint.
Enabling them also requires modify scopes on your BigCommerce API account.

To see the tools and their parameters as configured:

```sh
npm run list-tools
```

## Getting started

### Prerequisites

- Node.js v20 or later
- A BigCommerce store with API credentials

### Install

```sh
git clone https://github.com/isaacgounton/bigcommerce-api-mcp.git
cd bigcommerce-api-mcp
npm install
cp .env.example .env
```

### Configure

Fill in `.env`. At minimum:

```env
BIGCOMMERCE_STORE_HASH=your_store_hash_here
BIGCOMMERCE_API_KEY=your_api_key_here
```

To get these: BigCommerce admin → **Settings** → **API accounts** → **Create
API account**. Grant the scopes you need (Products, Orders, Customers — read
only unless you plan to enable writes), then copy the **Store Hash** and
**Access Token**.

See `.env.example` for every supported variable.

## Transports

### stdio (default) — for Claude Desktop, Cline and local clients

```sh
npm start
```

### Streamable HTTP — for remote clients and agent runtimes

```sh
npm run start:http
```

Serves `POST /mcp`, plus unauthenticated `GET /health` and `GET /info`.

> The SSE transport was removed in favour of Streamable HTTP, which replaced it
> in the MCP specification. Point any client still using `/sse` at `/mcp`.

## Client integration

### Claude Desktop

Find your absolute node path with `which node`, then edit
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bigcommerce": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/bigcommerce-api-mcp/mcpServer.js"],
      "env": {
        "BIGCOMMERCE_STORE_HASH": "your_store_hash",
        "BIGCOMMERCE_API_KEY": "your_api_key"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

### Remote clients over HTTP

```sh
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Security

The HTTP transport is only as safe as how you deploy it. Anyone who can call
`/mcp` acts with your store's API credentials.

- **Bind address.** The server listens on `127.0.0.1` by default. Set
  `HOST=0.0.0.0` only when you intend to expose it, and put it behind a proxy
  or firewall when you do.
- **Bearer token.** Set `MCP_AUTH_TOKEN` and every `/mcp` request must carry
  `Authorization: Bearer <token>`. Comparison is timing-safe. Set this
  whenever the server is reachable beyond localhost.
- **Browser origins.** Requests carrying an `Origin` header are refused unless
  that origin is listed in `ALLOWED_ORIGINS`. This blocks DNS-rebinding
  attacks, where a page the operator visits drives a localhost MCP server.
  Non-browser clients send no `Origin` and are unaffected.
- **Writes.** Off unless `BIGCOMMERCE_ENABLE_WRITES=true`. Leave it off if the
  assistant only needs to read.
- **Scopes.** Give the API account the narrowest scopes that work. A read-only
  token cannot be turned into a write token by a bug in this server.

## Docker

```sh
docker build -t bigcommerce-mcp .
docker run --rm -p 3000:3000 --env-file .env bigcommerce-mcp
```

The image sets `HOST=0.0.0.0` so the published port is reachable. Set
`MCP_AUTH_TOKEN` in your `.env` before exposing the container.

## Development

```sh
npm test          # protocol, auth, origin and discovery tests — no credentials needed
npm run test:live # smoke-test every read tool against a real store (needs .env)
npm run list-tools
```

### Adding a tool

Drop a file under `tools/bigcommerce/<group>/`; it is discovered automatically.

```js
import { request } from "../../../lib/bigcommerce.js";

const executeFunction = async ({ store_Hash, ...query } = {}) =>
  request({ path: "v3/catalog/summary", query, storeHash: store_Hash });

const apiTool = {
  writes: false, // set true for anything that mutates the store
  function: executeFunction,
  definition: {
    type: "function",
    function: {
      name: "catalog_summary",
      description: "Get aggregate catalog counts.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
};

export { apiTool };
```

`lib/bigcommerce.js` handles credentials, query building, error shaping and
JSON parsing, so a tool is usually just a path and a schema.

## Project layout

```
mcpServer.js            MCP server: stdio and streamable-http transports
index.js                CLI entry point
lib/bigcommerce.js      Shared REST client
lib/tools.js            Tool discovery and write gating
tools/bigcommerce/      Tool definitions, grouped by resource
test/server.test.js     Test suite
```

## License

MIT
