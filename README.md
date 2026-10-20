# SonarQube MCP

Secure, dependency-free Node.js 20+ MCP service for multi-user SonarQube access.
The service supports both a remote HTTP transport for public deployments and a
local stdio transport for development or desktop MCP clients.

Each remote MCP caller presents its own bearer token. The server maps that
caller token to the caller's SonarQube token through a credential provider.
SonarQube tokens are never accepted from tool arguments and are never logged.

## Features

- Remote MCP JSON-RPC endpoint: `POST /mcp`
- Health endpoint: `GET /healthz`
- Local stdio MCP entrypoint
- Per-user bearer-token authentication
- SHA-256 hashed MCP token support
- Per-user SonarQube token mapping
- Request body and pagination limits
- SonarQube request timeouts
- No runtime dependencies beyond Node.js built-ins
- Docker image and GitHub Actions CI configuration

## Requirements

- Node.js 20 or newer
- A SonarQube server reachable by the MCP service
- A SonarQube user token for each configured user
- For a public deployment: an HTTPS domain or reverse proxy

## Clone and install

```bash
git clone https://github.com/darshan1005/sonarqube-mcp.git
cd sonarqube-mcp
npm install
```

This project currently has no external runtime dependencies, but running
`npm install` validates the package and prepares the project for future updates.

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

The available settings are:

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `SONAR_URL` | Yes | SonarQube base URL, without `/api` | — |
| `SONAR_USERS_JSON` | Yes | JSON array mapping MCP users to SonarQube tokens | — |
| `HOST` | No | HTTP bind address | `127.0.0.1` |
| `PORT` | No | HTTP port | `3000` |
| `MAX_BODY_BYTES` | No | Maximum JSON request size | `1048576` |
| `SONAR_TIMEOUT_MS` | No | SonarQube request timeout | `10000` |
| `MAX_PAGE_SIZE` | No | Maximum page size accepted by tools | `100` |

Example `.env`:

```env
HOST=0.0.0.0
PORT=3000
SONAR_URL=https://sonarqube.example.com
SONAR_USERS_JSON=[{"id":"alice","tokenHash":"SHA256_HASH_OF_MCP_TOKEN","sonarToken":"ALICE_SONARQUBE_TOKEN"}]
MAX_BODY_BYTES=1048576
SONAR_TIMEOUT_MS=10000
MAX_PAGE_SIZE=100
```

Do not commit `.env`, bearer tokens, SonarQube tokens, or an `mcp.json` file
containing real credentials.

## Configure users and tokens

`SONAR_USERS_JSON` is an array. Each user must include:

- `id`: an internal user identifier
- `tokenHash` or `token`: the MCP caller credential
- `sonarToken`: that user's SonarQube token

Production deployments should use `tokenHash`:

```json
[
  {
    "id": "alice",
    "tokenHash": "sha256-hex-value",
    "sonarToken": "alice-sonarqube-token"
  },
  {
    "id": "bob",
    "tokenHash": "another-sha256-hex-value",
    "sonarToken": "bob-sonarqube-token"
  }
]
```

Generate a SHA-256 hash for an MCP token:

```bash
node -e "console.log(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" -- "your-mcp-token"
```

PowerShell example:

```powershell
node -e 'console.log(require("node:crypto").createHash("sha256").update(process.argv[1]).digest("hex"))' -- 'your-mcp-token'
```

The plain `token` property is supported for local development, but should not
be used in source-controlled files. Replace the static provider in
`src/auth.js` with a database or OIDC-backed provider for user provisioning,
token rotation, and larger deployments.

## Run the remote HTTP server

For local development:

```bash
npm start
```

The server listens at:

```text
http://127.0.0.1:3000
```

For a public deployment, set `HOST=0.0.0.0` and put the service behind an HTTPS
reverse proxy or load balancer. The MCP endpoint is:

```text
https://your-domain.example.com/mcp
```

The health endpoint is intentionally unauthenticated:

```bash
curl https://your-domain.example.com/healthz
```

The MCP endpoint requires a user-specific bearer token:

