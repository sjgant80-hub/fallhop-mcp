#!/usr/bin/env node
// fallhop-mcp · MCP stdio server wrapping fallhop-sdk · MIT · AI-Native Solutions
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'fallhop-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });

const TOOLS = [
  {
    name: 'fallhop_pill',
    description: 'pill · from fallhop-sdk',
    inputSchema: { type: 'object', properties: {} },
    handler: async (args) => {
      const { pill } = await import('@ai-native-solutions/fallhop-sdk');
      return typeof pill === 'function' ? await pill(args) : { error: 'pill not callable' };
    }
  },
  {
    name: 'fallhop_paint_status',
    description: 'paintStatus · from fallhop-sdk',
    inputSchema: { type: 'object', properties: {} },
    handler: async (args) => {
      const { paintStatus } = await import('@ai-native-solutions/fallhop-sdk');
      return typeof paintStatus === 'function' ? await paintStatus(args) : { error: 'paintStatus not callable' };
    }
  },
  {
    name: 'fallhop_render_hex',
    description: 'renderHex · from fallhop-sdk',
    inputSchema: { type: 'object', properties: {} },
    handler: async (args) => {
      const { renderHex } = await import('@ai-native-solutions/fallhop-sdk');
      return typeof renderHex === 'function' ? await renderHex(args) : { error: 'renderHex not callable' };
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ handler, ...rest }) => rest)
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const t = TOOLS.find(x => x.name === req.params.name);
  if (!t) throw new Error('unknown tool: ' + req.params.name);
  const result = await t.handler(req.params.arguments || {});
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

await server.connect(new StdioServerTransport());
console.error('fallhop-mcp v1.0.0 · stdio ready');
