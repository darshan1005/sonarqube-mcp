# SonarQube MCP for VS Code

Connect VS Code's MCP support to a deployed SonarQube MCP HTTP server. The
extension registers the server programmatically through
`vscode.lm.registerMcpServerDefinitionProvider` and sends the configured token
as an `Authorization: Bearer <token>` header.

## Requirements

- VS Code 1.102 or newer.
- A reachable HTTPS deployment of the SonarQube MCP HTTP server.
- A user-specific MCP token provisioned by the server administrator.

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
npx --yes @vscode/vsce package
```

Then use **Extensions: Install from VSIX...** in VS Code and select the
generated `sonarqube-mcp-0.1.0.vsix` file.

### Configure a user connection

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```text
SonarQube MCP: Configure
```

Enter:

1. The user's MCP server URL, for example `https://sonar-mcp.example.com/mcp`.
2. The user's own MCP bearer token.

Each VS Code user configures their own URL and token. The URL is stored in VS
Code global state, and the bearer token is stored in VS Code `SecretStorage`.
The token is not written to the workspace or `mcp.json`.

Available commands:

- **SonarQube MCP: Configure** — save or replace the endpoint and token.
- **SonarQube MCP: Test Connection** — call the endpoint origin's `/healthz`.
- **SonarQube MCP: Clear Credentials** — remove the endpoint and token.
- **SonarQube MCP: Show Status** — show whether credentials are configured.

After configuration, use VS Code Agent mode and select the SonarQube MCP tools.

## Server configuration expected by the extension

The remote service must expose:

```text
GET  /healthz
POST /mcp
```

The MCP endpoint must accept:

```http
Authorization: Bearer USER_SPECIFIC_MCP_TOKEN
Content-Type: application/json
```

The server maps each MCP token to that user's SonarQube permissions. Never
share one user's token with another user.

## Security

- The endpoint URL is stored in VS Code global state.
- The bearer token is stored in VS Code `SecretStorage`, not workspace settings,
  source files, or logs.
- The token is only placed in the in-memory MCP server definition and is never
  included in status messages or error output.
- Use HTTPS for production deployments.
- Issue a separate least-privilege token to each user.
- Rotate or revoke tokens through the server's credential provider.
- The connection test calls unauthenticated `/healthz`; MCP requests remain
  authenticated by the configured bearer header.

## Publishing to the VS Code Marketplace

Update the `version`, `publisher`, repository metadata, and Marketplace listing
details in `package.json`. Create a publisher and personal access token in the
Visual Studio Marketplace publisher portal, then run:

```bash
npx --yes @vscode/vsce package
npx --yes @vscode/vsce publish
```

The manifest does not require an icon, so packaging does not depend on a
placeholder asset.

## Development checks

```bash
npm run check
```

This runs Node's syntax validation against the extension entrypoint.

## Repository

```text
https://github.com/darshan1005/sonarqube-mcp
```

## License

MIT. See [LICENSE](LICENSE).
