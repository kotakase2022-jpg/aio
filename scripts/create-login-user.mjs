// Creates one login account entry for AIO_AUTH_USERS. Run it on the operator's own machine:
//
//   node scripts/create-login-user.mjs someone@example.com
//
// It prints a generated password once (give it to that person through a private channel) and the JSON
// entry to add to AIO_AUTH_USERS in Vercel. With --password-stdin it hashes the first line of standard
// input instead (at least 15 characters) and does not print it. Nothing is sent anywhere or stored.
import { readFileSync } from "node:fs";
import {
  generatePassword,
  hashPassword,
  isPlausibleEmail,
  normalizeEmail,
  passwordProblem,
} from "../src/lib/server/login-credentials.ts";

const usage = "Usage: node scripts/create-login-user.mjs <email> [--password-stdin]";
const args = process.argv.slice(2);
const flags = args.filter((arg) => arg.startsWith("--"));
const positional = args.filter((arg) => !arg.startsWith("--"));
const passwordFromStdin = flags.includes("--password-stdin");
if (positional.length !== 1 || flags.some((flag) => flag !== "--password-stdin")) {
  fail(usage, 2);
}

const email = normalizeEmail(positional[0]);
if (!isPlausibleEmail(email)) {
  fail(`Not an email address: ${positional[0]}\n${usage}`);
}

const password = passwordFromStdin
  ? readFileSync(0, "utf8").split(/\r?\n/)[0]
  : generatePassword();
const problem = passwordProblem(password);
if (problem) {
  fail(problem);
}

const entry = JSON.stringify({ email, passwordHash: await hashPassword(password) });
const lines = [`Login account for ${email}`, ""];
if (!passwordFromStdin) {
  lines.push(
    "Password (shown only now; give it to this person through a private channel):",
    `  ${password}`,
    "",
  );
}
lines.push(
  "Add this entry to the JSON array in AIO_AUTH_USERS (Vercel > Settings > Environment Variables):",
  `  ${entry}`,
  "",
  "With only this account, the whole value is:",
  `  [${entry}]`,
  "",
  "Redeploy for the change to apply. Removing an entry, or replacing its passwordHash, ends the",
  "sessions of that account.",
);
console.log(lines.join("\n"));

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}
