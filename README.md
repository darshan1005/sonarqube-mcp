# SonarQube REST API MCP for VS Code

Connect VS Code's Model Context Protocol (MCP) directly to SonarQube's REST API over standard input/output (`stdio`).

The extension includes a built-in, dependency-free Node.js MCP server that communicates directly with your SonarQube instance (e.g. `https://sonarcloud.io` or `http://localhost:9000`). It registers the server with VS Code via `vscode.lm.registerMcpServerDefinitionProvider` using `McpStdioServerDefinition`.

## Features

- **Direct REST API Access**: Connects directly to SonarQube REST APIs (`/api/projects`, `/api/measures`, `/api/issues`, `/api/qualitygates`, `/api/components`).
- **Zero External Dependencies**: Uses native Node.js built-ins.
- **Optional Access Token**: Works with public / anonymous SonarQube instances without a token, or with a personal access token for private projects.
- **Secure Credential Storage**: When an access token is provided, it is stored encrypted in VS Code `SecretStorage`, never in plaintext workspace files.
- **Interactive Configuration**: Built-in commands to configure, test connection, view status, and clear credentials.

## Requirements

- VS Code 1.102 or newer.
- Node.js 20 or newer (used to execute the bundled stdio server).
- A reachable SonarQube server URL (e.g. `https://sonarcloud.io`, `https://sonarqube.example.com`, or `http://localhost:9000`).
- *(Optional)* A SonarQube user access token for private instances.

## Install and use

### From source

Clone this repository and open it in VS Code:

```bash
git clone https://github.com/darshan1005/sonarqube-mcp.git
cd sonarqube-mcp
```

Press `F5` to launch an Extension Development Host.

### From a VSIX package

Build the package:

```bash
npm run package
```

Then in VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), select **Extensions: Install from VSIX...**, and choose the generated `sonarqube-rest-api-mcp-0.1.1.vsix` file.

### Configure your connection

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```text
SonarQube MCP: Configure
```

Enter:

1. **SonarQube Server URL**: The domain of your SonarQube server (e.g. `https://sonarcloud.io`, `https://sonarqube.example.com`, or `http://localhost:9000`).
2. **SonarQube Access Token** *(Optional)*: Your personal access token from SonarQube (**User > My Account > Security > Generate Tokens**). Leave blank if your SonarQube server allows anonymous access.

### Available Commands

- **SonarQube MCP: Configure** — set or update SonarQube URL, optional access token, and optional default project key.
- **SonarQube MCP: Test Connection** — tests connectivity against `/api/system/status` or verifies your token with `/api/authentication/validate`.
- **SonarQube MCP: Show Status** — view current configuration and authentication status.
- **SonarQube MCP: Clear Credentials** — remove saved SonarQube URL, default project key, and stored access token.

## Example `mcp.json` Configuration Template

If you prefer to configure your workspace manually using `.vscode/mcp.json` (or global `mcp.json`), you can run the bundled server directly via `stdio`:

```jsonc
{
  "mcpServers": {
    "sonarqube": {
      "command": "node",
      "args": [
        // Path to server.js in the installed extension or repository
        "path/to/server.js"
      ],
      "env": {
        // Your SonarQube server base URL (e.g., https://sonarcloud.io or http://localhost:9000)
        "SONARQUBE_URL": "https://sonarqube.example.com",
        // Personal access token (OPTIONAL - omit or leave blank for public instances)
        "SONARQUBE_TOKEN": "YOUR_SONARQUBE_ACCESS_TOKEN",
        // Default project key (OPTIONAL - used when no projectKey is specified in tool calls)
        "SONARQUBE_PROJECT_KEY": "YOUR_DEFAULT_PROJECT_KEY"
      }
    }
  }
}
```

> [!TIP]
> **Recommended:** Using the extension's **SonarQube MCP: Configure** command is preferred because VS Code manages the process automatically and saves your access token in encrypted `SecretStorage` instead of plain text in a workspace file.

## Available MCP Tools

Once connected, your AI assistant in VS Code Agent mode can call:

- **`list_branches`**: List branches of a project with their quality gate status.
- **`get_quality_gate_status`**: Get quality gate status and conditions for a project or branch.
- **`list_projects`**: Search or list SonarQube projects visible to the authenticated user.
- **`list_quality_gates`**: List quality gates and condition definitions.
- **`get_measures`**: Fetch 30+ preconfigured metrics and measures (coverage, bugs, vulnerabilities, code smells, technical debt, ratings) for a project/branch.
- **`search_issues`**: Search code issues by component, branch, severity, type, status, assignee, tag, language, or date.
- **`search_hotspots`**: Search security hotspots for a project or branch with review status.
- **`get_measures_history`**: Get historical project measures for trend analysis.
- **`get_issue`**: Get full details for specific issues, including rule and location information.
- **`get_hotspot`**: Get full details for a security hotspot, including rule recommendations.
- **`get_project_activity`**: View project analysis history and scanner event timelines.
- **`list_background_tasks`**: Check project compute engine (CE) analysis task status.
- **`get_system_status`**: Check SonarQube server health and validate authentication.

## Development and checks

Run tests:

```bash
npm test
```

Run syntax checks:

```bash
npm run check
```

Package extension:

```bash
npm run package
```

## Repository

```text
https://github.com/darshan1005/sonarqube-mcp
```

## License

MIT. See [LICENSE](LICENSE).
