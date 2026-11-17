import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"
import { EVENT_ARTWORK_EXTENSIONS, eventArtworkUploadError, MAX_EVENT_ARTWORK_BYTES } from "../src/lib/events/artwork.ts"

// Execute the real upload action with only auth/storage replaced. No network or credentials.
const source = readFileSync(new URL("../src/lib/admin/actions.ts", import.meta.url), "utf8")
const actionSource = source.slice(source.indexOf("export async function uploadContentImage(")).replace("export async", "async")
const code = ts.transpileModule(actionSource + "\nuploadContentImage", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function action({ authorized = true, storageError = null } = {}) {
  const uploads = []
  const upload = vm.runInNewContext(code, {
    eventArtworkUploadError, EVENT_ARTWORK_EXTENSIONS,
    verifyAdmin: async () => authorized ? { userId: "example-admin" } : { error: "Unauthorized" },
    createAdminClient: () => ({ storage: { from: () => ({
      upload: async (path, bytes, options) => { uploads.push({ path, bytes: Buffer.from(bytes), options }); return { error: storageError } },
      getPublicUrl: path => ({ data: { publicUrl: `https://example.test/${path}` } }),
    }) } }),
  })
  return { upload, uploads }
}
function form(type, bytes, eventArtwork = true) {
  const fd = new FormData()
  fd.append("file", new File([bytes], "original", { type }))
  if (eventArtwork) fd.append("imageMode", "event-artwork")
  return fd
}

test("event artwork retains the source bytes, format and matching storage metadata", async () => {
  for (const [mime, extension] of Object.entries(EVENT_ARTWORK_EXTENSIONS)) {
    const { upload, uploads } = action()
    const bytes = Buffer.from([0, 255, 37, 10, 64, 128])
    assert.ok((await upload(form(mime, bytes))).url)
    assert.equal(uploads.length, 1)
    assert.deepEqual(uploads[0].bytes, bytes)
    assert.equal(uploads[0].options.contentType, mime)
    assert.ok(uploads[0].path.endsWith(`.${extension}`))
    assert.equal(uploads[0].options.upsert, false)
  }
})
test("recording/resource crop uploads keep their existing JPEG storage contract", async () => {
  const { upload, uploads } = action()
  await upload(form("image/jpeg", Buffer.from("existing cropped JPEG"), false))
  assert.equal(uploads[0].options.contentType, "image/jpeg")
  assert.ok(uploads[0].path.endsWith(".jpg"))
})
test("unsupported, empty and oversized event originals produce useful errors before storage", async () => {
  const { upload, uploads } = action()
  for (const fd of [form("image/svg+xml", "<svg/>"), form("image/png", ""), form("image/png", new Uint8Array(MAX_EVENT_ARTWORK_BYTES + 1))]) {
    assert.ok((await upload(fd)).error)
  }
  assert.equal(uploads.length, 0)
  assert.equal(eventArtworkUploadError({ type: "image/jpeg", size: MAX_EVENT_ARTWORK_BYTES }), null)
  assert.match(eventArtworkUploadError({ type: "image/png", size: MAX_EVENT_ARTWORK_BYTES + 1 }), /900 KB/)
})
test("authorization and storage failures do not claim that an image was saved", async () => {
  const unauthorized = action({ authorized: false })
  assert.equal((await unauthorized.upload(form("image/jpeg", "bytes"))).error, "Unauthorized")
  assert.equal(unauthorized.uploads.length, 0)
  const failed = action({ storageError: { message: "Storage unavailable" } })
  assert.equal((await failed.upload(form("image/png", "bytes"))).error, "Storage unavailable")
})
