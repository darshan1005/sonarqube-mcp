import { toolDefinitions, callTool } from './tools.js';
export async function handleRpc(message, context) {
  const id = Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : undefined;
  const reply = result => ({ jsonrpc: '2.0', id, result });
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
  try {
    if (message.method === 'initialize') return reply({ protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'sonarqube-mcp', version: '1.0.0' } });
    if (message.method === 'notifications/initialized') return null;
    if (message.method === 'tools/list') return reply({ tools: toolDefinitions });
    if (message.method === 'tools/call') {
      if (!message.params || typeof message.params.name !== 'string' || (message.params.arguments !== undefined && (typeof message.params.arguments !== 'object' || message.params.arguments === null))) throw Object.assign(new Error('Invalid tool arguments'), { code: -32602 });
      const result = await callTool(message.params.name, message.params.arguments || {}, context.client, context.maxPageSize);
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result });
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
  } catch (error) { return { jsonrpc: '2.0', id, error: { code: error.code || -32000, message: error.message || 'Request failed' } }; }
}
