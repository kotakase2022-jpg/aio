import { describe, expect, test } from "vitest";
import {
  assertSafeOutboundUrl,
  isPublicIpAddress,
  UnsafeOutboundUrlError,
} from "@/lib/server/safe-http";

describe("safe outbound HTTP", () => {
  test.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("classifies %s as non-public", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  test.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "classifies %s as public",
    (address) => {
      expect(isPublicIpAddress(address)).toBe(true);
    },
  );

  test.each([
    "http://localhost/admin",
    "http://api.local/data",
    "http://metadata.google.internal/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "https://user:password@example.com/",
    "file:///etc/passwd",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => assertSafeOutboundUrl(url)).toThrow(UnsafeOutboundUrlError);
  });

  test("accepts a normal public HTTPS URL", () => {
    expect(assertSafeOutboundUrl("https://example.com/article").href).toBe(
      "https://example.com/article",
    );
  });
});
