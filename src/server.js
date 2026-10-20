import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { StaticCredentialProvider, bearerToken } from './auth.js';
import { SonarClient } from './sonar.js';
import { handleRpc } from './mcp.js';

export function createServer(config = loadConfig()) {
  const credentials = new StaticCredentialProvider(config.users);
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && req.url === '/healthz') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'ok' })); return; }
    if (req.method !== 'POST' || req.url !== '/mcp') { res.writeHead(404); res.end('Not found'); return; }
    const user = credentials.authenticate(bearerToken(req.headers)); if (!user) { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    let size = 0; let tooLarge = false; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size <= config.maxBodyBytes) chunks.push(chunk); else tooLarge = true; });
    req.on('end', async () => {
      if (tooLarge) { res.writeHead(413, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Payload too large' })); return; }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
      const client = new SonarClient({ baseUrl: config.sonarUrl, token: credentials.getSonarToken(user), timeoutMs: config.sonarTimeoutMs });
      const result = await handleRpc(body, { client, maxPageSize: config.maxPageSize });
      if (!result) { res.writeHead(202); res.end(); return; }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(result));
    });
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const config = loadConfig(); createServer(config).listen(config.port, config.host, () => console.log(`sonarqube-mcp listening on ${config.host}:${config.port}`)); }
