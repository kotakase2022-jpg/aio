import { afterEach, describe, expect, test } from "vitest";

import { restoreProcessEnv, snapshotProcessEnv, withProcessEnv } from "../helpers/env";

const processEnvSnapshot = snapshotProcessEnv();

afterEach(() => {
  restoreProcessEnv(processEnvSnapshot);
});

describe("test env helpers", () => {
  test("withProcessEnv restores mutations after an async callback resolves", async () => {
    process.env.AIO_TEST_EXISTING_VALUE = "before";
    delete process.env.AIO_TEST_ADDED_VALUE;

    const result = await withProcessEnv(async () => {
      process.env.AIO_TEST_EXISTING_VALUE = "during";
      process.env.AIO_TEST_ADDED_VALUE = "created";
      return "done";
    });

    expect(result).toBe("done");
    expect(process.env.AIO_TEST_EXISTING_VALUE).toBe("before");
    expect(process.env.AIO_TEST_ADDED_VALUE).toBeUndefined();
  });

  test("withProcessEnv restores mutations after an async callback rejects", async () => {
    process.env.AIO_TEST_EXISTING_VALUE = "before";
    delete process.env.AIO_TEST_ADDED_VALUE;

    await expect(
      withProcessEnv(async () => {
        process.env.AIO_TEST_EXISTING_VALUE = "during";
        process.env.AIO_TEST_ADDED_VALUE = "created";
        throw new Error("expected failure");
      }),
    ).rejects.toThrow("expected failure");

    expect(process.env.AIO_TEST_EXISTING_VALUE).toBe("before");
    expect(process.env.AIO_TEST_ADDED_VALUE).toBeUndefined();
  });
});
