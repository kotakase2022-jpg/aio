import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (process.env.CI === "true" || process.env.HUSKY === "0" || process.env.NODE_ENV === "production") {
  process.exit(0);
}

const huskyBin = process.platform === "win32" ? "node_modules/.bin/husky.cmd" : "node_modules/.bin/husky";

if (!existsSync(huskyBin)) {
  process.exit(0);
}

const result = spawnSync(huskyBin, { stdio: "inherit", shell: false });
if ((result.status ?? 0) !== 0) {
  console.warn("Husky setup was skipped because the local husky command did not complete successfully.");
}

process.exit(0);
