let vscode;
try {
  vscode = require('vscode');
} catch {
  // Allows testing helper functions in standalone Node.js environments
  vscode = null;
}

const URL_KEY = 'sonarqubeMcp.serverUrl';
const TOKEN_KEY = 'sonarqubeMcp.token';
const DEFAULT_URL = 'https://your-domain.example.com/mcp';
const PROVIDER_ID = 'sonarqube-mcp.provider';
const SERVER_LABEL = 'SonarQube MCP';
const SERVER_VERSION = '0.1.0';

function parseServerUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error('Enter a valid MCP URL, for example https://your-domain.example.com/mcp.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('The MCP URL must use http:// or https://.');
  }
  if (!parsed.hostname) {
    throw new Error('The MCP URL must include a host.');
  }
  return parsed;
}

function healthUrl(serverUrl) {
  const parsed = parseServerUrl(serverUrl);
  return new URL('/healthz', parsed.origin).toString();
}

function redactUrl(serverUrl) {
  try {
    const parsed = parseServerUrl(serverUrl);
    return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname);
  } catch {
    return 'invalid URL';
  }
}

function createServerDefinition(serverUrl, token) {
  const uri = (vscode?.Uri && typeof vscode.Uri.parse === 'function')
    ? vscode.Uri.parse(serverUrl)
    : serverUrl;
  const headers = { Authorization: `Bearer ${token}` };

  if (vscode?.McpHttpServerDefinition) {
    try {
      // Standard VS Code API: constructor(label, uri, headers, version)
      return new vscode.McpHttpServerDefinition(SERVER_LABEL, uri, headers, SERVER_VERSION);
    } catch {
      // Fallback in case of options object signature
      return new vscode.McpHttpServerDefinition({
        label: SERVER_LABEL,
        uri,
        headers,
        version: SERVER_VERSION
      });
    }
  }

  return {
    label: SERVER_LABEL,
    uri,
    headers,
    version: SERVER_VERSION
  };
}

function createProvider(context, emitter) {
  return {
    onDidChangeMcpServerDefinitions: emitter.event,
    provideMcpServerDefinitions: async () => {
      const serverUrl = context.globalState.get(URL_KEY);
      const token = await context.secrets.get(TOKEN_KEY);
      if (!serverUrl || !token) return [];
      return [createServerDefinition(serverUrl, token)];
    },
    resolveMcpServerDefinition: async (server) => server
  };
}

async function configure(context, emitter) {
  const currentUrl = context.globalState.get(URL_KEY, DEFAULT_URL);
  const serverUrl = await vscode.window.showInputBox({
    title: 'SonarQube MCP server URL',
    prompt: 'Enter the remote MCP endpoint',
    value: currentUrl,
    ignoreFocusOut: true,
    validateInput: (value) => {
      try {
        parseServerUrl(value);
        return undefined;
      } catch (error) {
        return error.message;
      }
    }
  });
  if (serverUrl === undefined) return;

  const token = await vscode.window.showInputBox({
    title: 'SonarQube MCP token',
    prompt: 'Enter your user-specific bearer token',
    password: true,
    ignoreFocusOut: true,
    validateInput: (value) => (value && value.trim()) ? undefined : 'A token is required.'
  });
  if (token === undefined) return;

  await context.globalState.update(URL_KEY, serverUrl.trim());
  await context.secrets.store(TOKEN_KEY, token.trim());
  emitter.fire();
  vscode.window.showInformationMessage('SonarQube MCP credentials saved securely.');
}

async function testConnection(context) {
  const serverUrl = context.globalState.get(URL_KEY);
  const token = await context.secrets.get(TOKEN_KEY);
  if (!serverUrl || !token) {
    const action = await vscode.window.showWarningMessage(
      'Configure the SonarQube MCP server URL and token first.',
      'Configure'
    );
    if (action === 'Configure') {
      vscode.commands.executeCommand('sonarqubeMcp.configure');
    }
    return;
  }
  try {
    const response = await fetch(healthUrl(serverUrl), {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    vscode.window.showInformationMessage(`SonarQube MCP connection succeeded (${redactUrl(serverUrl)}).`);
  } catch (error) {
    vscode.window.showErrorMessage(`SonarQube MCP connection failed: ${error.message}`);
  }
}

async function clearCredentials(context, emitter) {
  const confirmed = await vscode.window.showWarningMessage(
    'Are you sure you want to clear saved SonarQube MCP credentials?',
    { modal: true },
    'Clear Credentials'
  );
  if (confirmed !== 'Clear Credentials') return;

  await context.globalState.update(URL_KEY, undefined);
  await context.secrets.delete(TOKEN_KEY);
  emitter.fire();
  vscode.window.showInformationMessage('SonarQube MCP credentials cleared.');
}

async function showStatus(context) {
  const serverUrl = context.globalState.get(URL_KEY);
  const hasToken = Boolean(await context.secrets.get(TOKEN_KEY));
  if (!serverUrl || !hasToken) {
    const action = await vscode.window.showInformationMessage(
      'SonarQube MCP is not configured.',
      'Configure'
    );
    if (action === 'Configure') {
      vscode.commands.executeCommand('sonarqubeMcp.configure');
    }
    return;
  }
  const action = await vscode.window.showInformationMessage(
    `SonarQube MCP is configured for ${redactUrl(serverUrl)}.`,
    'Test Connection',
    'Reconfigure'
  );
  if (action === 'Test Connection') {
    vscode.commands.executeCommand('sonarqubeMcp.testConnection');
  } else if (action === 'Reconfigure') {
    vscode.commands.executeCommand('sonarqubeMcp.configure');
  }
}

function activate(context) {
  const emitter = new vscode.EventEmitter();
  context.subscriptions.push(emitter);
  context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, createProvider(context, emitter)));
  context.subscriptions.push(vscode.commands.registerCommand('sonarqubeMcp.configure', () => configure(context, emitter)));
  context.subscriptions.push(vscode.commands.registerCommand('sonarqubeMcp.testConnection', () => testConnection(context)));
  context.subscriptions.push(vscode.commands.registerCommand('sonarqubeMcp.clearCredentials', () => clearCredentials(context, emitter)));
  context.subscriptions.push(vscode.commands.registerCommand('sonarqubeMcp.showStatus', () => showStatus(context)));
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  healthUrl,
  parseServerUrl,
  redactUrl,
  createServerDefinition
};
