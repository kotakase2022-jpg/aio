import { afterEach, describe, expect, test } from "vitest";
import {
  createDemoSessionToken,
  verifyDemoSessionToken,
} from "@/lib/demo-session";
import { restoreProcessEnv, snapshotProcessEnv } from "../helpers/env";

const processEnvSnapshot = snapshotProcessEnv();

afterEach(() => {
  restoreProcessEnv(processEnvSnapshot);
});

describe("demo session", () => {
  test("accepts an authentic unexpired token", async () => {
    process.env.DEMO_AUTH_SECRET = "test-only-demo-session-secret-32-characters";
    const now = Date.UTC(2026, 7, 24);
    const token = await createDemoSessionToken({ now, maxAgeSeconds: 60 });

    await expect(verifyDemoSessionToken(token, now + 30_000)).resolves.toBe(true);
  });

  test("rejects fixed, tampered, and expired tokens", async () => {
    process.env.DEMO_AUTH_SECRET = "test-only-demo-session-secret-32-characters";
    const now = Date.UTC(2026, 7, 24);
    const token = await createDemoSessionToken({ now, maxAgeSeconds: 60 });
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    await expect(verifyDemoSessionToken("demo-access-granted", now)).resolves.toBe(false);
    await expect(verifyDemoSessionToken(tampered, now)).resolves.toBe(false);
    await expect(verifyDemoSessionToken(token, now + 60_001)).resolves.toBe(false);
  });
});
