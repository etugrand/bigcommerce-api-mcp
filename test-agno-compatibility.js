#!/usr/bin/env node

/**
 * Test script to verify BigCommerce MCP server compatibility with Agno
 * 
 * This script demonstrates how to use the BigCommerce MCP server with Agno's MCPTools
 * Run with: node test-agno-compatibility.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Mock Agno MCPTools behavior to test compatibility
class MockMCPTools {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.isConnected = false;
    }

    async connect() {
        console.log(`🔗 Connecting to MCP server: ${this.serverUrl}`);

        try {
            // Test health check
            const healthResponse = await fetch(`${this.serverUrl.replace('/mcp', '')}/health`);
            if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                console.log(`✅ Health check passed:`, healthData);
            }

            // Test server info
            try {
                const infoResponse = await fetch(`${this.serverUrl.replace('/mcp', '')}/info`);
                if (infoResponse.ok) {
                    const infoData = await infoResponse.json();
                    console.log(`ℹ️  Server info:`, infoData);
                }
            } catch (e) {
                console.log(`⚠️  Server info endpoint not available`);
            }

            // Test tools listing
            const toolsRequest = {
                jsonrpc: "2.0",
                id: "test-tools",
                method: "tools/list",
                params: {}
            };

            const toolsResponse = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                    'Authorization': `Bearer ${process.env.MCP_AUTH_TOKEN}`
                },
                body: JSON.stringify(toolsRequest)
            });

            if (!toolsResponse.ok) {
                throw new Error(`Tools request failed: ${toolsResponse.status}`);
            }

            // Parse SSE response
            const responseText = await toolsResponse.text();
            const toolsData = this.parseSSEResponse(responseText);
            console.log(`🛠️  Available tools:`, toolsData.result?.tools?.map(t => t.name) || []);

            this.isConnected = true;
            console.log(`✅ Successfully connected to MCP server`);

            return toolsData.result?.tools || [];
        } catch (error) {
            console.error(`❌ Failed to connect:`, error.message);
            throw error;
        }
    }

    async callTool(toolName, args) {
        if (!this.isConnected) {
            throw new Error('Not connected to MCP server');
        }

        console.log(`🔧 Calling tool: ${toolName} with args:`, args);

        const request = {
            jsonrpc: "2.0",
            id: `test-${toolName}-${Date.now()}`,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: args
            }
        };

        try {
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream',
                    'Authorization': `Bearer ${process.env.MCP_AUTH_TOKEN}`
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Tool call failed: ${response.status}`);
            }

            // Parse SSE response  
            const responseText = await response.text();
            const data = this.parseSSEResponse(responseText);

            if (data.error) {
                console.error(`❌ Tool error:`, data.error);
                throw new Error(data.error.message);
            }

            console.log(`✅ Tool result received:`, {
                toolName,
                hasContent: !!data.result?.content,
                contentType: data.result?.content?.[0]?.type,
                hasMeta: !!data.result?._meta,
                resultKeys: Object.keys(data.result || {})
            });

            return data.result;
        } catch (error) {
            console.error(`❌ Tool call failed:`, error.message);
            throw error;
        }
    }

    parseSSEResponse(sseText) {
        // Parse Server-Sent Events format
        const lines = sseText.split('\n');
        let eventType = '';
        let data = '';

        for (const line of lines) {
            if (line.startsWith('event: ')) {
                eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
                data += line.substring(6);
            } else if (line === '' && data) {
                // End of event
                try {
                    return JSON.parse(data);
                } catch (e) {
                    console.warn('Failed to parse SSE data as JSON:', data);
                    return { result: { tools: [] } };
                }
            }
        }

        // If no complete event found, try to parse the last data
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.warn('Failed to parse SSE data as JSON:', data);
                return { result: { tools: [] } };
            }
        }

        return { result: { tools: [] } };
    }

    async close() {
        this.isConnected = false;
        console.log(`🔌 Disconnected from MCP server`);
    }
}

async function testAgnoCompatibility() {
    console.log(`🧪 Testing BigCommerce MCP Server compatibility with Agno`);
    console.log(`=====================================\n`);

    const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
    const mcpTools = new MockMCPTools(serverUrl);

    try {
        // Connect to the server
        const tools = await mcpTools.connect();

        if (tools.length === 0) {
            console.log(`⚠️  No tools available. Make sure the server is configured with BigCommerce credentials.`);
            return;
        }

        // Test each available tool with basic parameters
        for (const tool of tools) {
            console.log(`\n📋 Testing tool: ${tool.name}`);
            console.log(`   Description: ${tool.description}`);

            // Tools needing an id (get_product, update_order, ...) have nothing
            // safe to guess against a live store, so they are left alone.
            const required = tool.inputSchema?.required ?? [];
            if (required.length > 0) {
                console.log(`   \u23ed\ufe0f  Skipped: needs ${required.join(', ')}`);
                continue;
            }

            try {
                // Keep live responses small; every listing tool accepts limit.
                const testArgs = { limit: 5 };

                const result = await mcpTools.callTool(tool.name, testArgs);

                // Parse the result content
                if (result?.content?.[0]?.text) {
                    const resultText = result.content[0].text;
                    console.log(`   📊 Result preview: ${resultText.substring(0, 200)}${resultText.length > 200 ? '...' : ''}`);
                }
                console.log(`   📦 structuredContent: ${result?.structuredContent ? 'present' : 'absent'}`);

                if (result?.isError) {
                    console.log(`   ❌ Tool returned an error`);
                    continue;
                }
                console.log(`   ✅ Tool test passed`);
            } catch (error) {
                console.log(`   ❌ Tool test failed: ${error.message}`);

                // Continue testing other tools even if one fails
                continue;
            }
        }

        console.log(`\n🎉 Agno compatibility test completed!`);
        console.log(`📊 Results: ${tools.length} tools tested`);

    } catch (error) {
        console.error(`❌ Compatibility test failed:`, error.message);
        process.exit(1);
    } finally {
        await mcpTools.close();
    }
}

// Example of how to use the MCP server with Agno
async function demonstrateAgnoUsage() {
    console.log(`\n📚 Example: How to use with Agno`);
    console.log(`=================================`);

    const exampleCode = `
// Example Agno integration:
import { MCPTools } from '@agno/mcp';

const bigcommerceMCP = new MCPTools('http://localhost:3000/mcp');

async function getBigCommerceData() {
    await bigcommerceMCP.connect();
    
    // Get recent orders
    const orders = await bigcommerceMCP.callTool('get_all_orders', {
        limit: 10,
        sort: 'date_created:desc'
    });
    
    // Get product catalog
    const products = await bigcommerceMCP.callTool('get_all_products', {
        limit: 20,
        is_visible: true
    });
    
    // Get customer list
    const customers = await bigcommerceMCP.callTool('get_all_customers', {
        limit: 10
    });
    
    await bigcommerceMCP.close();
    
    return { orders, products, customers };
}
`;

    console.log(exampleCode);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    testAgnoCompatibility()
        .then(() => demonstrateAgnoUsage())
        .catch(console.error);
}

export { MockMCPTools, testAgnoCompatibility };
