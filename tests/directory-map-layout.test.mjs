import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const directoryClient = await readFile(
  new URL("../src/app/dashboard/directory/DirectoryClient.tsx", import.meta.url),
  "utf8",
)
const mapView = await readFile(
  new URL("../src/app/dashboard/directory/MapDirectoryView.tsx", import.meta.url),
  "utf8",
)

test("map membership summary lives in the directory toolbar", () => {
  assert.match(directoryClient, /Live membership map/)
  assert.match(directoryClient, /displayedMemberCount/)
  assert.match(directoryClient, /displayedCityCount/)
  assert.match(directoryClient, /displayedCountryCount/)
})

test("map canvas does not contain a summary overlay that can cover controls", () => {
  assert.doesNotMatch(mapView, /Live membership map/)
  assert.doesNotMatch(mapView, /absolute left-4 top-4/)
})
