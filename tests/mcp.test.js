import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc } from '../src/mcp.js';
import { StaticCredentialProvider } from '../src/auth.js';
import crypto from 'node:crypto';

test('lists tools and handles initialization', async () => { const init = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }, {}); assert.equal(init.result.serverInfo.name, 'sonarqube-mcp'); const list = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, {}); assert.ok(list.result.tools.length >= 5); });
test('rejects unknown methods and limits pages', async () => { const bad = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'nope' }, {}); assert.equal(bad.error.code, -32601); const called = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'sonar_search_projects', arguments: { pageSize: 101 } } }, { maxPageSize: 100, client: { request: async () => ({}) } }); assert.equal(called.error.code, -32000); });
test('authenticates hashed tokens without exposing them', () => { const token = 'secret-token'; const provider = new StaticCredentialProvider([{ id: 'u', tokenHash: crypto.createHash('sha256').update(token).digest('hex'), sonarToken: 'sonar' }]); assert.equal(provider.authenticate(token).id, 'u'); assert.equal(provider.authenticate('wrong'), null); });
