#!/usr/bin/env node
// Uploads the screenshots and videos added or changed in a pushed commit to
// Slack, right after the per-commit "IPN Member Portal Updated" message.
// Reuses the media that PRs already commit under docs/**/screenshots etc.
//
// Env: COMMIT_SHA (required), SLACK_BOT_TOKEN + SLACK_CHANNEL_ID (optional;
// without them the script only lists what it would upload and exits 0),
// THREAD_TS (optional, posts the files as a reply to that message).
// Never fails the workflow: any Slack error is logged and the script exits 0.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";

const IMAGE = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const VIDEO = new Set([".mp4", ".mov", ".webm"]);
const MAX_IMAGES = 8; // keep the Slack post readable
const MAX_VIDEOS = 2;
const MAX_BYTES = 50 * 1024 * 1024;

const sha = process.env.COMMIT_SHA;
if (!sha) {
  console.error("COMMIT_SHA is required");
  process.exit(1);
}

// For merge commits, diff against the first parent so we get the PR's files.
const changed = execFileSync(
  "git",
  ["diff", "--name-only", "--diff-filter=AM", `${sha}^1`, sha],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.startsWith("public/") && !f.includes("/before/"));

const pick = (exts, max) =>
  changed
    .filter((f) => exts.has(extname(f).toLowerCase()))
    .filter((f) => statSync(f).size <= MAX_BYTES)
    // Prefer desktop shots (1440) first, then the rest in path order.
    .sort((a, b) => Number(b.includes("1440")) - Number(a.includes("1440")) || a.localeCompare(b))
    .slice(0, max);

const files = [...pick(VIDEO, MAX_VIDEOS), ...pick(IMAGE, MAX_IMAGES)];
const total = changed.filter((f) => IMAGE.has(extname(f).toLowerCase()) || VIDEO.has(extname(f).toLowerCase())).length;
console.log(`media in commit: ${total}, uploading: ${files.length}`);
files.forEach((f) => console.log(`  ${f}`));

const token = process.env.SLACK_BOT_TOKEN?.trim();
const channel = process.env.SLACK_CHANNEL_ID?.trim();
if (files.length === 0) process.exit(0);
if (!token || !channel) {
  console.log("SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not set; skipping media upload.");
  process.exit(0);
}

async function slack(method, body, form = false) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(form ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    },
    body: form ? body : JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.error}`);
  return json;
}

try {
  const uploaded = [];
  for (const path of files) {
    const data = readFileSync(path);
    const form = new FormData();
    form.set("filename", basename(path));
    form.set("length", String(data.length));
    const { upload_url, file_id } = await slack("files.getUploadURLExternal", form, true);
    const put = await fetch(upload_url, { method: "POST", body: data });
    if (!put.ok) throw new Error(`upload ${path}: HTTP ${put.status}`);
    uploaded.push({ id: file_id, title: path.split("/").slice(-2).join("/") });
  }
  const more = total > files.length ? ` (showing ${files.length} of ${total})` : "";
  await slack("files.completeUploadExternal", {
    files: uploaded,
    channel_id: channel,
    ...(process.env.THREAD_TS ? { thread_ts: process.env.THREAD_TS } : {}),
    initial_comment: `Screenshots${files.some((f) => VIDEO.has(extname(f).toLowerCase())) ? " and video" : ""} for ${sha.slice(0, 7)}${more}`,
  });
  console.log(`uploaded ${uploaded.length} file(s) to Slack`);
} catch (err) {
  console.log(`::warning::Slack media upload skipped: ${err.message}`);
}
