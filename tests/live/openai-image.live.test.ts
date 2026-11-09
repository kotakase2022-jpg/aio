import { expect, test, vi } from "vitest";
import { expectLiveContractEnabled, expectRequiredEnv, loadLiveEnv } from "./live-test-helpers";

test("Image API returns a complete PNG without writing application data", async () => {
  loadLiveEnv();
  expectLiveContractEnabled();
  expectRequiredEnv(["OPENAI_API_KEY"]);
  // A live probe must not multiply paid requests after a transient failure.
  process.env.OPENAI_MAX_RETRIES = "0";
  vi.resetModules();
  const { generateImageBase64 } = await import("@/lib/server/openai");
  const base64 = await generateImageBase64(
    "A clean editorial diagram of a three-step document review workflow on a white background. " +
    "Three distinct document icons linked left to right, with a checkmark on the final document. " +
    "No text, no logos, no people. Professional teal, charcoal and coral palette.",
  );
  const png = Buffer.from(base64, "base64");
  expect(png.length).toBeGreaterThan(1024);
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1024);
  expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(1024);
  expect(png.subarray(-8, -4).toString("ascii")).toBe("IEND");
}, 180_000);
