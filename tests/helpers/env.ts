export function snapshotProcessEnv() {
  return { ...process.env };
}

export function restoreProcessEnv(snapshot: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, snapshot);
}
