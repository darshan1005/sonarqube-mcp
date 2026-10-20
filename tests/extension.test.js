const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSonarUrl,
  systemStatusUrl,
  validateAuthUrl,
  redactUrl,
  createServerDefinition
} = require('../extension.js');
const {
  api,
  tools,
  handleRpc,
  DEFAULT_METRICS
} = require('../server.js');

test('parseSonarUrl accepts valid http and https URLs and trims input', () => {
  const url1 = parseSonarUrl('https://sonarcloud.io');
  assert.equal(url1.origin, 'https://sonarcloud.io');

  const url2 = parseSonarUrl('  http://localhost:9000  ');
  assert.equal(url2.origin, 'http://localhost:9000');
});

test('parseSonarUrl rejects invalid URLs, non-http protocols, and empty inputs', () => {
  assert.throws(() => parseSonarUrl('not-a-url'), /Enter a valid SonarQube URL/);
  assert.throws(() => parseSonarUrl('ftp://example.com'), /The SonarQube URL must use http:\/\/ or https:\/\//);
  assert.throws(() => parseSonarUrl(''), /Enter a valid SonarQube URL/);
  assert.throws(() => parseSonarUrl(null), /Enter a valid SonarQube URL/);
});

test('systemStatusUrl and validateAuthUrl format REST endpoints properly', () => {
  assert.equal(systemStatusUrl('http://localhost:9000/'), 'http://localhost:9000/api/system/status');
  assert.equal(validateAuthUrl('https://sonarcloud.io'), 'https://sonarcloud.io/api/authentication/validate');
});

test('redactUrl strips path and credentials', () => {
  assert.equal(redactUrl('https://user:pass@sonar.example.com/custom/path'), 'https://sonar.example.com');
  assert.equal(redactUrl('invalid'), 'invalid URL');
});

test('createServerDefinition produces stdio definition with optional token and default project', () => {
  const context = { extensionPath: '/mock/ext' };

  // Without token
  const def1 = createServerDefinition(context, 'http://localhost:9000', '', '');
  assert.equal(def1.label, 'SonarQube REST API MCP');
  assert.equal(def1.command, 'node');
  assert.equal(def1.env.SONARQUBE_URL, 'http://localhost:9000');
  assert.equal(def1.env.SONARQUBE_TOKEN, undefined);

  // With token and project key
  const def2 = createServerDefinition(context, 'https://sonarcloud.io', 'my-token', 'my-project');
  assert.equal(def2.env.SONARQUBE_TOKEN, 'my-token');
  assert.equal(def2.env.SONARQUBE_PROJECT_KEY, 'my-project');
});

test('server.js exports 13 tools and DEFAULT_METRICS', () => {
  assert.equal(tools.length, 13);
  const toolNames = tools.map(t => t.name);
  assert.ok(toolNames.includes('list_branches'));
  assert.ok(toolNames.includes('get_quality_gate_status'));
  assert.ok(toolNames.includes('list_projects'));
  assert.ok(toolNames.includes('get_measures'));
  assert.ok(toolNames.includes('search_issues'));
  assert.ok(toolNames.includes('search_hotspots'));
  assert.ok(toolNames.includes('get_measures_history'));
  assert.ok(toolNames.includes('get_system_status'));
  assert.ok(DEFAULT_METRICS.includes('coverage'));
  assert.ok(DEFAULT_METRICS.includes('code_smells'));
});

test('server.js handleRpc handles initialize, ping, tools/list, and alias tools', async () => {
  const init = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.equal(init.result.serverInfo.name, 'sonarqube-rest');

  const ping = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'ping' });
  assert.deepEqual(ping.result, {});

  const list = await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.equal(list.result.tools.length, 13);

  // Mock context
  let requestedPath = '';
  const mockContext = {
    api: async (p) => {
      requestedPath = p;
      return { success: true };
    }
  };

  // Calling alias sonar_get_measures
  const callRes = await handleRpc({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'sonar_get_measures', arguments: { projectKey: 'my-proj' } }
  }, mockContext);
  assert.ok(callRes.result.content[0].text.includes('success'));
  assert.equal(requestedPath, '/api/measures/component');
});

test('api function sends HTTP Basic authorization when token provided', async () => {
  let capturedHeaders;
  let capturedUrl;
  const mockFetch = async (url, options) => {
    capturedUrl = url;
    capturedHeaders = options.headers;
    return {
      ok: true,
      text: async () => JSON.stringify({ status: 'ok' })
    };
  };

  // With token
  await api('/api/system/status', {}, mockFetch, 'https://sonarcloud.io', 'my-secret-token');
  const expectedAuth = 'Basic ' + Buffer.from('my-secret-token:').toString('base64');
  assert.equal(capturedHeaders.Authorization, expectedAuth);
  assert.ok(capturedUrl.includes('/api/system/status'));

  // Without token
  await api('/api/system/status', {}, mockFetch, 'https://sonarcloud.io', '');
  assert.equal(capturedHeaders.Authorization, undefined);
});
