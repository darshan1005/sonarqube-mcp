# SonarQube MCP

Secure, dependency-free Node.js 20+ remote MCP service for multi-user SonarQube access. Each MCP caller presents its own bearer token; the server maps it to that user's SonarQube token through a credential provider. No shared SonarQube token is accepted.

## Run

```sh
cp .env.example .env
# Set SONAR_URL and SONAR_USERS_JSON
npm test
npm start
```

HTTP listens on `HOST:PORT` (default `127.0.0.1:3000`). `GET /healthz` is unauthenticated. `POST /mcp` requires `Authorization: Bearer <mcp-token>`. MCP JSON-RPC methods supported are `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`. CORS is intentionally disabled; put TLS and any required origin policy in a reverse proxy.

For a public deployment, set `HOST=0.0.0.0`, terminate HTTPS at a reverse proxy or load balancer, and place the service behind network-level rate limiting. This repository intentionally does not implement user registration or issue tokens; provision users through your secret manager or replace the static credential provider with your identity system.

## Users and credentials

`SONAR_USERS_JSON` is a JSON array such as:

```json
[{"id":"alice","tokenHash":"<sha256 hex of the caller token>","sonarToken":"<alice's SonarQube token>"}]
```

For first deployments, `token` may be used for an opaque caller token kept only in the environment, but `tokenHash` is preferred. Generate a hash with `node -e "console.log(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" -- 'token'`. Keep the environment secret, restrict process access, and never put tokens in logs or URLs. Sonar tokens are sent only to SonarQube in an Authorization header.

The static provider is `StaticCredentialProvider` in `src/auth.js`. Replace it with a database or OIDC-backed provider implementing `authenticate(token)` and `getSonarToken(user)`; keep the HTTP/MCP layers unchanged. In a production deployment, terminate TLS, add rate limiting, and rotate caller/Sonar credentials.

## Tools

`sonar_search_projects`, `sonar_get_project`, `sonar_get_measures`, `sonar_search_issues`, `sonar_quality_gate`, and `sonar_component_tree`. Pagination is bounded by `MAX_PAGE_SIZE` (default 100); request bodies by `MAX_BODY_BYTES`; Sonar requests by `SONAR_TIMEOUT_MS`.

## Docker and stdio

`docker build -t sonarqube-mcp . && docker run --env-file .env -p 3000:3000 sonarqube-mcp`. For local MCP clients, `npm run start:stdio` uses the first configured registry user because stdio has no bearer-header channel; use the remote HTTP transport for real multi-user operation.

## Checks

Run `npm test` and `npm run check`. The implementation uses only Node built-ins and `fetch`.

## License

MIT. See [LICENSE](LICENSE).
