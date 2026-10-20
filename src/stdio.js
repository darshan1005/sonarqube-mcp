import readline from 'node:readline';
import { loadConfig } from './config.js';
import { StaticCredentialProvider } from './auth.js';
import { SonarClient } from './sonar.js';
import { handleRpc } from './mcp.js';
const config = loadConfig(); const provider = new StaticCredentialProvider(config.users); const user = provider.users[0];
const client = new SonarClient({ baseUrl: config.sonarUrl, token: provider.getSonarToken(user), timeoutMs: config.sonarTimeoutMs });
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async line => { try { const result = await handleRpc(JSON.parse(line), { client, maxPageSize: config.maxPageSize }); if (result) process.stdout.write(`${JSON.stringify(result)}\n`); } catch { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`); } });
