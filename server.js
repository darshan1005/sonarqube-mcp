#!/usr/bin/env node
// Dependency-free MCP (stdio) server wrapping the SonarQube REST API.
// Supports env: SONARQUBE_URL, SONARQUBE_TOKEN, SONARQUBE_PROJECT_KEY (optional)
const readline = require('node:readline');

const BASE = (process.env.SONARQUBE_URL || '').replace(/\/+$/, '');
const TOKEN = (process.env.SONARQUBE_TOKEN || '').trim();
const DEFAULT_PROJECT = (process.env.SONARQUBE_PROJECT_KEY || '').trim();

const DEFAULT_METRICS = [
  'alert_status',
  'bugs',
  'new_bugs',
  'vulnerabilities',
  'new_vulnerabilities',
  'code_smells',
  'new_code_smells',
  'security_hotspots',
  'new_security_hotspots',
  'coverage',
  'new_coverage',
  'lines_to_cover',
  'new_lines_to_cover',
  'uncovered_lines',
  'new_uncovered_lines',
  'duplicated_lines_density',
  'new_duplicated_lines_density',
  'duplicated_blocks',
  'ncloc',
  'files',
  'comment_lines',
  'tests',
  'test_execution_time',
  'test_errors',
  'test_failures',
  'reliability_rating',
  'security_rating',
  'sqale_rating',
  'sqale_index',
  'debt'
].join(',');

