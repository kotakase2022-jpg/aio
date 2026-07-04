import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const testRoots = ["tests"];
const testFilePattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const e2ePattern = /[/\\]tests[/\\]e2e[/\\].+\.(test|spec)\.(ts|tsx|js|jsx)$/;

const forbiddenPatterns = [
  /\btest\.only\s*\(/,
  /\bdescribe\.only\s*\(/,
  /\bit\.only\s*\(/,
  /\btest\.skip\s*\(/,
  /\bdescribe\.skip\s*\(/,
  /\bit\.skip\s*\(/,
  /\btest\.todo\s*\(/,
  /\bit\.todo\s*\(/,
  /\bdescribe\.todo\s*\(/,
];

const errors = [];
const testFiles = [];

for (const testRoot of testRoots) {
  await collectFiles(path.join(root, testRoot), testFiles);
}

const e2eFiles = testFiles.filter((file) => e2ePattern.test(file));
if (e2eFiles.length === 0) {
  errors.push("E2E test files are required under tests/e2e.");
}

let e2eRunnableTests = 0;

for (const file of testFiles) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(root, file);

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      errors.push(`${relative}: forbidden test modifier matched ${pattern}`);
    }
  }

  const blockCommentLines = source.match(/\/\*[\s\S]*?\*\//g)?.map((block) => block.split(/\r?\n/).length) ?? [];
  const longestLineCommentRun = longestConsecutiveLineComments(source);
  if (blockCommentLines.some((count) => count >= 30) || longestLineCommentRun >= 20) {
    errors.push(`${relative}: unusually large commented-out block detected.`);
  }

  const tests = findTestBodies(source);
  for (const test of tests) {
    if (e2ePattern.test(file)) {
      e2eRunnableTests += 1;
    }

    if (!/\bexpect\s*\(|\bassert\s*\(|\btoBe\b|\btoEqual\b|\btoHave/.test(test.body)) {
      errors.push(`${relative}: "${test.name}" does not appear to contain an assertion.`);
    }
  }
}

if (e2eFiles.length > 0 && e2eRunnableTests === 0) {
  errors.push("E2E tests exist but no runnable E2E test() blocks were found.");
}

if (errors.length > 0) {
  console.error(["Test integrity check failed:", ...errors.map((error) => `- ${error}`)].join("\n"));
  process.exit(1);
}

console.log(`Test integrity check passed (${testFiles.length} files).`);

async function collectFiles(directory, output) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolute, output);
    } else if (testFilePattern.test(entry.name)) {
      output.push(absolute);
    }
  }
}

function longestConsecutiveLineComments(source) {
  let longest = 0;
  let current = 0;

  for (const line of source.split(/\r?\n/)) {
    if (/^\s*\/\//.test(line)) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (line.trim()) {
      current = 0;
    }
  }

  return longest;
}

function findTestBodies(source) {
  const matches = [];
  const pattern = /\b(?:test|it)\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;
  let match;

  while ((match = pattern.exec(source))) {
    const arrowIndex = source.indexOf("=>", match.index);
    const functionIndex = source.indexOf("function", match.index);
    const bodySearchStart =
      arrowIndex !== -1 && (functionIndex === -1 || arrowIndex < functionIndex)
        ? arrowIndex
        : functionIndex !== -1
          ? functionIndex
          : match.index;
    const start = source.indexOf("{", bodySearchStart);
    if (start === -1) {
      continue;
    }

    const end = findMatchingBrace(source, start);
    if (end === -1) {
      matches.push({ name: match[2], body: "" });
      continue;
    }

    matches.push({ name: match[2], body: source.slice(start, end + 1) });
  }

  return matches;
}

function findMatchingBrace(source, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
