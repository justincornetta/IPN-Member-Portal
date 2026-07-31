import assert from "node:assert/strict"
import test from "node:test"

import {
  sourceGroups,
  summarizeCommandFailure,
} from "../scripts/run-analytics-source-refresh.mjs"

test("Instagram and Facebook refresh independently", () => {
  const instagram = sourceGroups.find((source) => source.id === "instagram")
  const facebook = sourceGroups.find((source) => source.id === "facebook")

  assert.ok(instagram)
  assert.ok(facebook)
  assert.equal(sourceGroups.some((source) => source.id === "meta"), false)
  assert.deepEqual(instagram.command.slice(-2), ["--platform", "instagram"])
  assert.deepEqual(facebook.command.slice(-2), ["--platform", "facebook"])
  assert.ok(instagram.lastPullFiles.includes("instagram_last_pull.json"))
  assert.equal(instagram.lastPullFiles.includes("facebook_last_pull.json"), false)
  assert.ok(facebook.lastPullFiles.includes("facebook_last_pull.json"))
  assert.equal(facebook.lastPullFiles.includes("instagram_last_pull.json"), false)
})

test("source failures prefer the actionable error line", () => {
  const message = summarizeCommandFailure([
    "Saved Instagram profile",
    "Meta request complete",
    "ERROR: Facebook refresh failed: a Page access token is required",
    "cleanup complete",
  ].join("\n"), "fallback")

  assert.equal(
    message,
    "ERROR: Facebook refresh failed: a Page access token is required",
  )
})
