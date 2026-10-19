import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";
import { buildAgentSpawnOptions } from "../src/acp/auth-env.js";

function buildSyntheticAuthEnvironment(
  platform: NodeJS.Platform,
  inherited: NodeJS.ProcessEnv,
  credentials?: Record<string, string>,
  sessionEnv?: Record<string, string>,
  runtimeEnv?: Record<string, string>,
): NodeJS.ProcessEnv {
  const originalEnvironment = process.env;
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const parentEnvironment = { ...inherited };
  process.env = parentEnvironment;
  Object.defineProperty(process, "platform", { value: platform });
  try {
    const options = buildAgentSpawnOptions(os.tmpdir(), credentials, sessionEnv, runtimeEnv);
    assert.equal(process.env, parentEnvironment);
    assert.deepEqual(parentEnvironment, inherited);
    return options.env;
  } finally {
    process.env = originalEnvironment;
    if (platformDescriptor) {
      Object.defineProperty(process, "platform", platformDescriptor);
    }
  }
}

const windowsAuthCases: Array<{
  name: string;
  inherited: NodeJS.ProcessEnv;
  credentials: Record<string, string> | undefined;
  expected: NodeJS.ProcessEnv;
}> = [
  {
    name: "config replaces an inherited native credential that is not passed through",
    inherited: { api_token: "synthetic-parent" },
    credentials: { "api-token": "synthetic-config" },
    expected: {
      "api-token": "synthetic-config",
      ACPX_AUTH_API_TOKEN: "synthetic-config",
      API_TOKEN: "synthetic-config",
    },
  },
  {
    name: "prefixed promotion wins over an inherited native credential",
    inherited: {
      ACPX_AUTH_API_TOKEN: "synthetic-explicit",
      api_token: "synthetic-parent",
    },
    credentials: undefined,
    expected: {
      ACPX_AUTH_API_TOKEN: "synthetic-explicit",
      API_TOKEN: "synthetic-explicit",
    },
  },
  {
    name: "config preserves a differently cased inherited prefixed credential",
    inherited: { acpx_auth_api_token: "synthetic-explicit" },
    credentials: { "api-token": "synthetic-config" },
    expected: {
      acpx_auth_api_token: "synthetic-explicit",
      API_TOKEN: "synthetic-explicit",
      "api-token": "synthetic-config",
    },
  },
  {
    name: "config replaces an inherited raw method credential",
    inherited: { "api-token": "synthetic-parent-raw" },
    credentials: { "API-TOKEN": "synthetic-config" },
    expected: {
      "API-TOKEN": "synthetic-config",
      ACPX_AUTH_API_TOKEN: "synthetic-config",
      API_TOKEN: "synthetic-config",
    },
  },
];

for (const entry of windowsAuthCases) {
  test(`Windows auth environment: ${entry.name}`, () => {
    const env = buildSyntheticAuthEnvironment("win32", entry.inherited, entry.credentials);
    assert.deepEqual(env, entry.expected);
    const names = Object.keys(env).map((key) => key.toUpperCase());
    assert.equal(new Set(names).size, names.length);
  });
}

test("auth defaults still fill missing aliases on Windows", () => {
  assert.deepEqual(
    buildSyntheticAuthEnvironment("win32", {}, { "api-token": "synthetic-config" }),
    {
      "api-token": "synthetic-config",
      ACPX_AUTH_API_TOKEN: "synthetic-config",
      API_TOKEN: "synthetic-config",
    },
  );
});

test("auth defaults drop inherited credentials with case-variant names on Unix", () => {
  const inherited = {
    "API-TOKEN": "synthetic-raw",
    acpx_auth_api_token: "synthetic-prefixed",
    api_token: "synthetic-native",
  };
  assert.deepEqual(
    buildSyntheticAuthEnvironment("linux", inherited, { "api-token": "synthetic-config" }),
    {
      "api-token": "synthetic-config",
      ACPX_AUTH_API_TOKEN: "synthetic-config",
      API_TOKEN: "synthetic-config",
    },
  );
});

test("Windows auth defaults ignore undefined entries without losing the configured value", () => {
  const env = buildSyntheticAuthEnvironment(
    "win32",
    { api_token: undefined },
    { "api-token": "synthetic-config" },
  );
  assert.equal(env.API_TOKEN, "synthetic-config");
  assert.equal(env.ACPX_AUTH_API_TOKEN, "synthetic-config");
});

test("session and runtime overlays cannot replace inherited prefixed auth values on Windows", () => {
  const inherited = {
    acpx_auth_api_token: "synthetic-explicit",
    api_token: "synthetic-native",
    "api-token": "synthetic-raw",
    ORDINARY_SETTING: "parent",
  };
  const env = buildSyntheticAuthEnvironment(
    "win32",
    inherited,
    { "API-TOKEN": "synthetic-config" },
    {
      ACPX_AUTH_API_TOKEN: "session-prefixed",
      API_TOKEN: "session-native",
      "API-TOKEN": "session-raw",
      ORDINARY_SETTING: "session",
    },
    {
      Acpx_Auth_Api_Token: "runtime-prefixed",
      Api_Token: "runtime-native",
      "Api-Token": "runtime-raw",
      ordinary_setting: "runtime",
    },
  );
  assert.deepEqual(env, {
    acpx_auth_api_token: "synthetic-explicit",
    API_TOKEN: "synthetic-explicit",
    "API-TOKEN": "synthetic-config",
    ordinary_setting: "runtime",
  });
});

const gatewayEnvironment: NodeJS.ProcessEnv = {
  PATH: "/usr/bin",
  HOME: "/home/synthetic",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  XDG_CONFIG_HOME: "/home/synthetic/.config",
  https_proxy: "http://proxy.invalid:3128",
  OPENCLAW_GATEWAY_TOKEN: "synthetic-gateway-token",
  OPENAI_API_KEY: "synthetic-openai",
  ANTHROPIC_API_KEY: "synthetic-anthropic",
  GH_TOKEN: "synthetic-github",
  NODE_OPTIONS: "--require synthetic-hook.cjs",
};

for (const platform of ["linux", "win32"] as const) {
  test(`agent children inherit process essentials but no host credentials on ${platform}`, () => {
    assert.deepEqual(buildSyntheticAuthEnvironment(platform, gatewayEnvironment), {
      PATH: "/usr/bin",
      HOME: "/home/synthetic",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      XDG_CONFIG_HOME: "/home/synthetic/.config",
      https_proxy: "http://proxy.invalid:3128",
    });
  });
}

test("credentials reach agent children only through explicit grants", () => {
  const env = buildSyntheticAuthEnvironment(
    "linux",
    { ...gatewayEnvironment, ACPX_AUTH_ANTHROPIC_API_KEY: "synthetic-granted-anthropic" },
    { openai_api_key: "synthetic-granted-openai" },
    undefined,
    { GH_TOKEN: "synthetic-granted-github" },
  );
  assert.equal(env.OPENAI_API_KEY, "synthetic-granted-openai");
  assert.equal(env.ANTHROPIC_API_KEY, "synthetic-granted-anthropic");
  assert.equal(env.GH_TOKEN, "synthetic-granted-github");
  assert.equal(Object.hasOwn(env, "OPENCLAW_GATEWAY_TOKEN"), false);
  assert.equal(Object.hasOwn(env, "NODE_OPTIONS"), false);
});
