# Mux

- Built-in name: `mux`
- Default entrypoint: `mux acp` via an ACPX-owned npm range
- Upstream: https://mux.coder.com/integrations/acp

`acpx mux` starts coder/mux through its ACP stdio bridge (`mux acp`). `mux acp` auto-starts an in-process mux server, so a separate `mux server` is not required.

Configure at least one model provider before prompting; see https://mux.coder.com/config/providers. Provider keys such as `OPENROUTER_API_KEY` must be granted with `ACPX_AUTH_<NAME>` (for example `ACPX_AUTH_OPENROUTER_API_KEY`), because acpx does not pass ambient credentials to agents. When using direct provider keys, make sure mux route priority includes `direct` before providers you have not authenticated. To target a remote mux server, override the command with `mux acp --server-url <url> --auth-token <token>` (or grant `MUX_SERVER_URL` / `MUX_SERVER_AUTH_TOKEN` with `ACPX_AUTH_MUX_SERVER_URL` / `ACPX_AUTH_MUX_SERVER_AUTH_TOKEN`).