async function api(path, params = {}, fetchImpl = globalThis.fetch, baseUrl = BASE, token = TOKEN) {
  if (!baseUrl) {
    throw new Error('SONARQUBE_URL environment variable is required');
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(baseUrl + cleanPath);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    Accept: 'application/json'
  };
  if (token) {
    headers.Authorization = 'Basic ' + Buffer.from(token + ':').toString('base64');
  }

  const res = await fetchImpl(url.toString(), { headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SonarQube ${res.status} ${res.statusText}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

const project = (a) => a.projectKey || a.component || a.project || DEFAULT_PROJECT;
const projectProp = { type: 'string', description: 'Project key (defaults to SONARQUBE_PROJECT_KEY if configured)' };
const branchProp = { type: 'string', description: 'Branch name, e.g. main or feature branch (defaults to main branch)' };
const pageProp = { type: 'number', description: 'Page number', default: 1 };
const pageSizeProp = { type: 'number', description: 'Page size (1 to 100)', default: 50 };

const tools = [
  {
    name: 'list_branches',
    description: 'List branches of a project with their quality gate status.',
    inputSchema: { type: 'object', properties: { projectKey: projectProp } },
    run: (a, client) => (client ? client.api : api)('/api/project_branches/list', { project: project(a) })
  },
  {
    name: 'get_quality_gate_status',
    description: 'Get quality gate status and conditions for a project/branch.',
    inputSchema: { type: 'object', properties: { projectKey: projectProp, branch: branchProp } },
    run: (a, client) => (client ? client.api : api)('/api/qualitygates/project_status', { projectKey: project(a), branch: a.branch })
  },
  {
    name: 'list_projects',
    description: 'List SonarQube projects visible to the authenticated user.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text for project name or key' },
        qualifiers: { type: 'string', description: 'Comma-separated qualifiers, usually TRK' },
        p: pageProp,
        ps: pageSizeProp
      }
    },
    run: (a, client) => (client ? client.api : api)('/api/projects/search', {
      q: a.query || a.q,
      qualifiers: a.qualifiers,
      p: a.p || a.page || 1,
      ps: a.ps || a.pageSize || 50
    })
  },
  {
    name: 'list_quality_gates',
    description: 'List quality gates and their conditions.',
    inputSchema: { type: 'object', properties: { organization: { type: 'string' }, gateId: { type: 'number' } } },
    run: (a, client) => (client ? client.api : api)('/api/qualitygates/list', { organization: a.organization, gateId: a.gateId })
  },
  {
    name: 'get_measures',
    description: 'Get measures (bugs, coverage, code_smells, etc.) for a project/branch.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: projectProp,
        branch: branchProp,
        metricKeys: { type: 'string', description: 'Comma-separated metric keys', default: DEFAULT_METRICS }
      }
    },
    run: (a, client) =>
      (client ? client.api : api)('/api/measures/component', {
        component: project(a),
        branch: a.branch,
        metricKeys: a.metricKeys || DEFAULT_METRICS
      })
  },
  {
    name: 'search_issues',
    description: 'Search issues with type, severity, status, assignee, tag, rule, and date filters.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: projectProp,
        branch: branchProp,
        pullRequest: { type: 'string' },
        types: { type: 'string', description: 'BUG,VULNERABILITY,CODE_SMELL' },
        severities: { type: 'string', description: 'INFO,MINOR,MAJOR,CRITICAL,BLOCKER' },
        statuses: { type: 'string', description: 'OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED' },
        assignees: { type: 'string', description: 'Comma-separated assignee logins' },
        tags: { type: 'string', description: 'Comma-separated issue tags' },
        languages: { type: 'string', description: 'Comma-separated language keys' },
        directories: { type: 'string', description: 'Comma-separated project directories' },
        rules: { type: 'string', description: 'Comma-separated rule keys' },
        createdAfter: { type: 'string', description: 'ISO date or date-time' },
        createdBefore: { type: 'string', description: 'ISO date or date-time' },
        resolved: { type: 'string', enum: ['true', 'false'], default: 'false' },
        ps: pageSizeProp,
        p: pageProp
      }
    },
    run: (a, client) =>
      (client ? client.api : api)('/api/issues/search', {
        componentKeys: project(a),
        branch: a.branch,
        pullRequest: a.pullRequest,
        types: a.types,
        severities: a.severities,
        statuses: a.statuses,
        assignees: a.assignees,
        tags: a.tags,
        languages: a.languages,
        directories: a.directories,
        rules: a.rules,
        createdAfter: a.createdAfter,
        createdBefore: a.createdBefore,
        resolved: a.resolved !== undefined ? String(a.resolved) : 'false',
        ps: a.ps || a.pageSize || 50,
        p: a.p || a.page || 1
      })
  },
  {
    name: 'search_hotspots',
    description: 'Search security hotspots for a project/branch with pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: projectProp,
        branch: branchProp,
        status: { type: 'string', enum: ['TO_REVIEW', 'REVIEWED'] },
        ps: pageSizeProp,
        p: pageProp
      }
    },
    run: (a, client) =>
      (client ? client.api : api)('/api/hotspots/search', {
        projectKey: project(a),
        branch: a.branch,
        status: a.status,
        ps: a.ps || a.pageSize || 50,
        p: a.p || a.page || 1
      })
  },
  {
    name: 'get_measures_history',
    description: 'Get historical project measures for trend reporting.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: projectProp,
        branch: branchProp,
        metricKeys: { type: 'string', description: 'Comma-separated metric keys', default: DEFAULT_METRICS },
        from: { type: 'string', description: 'Start date (ISO date or date-time)' },
        to: { type: 'string', description: 'End date (ISO date or date-time)' },
        ps: pageSizeProp,
        p: pageProp
      }
    },
    run: (a, client) =>
      (client ? client.api : api)('/api/measures/search_history', {
        component: project(a),
        branch: a.branch,
        metrics: a.metricKeys || DEFAULT_METRICS,
        from: a.from,
        to: a.to,
        ps: a.ps || a.pageSize || 50,
        p: a.p || a.page || 1
      })
  },
  {
    name: 'get_issue',
    description: 'Get full details for one or more issues, including rule and location data.',
    inputSchema: {
      type: 'object',
      properties: {
        issueKeys: { type: 'string', description: 'Comma-separated issue keys' }
      },
      required: ['issueKeys']
    },
    run: (a, client) => (client ? client.api : api)('/api/issues/search', { issues: a.issueKeys })
  },
  {
    name: 'get_hotspot',
    description: 'Get details for a security hotspot, including its rule and location.',
    inputSchema: {
      type: 'object',
      properties: { hotspotKey: { type: 'string' } },
      required: ['hotspotKey']
    },
    run: (a, client) => (client ? client.api : api)('/api/hotspots/show', { hotspot: a.hotspotKey })
  },
  {
    name: 'get_project_activity',
    description: 'Get project analysis history and scanner activity.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: projectProp,
        branch: branchProp,
        category: { type: 'string', description: 'ANALYSIS,EVENT,VERSION,OTHER' },
        from: { type: 'string', description: 'Start date (ISO date or date-time)' },
        to: { type: 'string', description: 'End date (ISO date or date-time)' },
        ps: pageSizeProp,
        p: pageProp
      }
    },
    run: (a, client) =>
      (client ? client.api : api)('/api/project_analyses/search', {
        project: project(a),
        branch: a.branch,
        category: a.category,
        from: a.from,
        to: a.to,
        ps: a.ps || a.pageSize || 50,
        p: a.p || a.page || 1
      })
  },
  {
    name: 'list_background_tasks',
    description: 'List project analysis tasks and their status.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: projectProp,
        status: { type: 'string', description: 'PENDING,IN_PROGRESS,SUCCESS,FAILED,CANCELED' },
        ps: pageSizeProp,
        p: pageProp
      }
    },
    run: (a, client) =>
      (client ? client.api : api)('/api/ce/component', {
        component: project(a),
        status: a.status,
        ps: a.ps || a.pageSize || 50,
        p: a.p || a.page || 1
      })
  },
  {
    name: 'get_system_status',
    description: 'Check SonarQube server status and token validity.',
    inputSchema: { type: 'object', properties: {} },
    run: async (a, client) => {
      const requester = client ? client.api : api;
      const status = await requester('/api/system/status').catch(e => ({ error: e.message }));
      const auth = await requester('/api/authentication/validate').catch(e => ({ error: e.message }));
      return { status, auth };
    }
  }
];

