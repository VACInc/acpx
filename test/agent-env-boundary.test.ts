import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Every module that can start a process, and why its environment is safe.
// Agent children, command probes and ACP terminals must build their
// environment through src/acp/auth-env.ts so host credentials are not
// inherited. Adding a spawn site means adding it here with a reviewed reason.
const REVIEWED_SPAWN_MODULES: Record<string, string> = {
  "src/acp/client.ts": "agent child and command probes use buildAgentSpawnOptions()",
  "src/acp/terminal-manager.ts": "ACP terminals start from the agent environment",
  "src/acp/client-process.ts": "runTimedExecFile helper for ps/node process-identity queries",
  "src/flows/executors/shell.ts": "user-authored flow shell actions, not ACP agent children",
  "src/session/execution/queue-owner-process.ts": "re-executes acpx itself as the queue owner",
};

const CHILD_PROCESS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["'](?:node:)?child_process["']/gu;

function startsProcesses(source: string): boolean {
  const runtimeNames = [...source.matchAll(CHILD_PROCESS_IMPORT)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((specifier) => specifier.trim())
      .filter((specifier) => specifier && !specifier.startsWith("type "))
      .map((specifier) => specifier.split(/\s+as\s+/u).pop() ?? specifier),
  );
  return runtimeNames.some((name) => new RegExp(`\\b${name}\\s*\\(`, "u").test(source));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(relative);
    }
    return entry.name.endsWith(".ts") ? [relative] : [];
  });
}

test("process spawn sites are limited to reviewed modules", () => {
  const spawning = sourceFiles("src")
    .filter((file) => startsProcesses(fs.readFileSync(path.join(root, file), "utf8")))
    .toSorted();
  assert.deepEqual(spawning, Object.keys(REVIEWED_SPAWN_MODULES).toSorted());
});

test("ACP agent, probe and terminal code never copies the host environment", () => {
  for (const file of sourceFiles("src/acp")) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /\.\.\.process\.env\b|env:\s*process\.env\b/u, file);
  }
});
