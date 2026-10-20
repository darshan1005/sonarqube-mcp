const test = require('node:test');
const assert = require('node:assert/strict');
const { parseServerUrl, healthUrl, redactUrl, createServerDefinition } = require('../extension.js');

test('parseServerUrl accepts valid http and https URLs and trims input', () => {
  const url1 = parseServerUrl('https://sonar-mcp.example.com/mcp');
  assert.equal(url1.origin, 'https://sonar-mcp.example.com');
  assert.equal(url1.pathname, '/mcp');

  const url2 = parseServerUrl('  http://localhost:3000/mcp  ');
  assert.equal(url2.origin, 'http://localhost:3000');
  assert.equal(url2.pathname, '/mcp');
});

test('parseServerUrl rejects invalid URLs, non-http protocols, and empty inputs', () => {
  assert.throws(() => parseServerUrl('not-a-url'), /Enter a valid MCP URL/);
  assert.throws(() => parseServerUrl('ftp://example.com/mcp'), /The MCP URL must use http:\/\/ or https:\/\//);
  assert.throws(() => parseServerUrl(''), /Enter a valid MCP URL/);
  assert.throws(() => parseServerUrl(null), /Enter a valid MCP URL/);
  assert.throws(() => parseServerUrl('   '), /Enter a valid MCP URL/);
});

test('healthUrl resolves /healthz against the origin', () => {
  assert.equal(healthUrl('https://sonar-mcp.example.com/mcp'), 'https://sonar-mcp.example.com/healthz');
  assert.equal(healthUrl('http://127.0.0.1:3000/some/nested/path'), 'http://127.0.0.1:3000/healthz');
});

test('redactUrl removes credentials and query parameters safely', () => {
  assert.equal(
    redactUrl('https://user:password@sonar-mcp.example.com/mcp?secret=123'),
    'https://sonar-mcp.example.com/mcp'
  );
  assert.equal(redactUrl('http://localhost:3000/'), 'http://localhost:3000');
  assert.equal(redactUrl('invalid'), 'invalid URL');
});

test('createServerDefinition returns expected definition format', () => {
  const def = createServerDefinition('https://sonar.example.com/mcp', 'test-token');
  assert.equal(def.label, 'SonarQube MCP');
  assert.deepEqual(def.headers, { Authorization: 'Bearer test-token' });
  assert.equal(def.version, '0.1.0');
});
