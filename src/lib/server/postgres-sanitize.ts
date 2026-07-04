const disallowedControlChars = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export function sanitizeForPostgres<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizePostgresString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForPostgres(item)) as T;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeForPostgres(entry),
      ]),
    ) as T;
  }

  return value;
}

function sanitizePostgresString(value: string) {
  return replaceInvalidSurrogates(value.replace(disallowedControlChars, ""));
}

function replaceInvalidSurrogates(value: string) {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += value[index] + value[index + 1];
        index += 1;
      } else {
        output += "\uFFFD";
      }
      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      output += "\uFFFD";
      continue;
    }

    output += value[index];
  }

  return output;
}
