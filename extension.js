const path = require('node:path');

let vscode;
try {
  vscode = require('vscode');
} catch {
  // Allows testing helper functions in standalone Node.js environments
  vscode = null;
}

const URL_KEY = 'sonarqubeMcp.sonarUrl';
const TOKEN_KEY = 'sonarqubeMcp.sonarToken';
const PROJECT_KEY = 'sonarqubeMcp.defaultProjectKey';
const DEFAULT_URL = 'http://localhost:9000';
const PROVIDER_ID = 'sonarqube-mcp.provider';
const SERVER_LABEL = 'SonarQube REST API MCP';

function parseSonarUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw new Error('Enter a valid SonarQube URL, for example https://sonarcloud.io or http://localhost:9000.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('The SonarQube URL must use http:// or https://.');
  }
  if (!parsed.hostname) {
    throw new Error('The SonarQube URL must include a host.');
  }
  return parsed;
}

function systemStatusUrl(sonarUrl) {
  const parsed = parseSonarUrl(sonarUrl);
  return new URL('/api/system/status', parsed.origin).toString();
}

function validateAuthUrl(sonarUrl) {
  const parsed = parseSonarUrl(sonarUrl);
  return new URL('/api/authentication/validate', parsed.origin).toString();
}

function redactUrl(sonarUrl) {
  try {
    const parsed = parseSonarUrl(sonarUrl);
    return parsed.origin;
  } catch {
    return 'invalid URL';
  }
}

function createServerDefinition(context, sonarUrl, token, defaultProject) {
  const scriptPath = path.join(context?.extensionPath || __dirname, 'server.js');
  const env = {
    SONARQUBE_URL: sonarUrl
  };
  if (token) {
    env.SONARQUBE_TOKEN = token;
  }
  if (defaultProject) {
    env.SONARQUBE_PROJECT_KEY = defaultProject;
  }

  if (vscode?.McpStdioServerDefinition) {
    return new vscode.McpStdioServerDefinition(
      SERVER_LABEL,
      'node',
      [scriptPath],
      env
    );
  }

  return {
    label: SERVER_LABEL,
    command: 'node',
    args: [scriptPath],
    env
  };
}

function createProvider(context, emitter) {
  return {
    onDidChangeMcpServerDefinitions: emitter.event,
    provideMcpServerDefinitions: async () => {
      const sonarUrl = context.globalState.get(URL_KEY);
      if (!sonarUrl) return [];
      const token = (await context.secrets.get(TOKEN_KEY)) || '';
      const defaultProject = context.globalState.get(PROJECT_KEY) || '';
      return [createServerDefinition(context, sonarUrl, token, defaultProject)];
    },
    resolveMcpServerDefinition: async (server) => server
  };
}

async function configure(context, emitter) {
  const currentUrl = context.globalState.get(URL_KEY, DEFAULT_URL);
  const sonarUrl = await vscode.window.showInputBox({
    title: 'SonarQube Server URL',
    prompt: 'Enter your SonarQube URL (e.g. https://sonarcloud.io or http://localhost:9000)',
    value: currentUrl,
    ignoreFocusOut: true,
    validateInput: (value) => {
      try {
        parseSonarUrl(value);
        return undefined;
      } catch (error) {
        return error.message;
      }
    }
  });
  if (sonarUrl === undefined) return;

  const currentToken = (await context.secrets.get(TOKEN_KEY)) || '';
  const token = await vscode.window.showInputBox({
    title: 'SonarQube Access Token (Optional)',
    prompt: 'Enter your user access token (leave empty for public/anonymous instances)',
    value: currentToken,
    password: true,
    ignoreFocusOut: true
  });
  if (token === undefined) return;

  const currentProject = context.globalState.get(PROJECT_KEY, '');
  const defaultProject = await vscode.window.showInputBox({
    title: 'Default Project Key (Optional)',
    prompt: 'Enter a default SonarQube project key to use when none is specified in tool calls',
    value: currentProject,
    ignoreFocusOut: true
  });
  if (defaultProject === undefined) return;

  await context.globalState.update(URL_KEY, sonarUrl.trim());

  if (token.trim()) {
    await context.secrets.store(TOKEN_KEY, token.trim());
  } else {
    await context.secrets.delete(TOKEN_KEY);
  }

  if (defaultProject.trim()) {
    await context.globalState.update(PROJECT_KEY, defaultProject.trim());
  } else {
    await context.globalState.update(PROJECT_KEY, undefined);
  }

  emitter.fire();
  vscode.window.showInformationMessage('SonarQube REST API MCP configuration saved.');
}

async function testConnection(context) {
  const sonarUrl = context.globalState.get(URL_KEY);
  if (!sonarUrl) {
    const action = await vscode.window.showWarningMessage(
      'Configure the SonarQube server URL first.',
      'Configure'
    );
    if (action === 'Configure') {
      vscode.commands.executeCommand('sonarqubeMcp.configure');
    }
    return;
  }

  const token = (await context.secrets.get(TOKEN_KEY)) || '';
  const testUrl = token ? validateAuthUrl(sonarUrl) : systemStatusUrl(sonarUrl);
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = 'Basic ' + Buffer.from(token + ':').toString('base64');
  }

  try {
    const response = await fetch(testUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    if (token && data.valid === false) {
      vscode.window.showErrorMessage(`SonarQube token is invalid for ${redactUrl(sonarUrl)}.`);
      return;
    }

    const authType = token ? 'authenticated via Basic token' : 'anonymous/public';
    vscode.window.showInformationMessage(`SonarQube connection succeeded (${redactUrl(sonarUrl)}, ${authType}).`);
  } catch (error) {
    vscode.window.showErrorMessage(`SonarQube connection failed: ${error.message}`);
  }
}

async function clearCredentials(context, emitter) {
  const confirmed = await vscode.window.showWarningMessage(
    'Are you sure you want to clear saved SonarQube MCP configuration?',
    { modal: true },
    'Clear Configuration'
  );
  if (confirmed !== 'Clear Configuration') return;

  await context.globalState.update(URL_KEY, undefined);
  await context.globalState.update(PROJECT_KEY, undefined);
  await context.secrets.delete(TOKEN_KEY);
  emitter.fire();
  vscode.window.showInformationMessage('SonarQube MCP configuration cleared.');
}

async function showStatus(context) {
  const sonarUrl = context.globalState.get(URL_KEY);
  if (!sonarUrl) {
    const action = await vscode.window.showInformationMessage(
      'SonarQube MCP is not configured.',
      'Configure'
    );
    if (action === 'Configure') {
      vscode.commands.executeCommand('sonarqubeMcp.configure');
    }
    return;
  }

  const hasToken = Boolean(await context.secrets.get(TOKEN_KEY));
  const defaultProject = context.globalState.get(PROJECT_KEY);
  const authMode = hasToken ? 'Access token configured' : 'Anonymous / No token';
  const projectMsg = defaultProject ? `, default project: ${defaultProject}` : '';

  const action = await vscode.window.showInformationMessage(
    `SonarQube MCP: ${redactUrl(sonarUrl)} (${authMode}${projectMsg}).`,
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
  parseSonarUrl,
  systemStatusUrl,
  validateAuthUrl,
  redactUrl,
  createServerDefinition
};
