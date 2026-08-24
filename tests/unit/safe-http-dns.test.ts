import { beforeEach, describe, expect, test, vi } from "vitest";

const dnsState = vi.hoisted(() => ({
  addresses: [{ address: "127.0.0.1", family: 4 }],
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => dnsState.addresses),
}));

beforeEach(() => {
  dnsState.addresses = [{ address: "127.0.0.1", family: 4 }];
});

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

  test("returns an address array when Node requests all lookup results", async () => {
    dnsState.addresses = [
      { address: "203.0.114.10", family: 4 },
      { address: "2001:4860:4860::8888", family: 6 },
    ];
    const { publicDnsLookup } = await import("@/lib/server/safe-http");

    const result = await new Promise<unknown>((resolve, reject) => {
      publicDnsLookup("public.example", { all: true }, (error, address) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address);
      });
    });

    expect(result).toEqual(dnsState.addresses);
  });

  test.each([6, "IPv6"] as const)(
    "honors requested IP family %s for a single lookup result",
    async (familyOption) => {
      dnsState.addresses = [
        { address: "203.0.114.10", family: 4 },
        { address: "2001:4860:4860::8888", family: 6 },
      ];
      const { publicDnsLookup } = await import("@/lib/server/safe-http");

      const result = await new Promise<{ address: string | object; family?: number }>(
        (resolve, reject) => {
          publicDnsLookup("public.example", { family: familyOption }, (error, address, family) => {
            if (error) {
              reject(error);
              return;
            }
            resolve({ address, family });
          });
        },
      );

      expect(result).toEqual({ address: "2001:4860:4860::8888", family: 6 });
    },
  );
});