```bash
curl https://your-domain.example.com/mcp \
  -H "Authorization: Bearer YOUR_USER_MCP_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Do not pass tokens in query strings or tool arguments.

## Configure a remote MCP client

### OpenCode / OmniRush configuration

OpenCode uses `opencode.jsonc` and an `mcp` section. Add this configuration:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sonarqube": {
      "type": "remote",
      "url": "https://your-domain.example.com/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_USER_MCP_TOKEN"
      },
      "oauth": false,
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

Replace the URL and bearer token. Give each person their own MCP token so the
server uses that person's SonarQube permissions and audit identity.

The local app documentation covers custom workspace MCP servers in
`start-here/connect-your-stack/add-an-mcp-server.mdx` and organization-managed
connections in `cloud/share-with-your-team/shared-mcp-connections.mdx`.

### Generic `mcp.json`

Clients that use the common `mcpServers` format can use:

```json
{
  "mcpServers": {
    "sonarqube": {
      "url": "https://your-domain.example.com/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_USER_MCP_TOKEN"
      }
    }
  }
}
```

Keep this file outside source control when it contains a real token. If needed,
add it to `.gitignore`:

```gitignore
mcp.json
```

## Configure a local stdio MCP client

The stdio entrypoint uses the first user in `SONAR_USERS_JSON`. Stdio has no
HTTP bearer-header channel, so use the remote transport for real multi-user
operation.

### OpenCode local configuration

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sonarqube": {
      "type": "local",
      "command": [
        "node",
        "C:\\Users\\YOUR_USER\\sonarqube-mcp\\src\\stdio.js"
      ],
      "environment": {
        "SONAR_URL": "https://sonarqube.example.com",
        "SONAR_USERS_JSON": "[{\"id\":\"local-user\",\"token\":\"stdio-placeholder\",\"sonarToken\":\"YOUR_SONARQUBE_TOKEN\"}]"
      },
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

### Generic stdio `mcp.json`

```json
{
  "mcpServers": {
    "sonarqube": {
      "command": "node",
      "args": [
        "C:\\Users\\YOUR_USER\\sonarqube-mcp\\src\\stdio.js"
      ],
      "env": {
        "SONAR_URL": "https://sonarqube.example.com",
        "SONAR_USERS_JSON": "[{\"id\":\"local-user\",\"token\":\"stdio-placeholder\",\"sonarToken\":\"YOUR_SONARQUBE_TOKEN\"}]"
      }
    }
  }
}
```

Alternatively, run the stdio server directly:

```bash
npm run start:stdio
```

## Available tools

The MCP server exposes:

- `sonar_search_projects`
- `sonar_get_project`
- `sonar_get_measures`
- `sonar_search_issues`
- `sonar_quality_gate`
- `sonar_component_tree`

Tool requests are bounded by `MAX_PAGE_SIZE`, and SonarQube calls are bounded by
`SONAR_TIMEOUT_MS`.

## Docker deployment

Build the image:

```bash
docker build -t sonarqube-mcp .
```

Run locally with an environment file:

```bash
docker run --rm --env-file .env -p 3000:3000 sonarqube-mcp
```

For production, provide secrets through the platform's secret manager rather
than baking `.env` into the image. Put TLS, rate limiting, access logging, and
network policy in front of the container.

## Security and production checklist

Before exposing the service publicly:

1. Use HTTPS; do not expose plain HTTP to the internet.
2. Use a separate, least-privilege SonarQube token for every user or service account.
3. Store `SONAR_USERS_JSON` in a secret manager.
4. Use `tokenHash`, not plain MCP `token`, in production.
5. Do not log authorization headers or environment variables.
6. Add reverse-proxy or gateway rate limiting.
7. Rotate MCP and SonarQube tokens regularly.
8. Restrict network access from the MCP service to trusted SonarQube hosts.
9. Replace `StaticCredentialProvider` with OIDC or a database-backed provider for user registration and revocation.
10. Review SonarQube permissions for every mapped user.

The current implementation is intentionally read-only: it exposes SonarQube
project, measure, issue, quality-gate, and component queries, not mutation
endpoints.

## Tests and checks

Run the test suite:

```bash
npm test
```

Run JavaScript syntax checks:

```bash
npm run check
```

GitHub Actions runs both checks for pushes and pull requests.

## Repository

Public repository:

```text
https://github.com/darshan1005/sonarqube-mcp
```

## License

MIT. See [LICENSE](LICENSE).
