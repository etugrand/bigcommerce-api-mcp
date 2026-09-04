#!/usr/bin/env node

import dotenv from "dotenv";
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const SERVER_NAME = "bigcommerce-api-mcp";

async function transformTools(tools) {
  return tools
    .map((tool) => {
      const definitionFunction = tool.definition?.function;
      if (!definitionFunction) return;
      return {
        name: definitionFunction.name,
        description: definitionFunction.description,
        inputSchema: definitionFunction.parameters,
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(tools),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = tools.find((t) => t.definition.function.name === toolName);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
    const args = request.params.arguments;
    const requiredParameters =
      tool.definition?.function?.parameters?.required || [];
    for (const requiredParameter of requiredParameters) {
      if (!(requiredParameter in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${requiredParameter}`
        );
      }
    }
    try {
      const result = await tool.function(args);

      // Format response for better Agno compatibility
      // Check if result has error property and handle accordingly
      if (result && typeof result === 'object' && result.error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      // For successful results, provide both raw data and formatted text
      // This approach ensures compatibility with different MCP clients
      let formattedResult;
      if (typeof result === 'string') {
        formattedResult = result;
      } else if (typeof result === 'object' && result !== null) {
        // For objects, provide a more readable format for Agno
        if (Array.isArray(result)) {
          formattedResult = `Found ${result.length} items:\n${JSON.stringify(result, null, 2)}`;
        } else if (result.data && Array.isArray(result.data)) {
          formattedResult = `Found ${result.data.length} items:\n${JSON.stringify(result, null, 2)}`;
        } else {
          formattedResult = JSON.stringify(result, null, 2);
        }
      } else {
        formattedResult = String(result);
      }

      return {
        content: [
          {
            type: "text",
            text: formattedResult,
          },
        ],
        // Include metadata for advanced clients
        _meta: {
          toolName,
          resultType: typeof result,
          hasData: result && typeof result === 'object' && (result.data || Array.isArray(result)),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[Error] Failed to fetch data:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `API error: ${error.message}`
      );
    }
  });
}

// Authentication middleware
function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.MCP_AUTH_TOKEN;

  // Skip auth if no token is configured
  if (!expectedToken) {
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: Missing or invalid authorization header"
      },
      id: null
    });
  }

  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: Invalid token"
      },
      id: null
    });
  }

  next();
}

async function setupStreamableHttp(tools) {
  const app = express();
  app.use(express.json());

  // Add CORS middleware for better compatibility with web clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Mcp-Session-Id');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      server: SERVER_NAME,
      version: '0.1.0',
      capabilities: ['tools'],
      timestamp: new Date().toISOString(),
    });
  });

  // Add info endpoint for better discoverability
  app.get('/info', (req, res) => {
    res.status(200).json({
      name: SERVER_NAME,
      version: '0.1.0',
      description: 'BigCommerce API MCP server with tools for products, customers, and orders',
      capabilities: {
        tools: {},
      },
      supportedTransports: ['stdio', 'sse', 'streamable-http'],
    });
  });

  app.post("/mcp", authenticateRequest, async (req, res) => {
    try {
      const server = new Server(
        {
          name: SERVER_NAME,
          version: "0.1.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
      server.onerror = (error) => console.error("[Error]", error);
      await setupServerHandlers(server, tools);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", async () => {
        await transport.close();
        await server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "127.0.0.1";
  app.listen(port, host, () => {
    console.log(
      `[Streamable HTTP Server] running at http://${host}:${port}/mcp`
    );
    console.log(`[Health Check] available at http://${host}:${port}/health`);
    console.log(`[Server Info] available at http://${host}:${port}/info`);
  });
}

async function setupSSE(tools) {
  const app = express();
  const transports = {};
  const servers = {};

  // Add CORS middleware for better compatibility with web clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.get("/sse", authenticateRequest, async (_req, res) => {
    const server = new Server(
      {
        name: SERVER_NAME,
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    server.onerror = (error) => console.error("[Error]", error);
    await setupServerHandlers(server, tools);

    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    servers[transport.sessionId] = server;

    res.on("close", async () => {
      delete transports[transport.sessionId];
      await server.close();
      delete servers[transport.sessionId];
    });

    await server.connect(transport);
  });

  app.post("/messages", authenticateRequest, async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports[sessionId];
    const server = servers[sessionId];

    if (transport && server) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No transport/server found for sessionId");
    }
  });

  // Add health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      server: SERVER_NAME,
      version: '0.1.0',
      transport: 'sse',
      activeSessions: Object.keys(transports).length,
      timestamp: new Date().toISOString(),
    });
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "127.0.0.1";
  app.listen(port, host, () => {
    console.log(`[SSE Server] is running:`);
    console.log(`  SSE stream:    http://${host}:${port}/sse`);
    console.log(`  Message input: http://${host}:${port}/messages`);
    console.log(`  Health Check:  http://${host}:${port}/health`);
  });
}

async function setupStdio(tools) {
  // stdio mode: single server instance
  const server = new Server(
    {
      name: SERVER_NAME,
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  server.onerror = (error) => console.error("[Error]", error);
  await setupServerHandlers(server, tools);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function run() {
  const args = process.argv.slice(2);
  const isStreamableHttp = args.includes("--streamable-http");
  const isSSE = args.includes("--sse");

  try {
    const tools = await discoverTools();
    console.log(`[Server] Loaded ${tools.length} tools successfully`);

    if (isStreamableHttp && isSSE) {
      console.error("Error: Cannot specify both --streamable-http and --sse");
      process.exit(1);
    }

    if (isStreamableHttp) {
      await setupStreamableHttp(tools);
    } else if (isSSE) {
      await setupSSE(tools);
    } else {
      await setupStdio(tools);
    }
  } catch (error) {
    console.error("[Error] Failed to start server:", error.message);

    // If in HTTP mode, still start the server with an empty tools array for health checks
    if (isStreamableHttp || isSSE) {
      console.log("[Server] Starting with limited functionality due to initialization error");
      const tools = [];

      if (isStreamableHttp) {
        await setupStreamableHttp(tools);
      } else if (isSSE) {
        await setupSSE(tools);
      }
    } else {
      process.exit(1);
    }
  }
}

run().catch(console.error);
