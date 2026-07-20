import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildOverlayUrl } from "../src/url-utils.js";

const args = parseArgs(process.argv.slice(2));
const session = args.session;
const production = Boolean(args.production);
const app = sanitizeApp(args.app || "");

if (!session && !args.mock) {
  fail("Usage: npm run url -- --session SESSION_ID [--production] [--side right] [--max 6] [--duration 18000]");
}

const base = args.base || (production ? detectPagesBaseUrl() : "http://127.0.0.1:8765/");
if (!base) {
  fail("Unable to determine the GitHub Pages base URL. Set PAGES_BASE_URL=https://OWNER.github.io/REPO/ or add a git remote before using --production.");
}

const params = {};
for (const key of ["side", "position", "accent", "max", "duration", "eventDuration", "scale", "debug", "mock", "reduceMotion", "showPlatform", "showBadges", "showAvatar", "showParticipant", "lang", "command", "maxAttempts", "wordLength", "userCooldown", "globalCooldown", "admins", "accents", "sound", "volume", "minorDuration", "standardDuration", "majorDuration", "minorPriority", "standardPriority", "majorPriority", "minorVolume", "standardVolume", "majorVolume", "server"]) {
  if (args[key] !== undefined) params[key] = args[key];
}

const url = buildOverlayUrl({ base, path: app ? `${app}/` : "", session, production, params });
if (process.env.CI && session) {
  console.log(url.replace(encodeURIComponent(session), "SESSION_ID"));
} else {
  console.log(url);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[name] = true;
    } else {
      parsed[name] = next;
      index += 1;
    }
  }
  return parsed;
}

function detectPagesBaseUrl() {
  if (process.env.PAGES_BASE_URL) return ensureTrailingSlash(process.env.PAGES_BASE_URL);
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    if (owner && repo) return `https://${owner}.github.io/${repo}/`;
  }
  try {
    const metadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    if (typeof metadata.homepage === "string" && /^https:\/\/[a-z0-9-]+\.github\.io\/[a-z0-9._-]+\/?$/i.test(metadata.homepage)) {
      return ensureTrailingSlash(metadata.homepage);
    }
  } catch {
    // Fall through to the git remote when package metadata is unavailable.
  }
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const match = remote.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/);
    if (match?.groups) return `https://${match.groups.owner}.github.io/${match.groups.repo}/`;
  } catch {
    return "";
  }
  return "";
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function sanitizeApp(value) {
  const appName = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  if (!appName) return "";
  if (!["chat", "words", "alerts"].includes(appName)) fail("Unknown overlay app. Use chat, words or alerts.");
  return appName;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
