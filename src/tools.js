const positiveInt = (value, fallback, max) => { const n = value === undefined ? fallback : Number(value); if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`page size must be an integer from 1 to ${max}`); return n; };
export const toolDefinitions = [
  { name: 'sonar_search_projects', description: 'Search SonarQube projects.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, page: { type: 'integer', minimum: 1 }, pageSize: { type: 'integer', minimum: 1 } } } },
  { name: 'sonar_get_project', description: 'Get a SonarQube project by key.', inputSchema: { type: 'object', required: ['projectKey'], properties: { projectKey: { type: 'string', minLength: 1, maxLength: 200 } } } },
  { name: 'sonar_get_measures', description: 'Get project measures for metric keys.', inputSchema: { type: 'object', required: ['component'], properties: { component: { type: 'string', minLength: 1 }, metricKeys: { type: 'string', minLength: 1 } } } },
  { name: 'sonar_search_issues', description: 'Search SonarQube issues.', inputSchema: { type: 'object', properties: { componentKeys: { type: 'string' }, types: { type: 'string' }, severities: { type: 'string' }, resolved: { type: 'boolean' }, page: { type: 'integer' }, pageSize: { type: 'integer' } } } },
  { name: 'sonar_quality_gate', description: 'Get a project quality gate status.', inputSchema: { type: 'object', required: ['projectKey'], properties: { projectKey: { type: 'string', minLength: 1 } } } },
  { name: 'sonar_component_tree', description: 'List components in a project.', inputSchema: { type: 'object', required: ['component'], properties: { component: { type: 'string', minLength: 1 }, qualifiers: { type: 'string' }, page: { type: 'integer' }, pageSize: { type: 'integer' } } } }
];

export async function callTool(name, args = {}, client, maxPageSize) {
  if (!toolDefinitions.some(t => t.name === name)) throw new Error('Unknown tool');
  const page = positiveInt(args.page, 1, 1000000); const pageSize = positiveInt(args.pageSize, 50, maxPageSize);
  switch (name) {
    case 'sonar_search_projects': return client.request('projects/search', { q: args.query, p: page, ps: pageSize });
    case 'sonar_get_project': return client.request('projects/search', { projects: args.projectKey, p: 1, ps: 1 });
    case 'sonar_get_measures': return client.request('measures/component', { component: args.component, metricKeys: args.metricKeys });
    case 'sonar_search_issues': return client.request('issues/search', { componentKeys: args.componentKeys, types: args.types, severities: args.severities, resolved: args.resolved, p: page, ps: pageSize });
    case 'sonar_quality_gate': return client.request('qualitygates/project_status', { projectKey: args.projectKey });
    case 'sonar_component_tree': return client.request('components/tree', { component: args.component, qualifiers: args.qualifiers, p: page, ps: pageSize });
  }
}
