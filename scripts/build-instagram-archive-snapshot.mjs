// Instagram-only candidate generation: never run unrelated loaders or maintenance.
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { buildInstagramArchiveSnapshot } from "./instagram-snapshot.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"))
const previous = read("src/lib/admin/analytics/legacy-snapshot.json")
const media = read("data/instagram_media.json")
const pull = read("data/instagram_last_pull.json")
const stats = read("data/instagram_stats.json")
const snapshot = buildInstagramArchiveSnapshot(previous, { media, pull, stats })
const output = resolve(process.argv[2] || resolve(root, "data/instagram-snapshot-candidate.json"))
writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Instagram-only snapshot candidate: ${output}`)
