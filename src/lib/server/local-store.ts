import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const locks = new Map<string, Promise<unknown>>();

export async function withLocalStoreLock<T>(filename: string, action: () => Promise<T>) {
  const previous = locks.get(filename) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  locks.set(filename, current);
  try {
    return await current;
  } finally {
    if (locks.get(filename) === current) locks.delete(filename);
  }
}

export async function writeLocalJson(filename: string, value: unknown) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, filename);
}
