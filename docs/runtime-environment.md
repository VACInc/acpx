# Transient runtime environment

Embedded clients can set `AcpRuntimeOptions.agentProcessEnv` to a map of strings
for the agent children owned by that runtime. ACPX snapshots the map when
`createAcpRuntime()` is called. Later mutations of the caller's map do not affect
that runtime. The same overlay applies to probes, new sessions, controls and
reconnections, including sessions loaded from an existing store.

Agent children, command probes and ACP terminals do not inherit the parent
process environment. They receive only process essentials (`PATH`, `HOME`,
user, shell, terminal, locale, temp directories, `XDG_*`, proxy and TLS trust
settings, and the Windows system variables) plus explicit grants:
`ACPX_AUTH_*` variables, `authCredentials` or config `auth`, session
environment and `agentProcessEnv`. A provider key such as `OPENAI_API_KEY` in
the parent environment does not reach the agent unless one of those grants
supplies it. ACP terminals start from the same environment as their agent.

Precedence is protected authentication values, then `agentProcessEnv`, then
persisted `sessionOptions.env`, then the inherited process essentials. Windows
uses the same case-insensitive collision handling as session environment values.
The overlay does not change the parent process environment.

Per-session `SessionAgentOptions.env` is saved for reconnects. Its own string
keys and values are preserved exactly, including names such as `__proto__`.

This is trusted embedding-host configuration: executable, loader and other
process settings can change what the child runs. ACPX does not sanitize arbitrary
environment variables. Existing credential protection remains in effect.
Invalid environment entries are rejected without echoing their values.

ACPX does not copy the overlay into session records, events, status or diagnostics.
An adapter can still echo its own environment into output; this option cannot
prevent that. A new runtime must supply its own overlay, and a previously saved
session environment retains its existing persistence behavior.

```ts
const runtime = createAcpRuntime({
  cwd,
  sessionStore,
  agentRegistry,
  permissionMode: "approve-reads",
  agentProcessEnv: { ADAPTER_EXECUTABLE: "/opt/agent/bin/agent" },
});
```
