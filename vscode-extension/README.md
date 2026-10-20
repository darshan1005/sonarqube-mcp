# SonarQube MCP for VS Code

Connect VS Code's MCP support to a deployed SonarQube MCP HTTP server. The
extension registers the server programmatically through
`vscode.lm.registerMcpServerDefinitionProvider` and sends the configured token
as an `Authorization: Bearer <token>` header.

## Requirements

- VS Code 1.102 or newer.
- A reachable HTTPS deployment of this repository's MCP server.
- A user-specific MCP token provisioned by the server administrator.

## Install and use

### From a packaged extension

Install the published **SonarQube MCP** extension from the Visual Studio Code
Marketplace, then open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

### From source

Open this `vscode-extension` folder in VS Code and press `F5` to launch an
Extension Development Host. For a VSIX package, install `@vscode/vsce` and run
`npx @vscode/vsce package` from this folder, then install the generated `.vsix`
with **Extensions: Install from VSIX...**.

Run **SonarQube MCP: Configure**, enter the remote endpoint (for example
`https://your-domain.example.com/mcp`), and enter your personal MCP token.
After saving, VS Code can discover and use the remote MCP server in chat.

Available commands:

- **SonarQube MCP: Configure** — save or replace the endpoint and token.
- **SonarQube MCP: Test Connection** — call the endpoint origin's `/healthz`.
- **SonarQube MCP: Clear Credentials** — remove the endpoint and token.
- **SonarQube MCP: Show Status** — show whether credentials are configured.

## Security

- The endpoint URL is stored in VS Code global state.
- The bearer token is stored in VS Code `SecretStorage`, not workspace settings,
  source files, or logs.
- The token is only placed in the in-memory MCP server definition and is never
  included in status messages or error output.
- Use HTTPS for production deployments and issue a separate least-privilege
  token to each user. Rotate or revoke tokens through the server's credential
  provider.
- The connection test calls unauthenticated `/healthz`; MCP requests remain
  authenticated by the configured bearer header.

## Publishing

Update `version`, `publisher`, repository metadata, and Marketplace listing
details as needed. Create a publisher and personal access token in the Visual
Studio Marketplace publisher portal, then run:

```bash
npx @vscode/vsce package
npx @vscode/vsce publish
```

The manifest intentionally has no icon requirement, so packaging does not
depend on a placeholder asset.

## Development checks

```bash
npm run check
```

This runs Node's syntax validation against the extension entrypoint.
