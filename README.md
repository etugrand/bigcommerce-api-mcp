# BigCommerce MCP Server

An MCP server for the BigCommerce REST API. Gives an AI assistant read access
to your catalog, customers and orders — and, when you turn it on, the ability
to change them.

## Tools

**Read**

| Tool | What it does |
| --- | --- |
| `get_all_products` | List products with filtering, sorting and pagination |
| `get_product` | One product by ID, optionally with variants and images |
| `get_all_customers` | List customers by ID, email, name, company or date range |
| `get_all_orders` | List orders by customer, status, date range or total |
| `get_order` | One order by ID |
| `get_order_products` | An order's line items — what was actually bought |
| `list_categories` | Resolve category names to the IDs product filters need |
| `list_brands` | Resolve brand names to the IDs product filters need |

**Write** — requires `BIGCOMMERCE_ENABLE_WRITES=true`

| Tool | What it does |
| --- | --- |
| `create_product` | Create a catalog product |
| `update_product` | Update price, stock, visibility, categories… |
| `create_customer` | Create a customer record |
| `update_customer` | Update a customer's details |
| `update_order` | Change status, staff notes or customer message |

Write tools aren't registered at all unless enabled, so a default deployment
can't modify your store even if someone reaches its endpoint.

`npm run list-tools` prints the tools and parameters as currently configured.

## Setup

Needs Node 20+.

```sh
git clone https://github.com/isaacgounton/bigcommerce-api-mcp.git
cd bigcommerce-api-mcp
npm install
cp .env.example .env
```

Then fill in `.env`:

```env
BIGCOMMERCE_STORE_HASH=your_store_hash_here
BIGCOMMERCE_API_KEY=your_api_key_here
```

Get both from BigCommerce admin → **Settings** → **API accounts** → **Create
API account**. Grant Products, Orders and Customers — read-only unless you
plan to enable writes. `.env.example` documents every supported variable.

## Running

```sh
npm start          # stdio — Claude Desktop, Cline, local clients
npm run start:http # streamable HTTP — remote clients and agent runtimes
```

HTTP mode serves `POST /mcp`, plus unauthenticated `GET /health` and `/info`.

> The SSE transport was removed in favour of Streamable HTTP, which replaced it
> in the MCP spec. Point any client still using `/sse` at `/mcp`.

### Claude Desktop

In `claude_desktop_config.json` (use absolute paths — `which node`):

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

### Over HTTP

```sh
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Security

Anyone who can call `/mcp` acts with your store's API credentials.

- **`HOST`** — binds to `127.0.0.1` by default. Set `0.0.0.0` only when you
  mean to expose it, and put it behind a proxy or firewall when you do.
- **`MCP_AUTH_TOKEN`** — when set, every `/mcp` request must carry
  `Authorization: Bearer <token>`. Comparison is timing-safe. Set it whenever
  the server is reachable beyond localhost.
- **`ALLOWED_ORIGINS`** — requests carrying an `Origin` header are refused
  unless listed here, which blocks DNS-rebinding attacks where a page you visit
  drives your local server. Non-browser clients send no `Origin` and are
  unaffected.
- **`BIGCOMMERCE_ENABLE_WRITES`** — leave off if the assistant only reads.
- **Scopes** — give the API account the narrowest scopes that work. A
  read-only token can't be widened by a bug in this server.

## Docker

```sh
docker build -t bigcommerce-mcp .
docker run --rm -p 3000:3000 --env-file .env bigcommerce-mcp
```

The image sets `HOST=0.0.0.0` so the published port is reachable. Set
`MCP_AUTH_TOKEN` before exposing the container.

## Development

```sh
npm test           # protocol, auth, origin, discovery and spec conformance — no credentials needed
npm run test:live  # smoke-test read tools against a real store (needs .env)
npm run sync-spec  # refresh the query-parameter fixture from BigCommerce's OpenAPI specs
```

`npm test` checks every query parameter a tool declares against BigCommerce's
published specs. This matters because BigCommerce **ignores unknown query
parameters** rather than rejecting them — an invented filter silently returns
unfiltered data, which is worse than an error.

To add a tool, drop a file under `tools/bigcommerce/<group>/` exporting an
`apiTool` — it's discovered automatically. `lib/bigcommerce.js` handles
credentials, query building, errors and parsing, so a tool is usually just a
path and a schema; copy `tools/bigcommerce/catalog/list-brands.js`. Set
`writes: true` on anything that mutates the store.

MIT
