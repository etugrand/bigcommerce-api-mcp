#!/usr/bin/env node

import dotenv from "dotenv";
import express from "express";
import { timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";
import { writesEnabled } from "./lib/bigcommerce.js";

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, ".env"), quiet: true });

const SERVER_NAME = "bigcommerce-api-mcp";
const SERVER_VERSION = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8")
).version;

// stdio mode speaks JSON-RPC over stdout, so all logging goes to stderr.
const log = (...args) => console.error(...args);

function createServer() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );
  server.onerror = (error) => log("[Error]", error);
  return server;
}

function transformTools(tools) {
  return tools.map(({ definition }) => ({
    name: definition.function.name,
    description: definition.function.description,
    inputSchema: definition.function.parameters,
  }));
}

async function setupServerHandlers(server, tools) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: transformTools(tools),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = tools.find((t) => t.definition.function.name === toolName);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    const args = request.params.arguments ?? {};
    const required = tool.definition.function.parameters?.required ?? [];
    for (const parameter of required) {
      if (!(parameter in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${parameter}`
        );
      }
    }

    let result;
    try {
      result = await tool.function(args);
    } catch (error) {
      log("[Error] Tool threw:", error);
      throw new McpError(ErrorCode.InternalError, `API error: ${error.message}`);
    }

    if (result?.error) {
      return {
        content: [{ type: "text", text: `Error: ${result.error}` }],
        isError: true,
      };
    }

    // structuredContent must be an object; V2 endpoints return bare arrays.
    const structured = Array.isArray(result) ? { data: result } : result;

    return {
      // Text stays alongside structuredContent for clients that ignore it.
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: structured,
    };
  });
}

/** Rejects requests without a valid bearer token, when a token is configured. */
function authenticateRequest(req, res, next) {
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  if (!expectedToken) return next();

  const unauthorized = (message) =>
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: `Unauthorized: ${message}` },
      id: null,
    });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("missing or invalid authorization header");
  }

  const provided = Buffer.from(authHeader.slice(7));
  const expected = Buffer.from(expectedToken);
  const valid =
    provided.length === expected.length && timingSafeEqual(provided, expected);

  return valid ? next() : unauthorized("invalid token");
}

/**
 * Blocks cross-origin browser requests, which the MCP spec requires for local
 * HTTP servers: without it any website the operator visits can drive this
 * server through the browser (DNS rebinding).
 */
function originGuard(req, res, next) {
  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = req.headers.origin;

  // No Origin header means a non-browser client (Claude Desktop, curl, agents).
  if (!origin) return next();

  if (!allowed.includes(origin)) {
    return res.status(403).json({
      jsonrpc: "2.0",
      error: {
        code: -32003,
        message: `Forbidden: origin ${origin} is not in ALLOWED_ORIGINS`,
      },
      id: null,
    });
  }

  res.header("Access-Control-Allow-Origin", origin);
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version"
  );
  return req.method === "OPTIONS" ? res.sendStatus(204) : next();
}

async function setupStreamableHttp(tools) {
  const app = express();
  app.use(express.json());
  app.use(originGuard);

  const info = {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    capabilities: { tools: {} },
    transport: "streamable-http",
    tools: tools.length,
    writesEnabled: writesEnabled(),
  };

  app.get("/health", (_req, res) =>
    res.json({ status: "healthy", ...info, timestamp: new Date().toISOString() })
  );

  app.get("/info", (_req, res) =>
    res.json({
      ...info,
      description:
        "BigCommerce API MCP server with tools for products, customers and orders",
    })
  );

  app.post("/mcp", authenticateRequest, async (req, res) => {
    try {
      const server = createServer();
      await setupServerHandlers(server, tools);

      // Stateless: one server and transport per request, torn down on close.
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
      log("[Error] Failed to handle MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "127.0.0.1";
  app.listen(port, host, () => {
    log(`[Streamable HTTP] listening at http://${host}:${port}/mcp`);
    log(`[Streamable HTTP] health at http://${host}:${port}/health`);
  });
}

async function setupStdio(tools) {
  const server = createServer();
  await setupServerHandlers(server, tools);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  await server.connect(new StdioServerTransport());
}

async function run() {
  const useHttp = process.argv.slice(2).includes("--streamable-http");

  try {
    const tools = await discoverTools();
    log(
      `[Server] loaded ${tools.length} tools (writes ${
        writesEnabled() ? "enabled" : "disabled"
      })`
    );
    await (useHttp ? setupStreamableHttp(tools) : setupStdio(tools));
  } catch (error) {
    log("[Error] Failed to start server:", error);
    process.exit(1);
  }
}

run();