// Aliases mapping for backward compatibility with sonar_* naming
const toolAliases = {
  sonar_search_projects: 'list_projects',
  sonar_get_project: 'list_projects',
  sonar_get_measures: 'get_measures',
  sonar_search_issues: 'search_issues',
  sonar_quality_gate: 'get_quality_gate_status',
  sonar_component_tree: 'list_projects'
};

async function handleRpc(msg, context = {}) {
  const { id, method, params } = msg || {};
  const isRequest = id !== undefined && id !== null;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: (params && params.protocolVersion) || '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'sonarqube-rest', version: '1.0.0' }
          }
        };

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'notifications/initialized':
        return null;

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
          }
        };

      case 'tools/call': {
        const requestedName = params?.name;
        const targetName = toolAliases[requestedName] || requestedName;
        const tool = tools.find((t) => t.name === targetName);

        if (!tool) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Unknown tool: ${requestedName}` }
          };
        }

        try {
          const data = await tool.run(params?.arguments || {}, context);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
            }
          };
        } catch (e) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [{ type: 'text', text: String(e.message || e) }]
            }
          };
        }
      }

      default:
        if (isRequest) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
          };
        }
        return null;
    }
  } catch (e) {
    if (isRequest) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: String(e.message || e) }
      };
    }
    return null;
  }
}

function startStdioServer(env = process.env) {
  const baseUrl = (env.SONARQUBE_URL || '').replace(/\/+$/, '');
  const token = (env.SONARQUBE_TOKEN || '').trim();

  if (!baseUrl) {
    process.stderr.write('Error: SONARQUBE_URL environment variable is required\n');
    process.exit(1);
  }

  const context = {
    api: (path, params) => api(path, params, globalThis.fetch, baseUrl, token)
  };

  const send = (msg) => {
    if (msg) process.stdout.write(JSON.stringify(msg) + '\n');
  };

  readline.createInterface({ input: process.stdin }).on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const response = await handleRpc(JSON.parse(trimmed), context);
      send(response);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
  });
}

if (require.main === module) {
  startStdioServer();
}

module.exports = {
  api,
  tools,
  handleRpc,
  DEFAULT_METRICS,
  startStdioServer
};
