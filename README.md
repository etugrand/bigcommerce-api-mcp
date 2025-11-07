# BigCommerce MCP Server

A comprehensive Model Context Protocol (MCP) server for BigCommerce REST API integration. This server provides AI assistants with the ability to interact with BigCommerce stores through three powerful tools:

- 🛍️ **Products Management**: Get all products with advanced filtering
- 👥 **Customer Management**: Retrieve and filter customers with comprehensive search options  
- 📦 **Order Management**: Access orders with customer-product relationship capabilities

<a href="https://glama.ai/mcp/servers/@isaacgounton/bigcommerce-api-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@isaacgounton/bigcommerce-api-mcp/badge" alt="BigCommerce API Server MCP server" />
</a>

## ✨ Features

- ✅ MCP-compatible server with built-in tool discovery
- ✅ Enhanced filtering capabilities on all endpoints
- ✅ Customer-product association through order history
- ✅ Comprehensive error handling and validation
- ✅ Docker support for production deployment
- ✅ Compatible with Claude Desktop, Cline, and other MCP clients

## 🚦 Getting Started

### ⚙️ Prerequisites

- [Node.js (v18+ required, v20+ recommended)](https://nodejs.org/)
- [npm](https://www.npmjs.com/) (included with Node)
- BigCommerce store with API credentials

### 📥 Installation & Setup

**1. Clone and install dependencies**

```sh
git clone https://github.com/isaacgounton/bigcommerce-api-mcp.git
cd bigcommerce-api-mcp
npm install
```

**2. Configure your BigCommerce credentials**

Create a `.env` file in the project root:

```env
BIGCOMMERCE_STORE_HASH=your_store_hash_here
BIGCOMMERCE_API_KEY=your_api_key_here
```

**How to get your BigCommerce credentials:**
1. Go to your BigCommerce admin panel
2. Navigate to **Advanced Settings** > **API Accounts** 
3. Create a new API account with the following scopes:
   - **Products**: Read-only or Modify
   - **Orders**: Read-only or Modify  
   - **Customers**: Read-only or Modify
4. Copy the **Store Hash** and **Access Token** to your `.env` file

### 🔧 Available Tools

**`get_all_products`**
- Retrieve products from your BigCommerce store
- Parameters: `store_Hash` (required)

**`get_all_customers`** 
- Search and filter customers with advanced options
- Parameters: `store_Hash` (required)
- Optional filters: `email`, `name`, `company`, `phone`, `customer_group_id`, `limit`, `page`, `date_created`, `date_modified`

**`get_all_orders`**
- Access orders with customer-product relationship data
- Parameters: `store_Hash` (required) 
- Optional filters: `customer_id`, `email`, `status_id`, `min_id`, `max_id`, `limit`, `page`
- ✨ **Special feature**: Filter by `customer_id` to see all products associated with a specific customer

## 🔗 Client Integration

### 💬 Claude Desktop

**Step 1**: Get the absolute paths to node and mcpServer.js:

```sh
which node
# Example output: /usr/bin/node

realpath mcpServer.js  
# Example output: /home/user/bigcommerce-api-mcp/mcpServer.js
```

**Step 2**: Open Claude Desktop → **Settings** → **Developer** → **Edit Config** and add:

```json
{
  "mcpServers": {
    "bigcommerce": {
      "command": "/usr/bin/node",
      "args": ["/absolute/path/to/your/mcpServer.js"],
      "env": {
        "BIGCOMMERCE_STORE_HASH": "your_store_hash_here",
        "BIGCOMMERCE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Step 3**: Restart Claude Desktop. Look for a green circle next to "bigcommerce" in the MCP section.

### 🔌 Cline (VS Code Extension)

**Step 1**: Install the Cline extension in VS Code

**Step 2**: Open VS Code settings and search for "Cline MCP"

**Step 3**: Add your MCP server configuration:

```json
{
  "cline.mcp.servers": {
    "bigcommerce": {
      "command": "node",
      "args": ["/absolute/path/to/mcpServer.js"],
      "env": {
        "BIGCOMMERCE_STORE_HASH": "your_store_hash_here", 
        "BIGCOMMERCE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 🤖 Other MCP Clients

For any MCP-compatible client, use these connection details:

- **Command**: `node`
- **Args**: `["/path/to/mcpServer.js"]`
- **Environment Variables**: 
  - `BIGCOMMERCE_STORE_HASH`
  - `BIGCOMMERCE_API_KEY`

## 🐳 Docker Deployment

### Quick Start

**1. Build the Docker image:**

```sh
docker build -t bigcommerce-mcp .
```

**2. Run with environment variables:**

```sh
docker run -i --rm \
  -e BIGCOMMERCE_STORE_HASH=your_store_hash \
  -e BIGCOMMERCE_API_KEY=your_api_key \
  bigcommerce-mcp
```

### Claude Desktop with Docker

Update your Claude Desktop config to use Docker:

```json
{
  "mcpServers": {
    "bigcommerce": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", 
        "-e", "BIGCOMMERCE_STORE_HASH=your_store_hash",
        "-e", "BIGCOMMERCE_API_KEY=your_api_key", 
        "bigcommerce-mcp"
      ]
    }
  }
}
```

### Docker Compose (Production)

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  bigcommerce-mcp:
    build: .
    environment:
      - BIGCOMMERCE_STORE_HASH=${BIGCOMMERCE_STORE_HASH}
      - BIGCOMMERCE_API_KEY=${BIGCOMMERCE_API_KEY}
    restart: unless-stopped
```

Then run:

```sh
docker-compose up -d
```

## 🧪 Testing

### Local Testing

Test the server locally to ensure it's working:

```sh
# Test tool discovery
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | node mcpServer.js

# Test a tool call  
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_all_products","arguments":{"store_Hash":"your_store_hash"}},"id":2}' | node mcpServer.js
```

### Postman Integration (Optional)

You can also test with Postman Desktop:

1. Download [Postman Desktop](https://www.postman.com/downloads/)
2. Create a new MCP request with type `STDIO`
3. Set command to: `node /absolute/path/to/mcpServer.js`
4. Test your tools before connecting to AI clients

## 🛠️ Advanced Usage

### Server Modes

**Standard stdio mode (default):**
```sh
node mcpServer.js
```

**HTTP mode with Server-Sent Events:**
```sh  
node mcpServer.js --sse
```

**Streamable HTTP mode:**
```sh
node mcpServer.js --streamable-http
```

### Environment Variables

All BigCommerce credentials can be provided via environment variables:

```bash
export BIGCOMMERCE_STORE_HASH="your_store_hash"
export BIGCOMMERCE_API_KEY="your_api_key" 
node mcpServer.js
```

## 🔍 Tool Examples

### Find products associated with a customer

```javascript
// Use get_all_orders with customer_id filter
{
  "name": "get_all_orders", 
  "arguments": {
    "store_Hash": "your_store_hash",
    "customer_id": "3"
  }
}
```

### Search customers by email

```javascript
// Use get_all_customers with email filter
{
  "name": "get_all_customers",
  "arguments": {
    "store_Hash": "your_store_hash", 
    "email": "customer@example.com"
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support & Questions

- 🐛 **Issues**: [GitHub Issues](https://github.com/isaacgounton/bigcommerce-api-mcp/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/isaacgounton/bigcommerce-api-mcp/discussions)
- 📖 **MCP Documentation**: [Model Context Protocol](https://modelcontextprotocol.io/)
- 🏪 **BigCommerce API Docs**: [BigCommerce API Reference](https://developer.bigcommerce.com/docs/rest-management)

## 🚀 What's Next?

This MCP server provides a solid foundation for BigCommerce integration. Possible enhancements include:

- Additional BigCommerce API endpoints (categories, brands, etc.)
- Webhook support for real-time updates
- Advanced filtering and search capabilities
- Multi-store support
- Product modification tools (create/update/delete)

---

**Built with ❤️ for the MCP community**