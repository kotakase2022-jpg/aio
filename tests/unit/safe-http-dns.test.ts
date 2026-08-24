import { describe, expect, test, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "127.0.0.1", family: 4 }]),
}));

describe("safe outbound HTTP DNS pinning", () => {
  test("rejects a public-looking hostname when DNS resolves to loopback", async () => {
    const { safeFetch } = await import("@/lib/server/safe-http");

    await expect(
      safeFetch("http://public-looking.example/resource", {}, { timeoutMs: 2_000 }),
    ).rejects.toMatchObject({
      name: "UnsafeOutboundUrlError",
      message: "安全上の理由により、このURLは取得できません。",
    });
  });
});
