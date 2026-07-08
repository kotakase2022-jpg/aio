export function snapshotProcessEnv() {
  return { ...process.env };
}

export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, snapshot);
}

export async function withProcessEnv<T>(callback: () => Promise<T> | T): Promise<T> {
  const snapshot = snapshotProcessEnv();
  try {
    return await callback();
  } finally {
    restoreProcessEnv(snapshot);
  }
}
