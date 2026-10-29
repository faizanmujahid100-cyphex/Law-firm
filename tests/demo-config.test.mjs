import test from "node:test";
import assert from "node:assert/strict";
import { demoAccounts, isDemoMode } from "../src/lib/demo-config.ts";

test("demo mode is explicit or used only when both Firebase credentials are absent", () => {
  const names = ["DEMO_MODE", "NEXT_PUBLIC_FIREBASE_API_KEY", "FIREBASE_SERVICE_ACCOUNT_JSON"];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.equal(isDemoMode(), true);
    process.env.DEMO_MODE = "false";
    assert.equal(isDemoMode(), false);
    delete process.env.DEMO_MODE;
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "invalid-config";
    assert.equal(isDemoMode(), false, "A broken live configuration must not silently enable demo access");
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "configured";
    assert.equal(isDemoMode(), false, "Server credentials must also prevent automatic demo access");
    process.env.DEMO_MODE = "true";
    assert.equal(isDemoMode(), true);
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

test("public demo accounts cover each workspace with unique fictional identities", () => {
  assert.deepEqual(demoAccounts.map(a => a.role), ["ADMIN", "TEAM", "CLIENT"]);
  assert.equal(new Set(demoAccounts.map(a => a.email)).size, 3);
  for (const account of demoAccounts) assert.ok(account.email.endsWith(".test"));
});
