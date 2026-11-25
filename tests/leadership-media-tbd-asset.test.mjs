import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import {
  applyChange,
  createRequest,
  mediaNextStatuses,
  STATUS_LABELS
} from "../src/lib/leadership-workflows/domain.ts"
import {
  MEDIA_STATUS_EMOJI,
  detectMediaSlackChange,
  renderMediaParentText,
  renderMediaThreadReply,
  shouldBroadcastMediaReply
} from "../src/lib/leadership-workflows/slack-media.ts"

const justin = { id: "a8be2531-9c64-4cd6-b1cd-1a12f8465609", name: "Justin", email: "justin@example.test", team: "Strategy and Operations" }
const owner = { id: "22222222-2222-4222-8222-222222222222", name: "Owner", email: "owner@example.test", team: "Media" }
const people = [justin, owner]
const now = new Date("2026-11-25T15:00:00Z")
const asset = "https://www.canva.com/design/kit/edit"

function request(media, title = "Test request") {
  return createRequest({
    id: randomUUID(),
    kind: "media",
    title,
    media: { type: "campaign", team: "Media", brief: "Brief", needsCopyHelp: true, ...media }
  }, justin, now)
}
function change(r, action, extra = {}) {
  return applyChange(r, { revision: r.revision, action, ...extra }, justin, justin.id, people, now).record
}
function edit(r, media, title = r.title) {
  return change(r, "edit", { title, media: { ...r.media, ...media } })
}

test("A: a request can be submitted with Post by TBD and Slack shows TBD", () => {
  const r = request({ postedBy: "", postedByTbd: true, platforms: ["Instagram"] })
  assert.equal(r.media.postedByTbd, true)
  assert.equal(r.media.postedBy, "")
  const text = renderMediaParentText(r)
  assert.match(text, /\*Requested post by:\* TBD/)
  assert.doesNotMatch(text, /Needed by/)
})

test("A: a request needs a date or TBD, never neither and never both", () => {
  assert.throws(() => request({ postedBy: "" }), /posted-by date or mark it TBD/)
  assert.throws(() => request({}), /posted-by date or mark it TBD/)
  assert.throws(() => request({ postedBy: "2026-12-01", postedByTbd: true }), /not both/)
  assert.throws(() => request({ postedBy: "2026-02-30" }), /valid date/)
})

test("A: dated requests work as before and older records without the new fields are unchanged", () => {
  const r = request({ postedBy: "2026-12-01", platforms: ["Instagram", "LinkedIn"] })
  assert.equal(r.media.postedBy, "2026-12-01")
  assert.equal(r.media.postedByTbd, false)
  assert.equal(r.media.assetOnly, false)
  assert.match(renderMediaParentText(r), /\*Requested post by:\* Dec 1, 2026/)
  assert.match(renderMediaParentText(r), /\*Planned post date:\* Not set/)
  const legacy = structuredClone(r)
  delete legacy.media.postedByTbd
  delete legacy.media.assetOnly
  delete legacy.media.placeholder
  delete legacy.media.usageNotes
  const text = renderMediaParentText(legacy)
  assert.match(text, /\*Requested post by:\* Dec 1, 2026/)
  assert.doesNotMatch(text, /TBD|Needed by|Placeholder|not posted by IPN/)
  assert.deepEqual(mediaNextStatuses("submitted").includes("delivered"), false)
  assert.deepEqual(mediaNextStatuses("submitted").includes("posted"), true)
})

test("B: asset-only request submits with Needed by Dec 15, N/A platform and placeholder", () => {
  const r = request({ postedBy: "2026-12-15", assetOnly: true, placeholder: true, platforms: ["N/A"], needsCopyHelp: false })
  assert.equal(r.media.assetOnly, true)
  assert.equal(r.media.placeholder, true)
  assert.deepEqual(r.media.platforms, ["N/A"])
  const text = renderMediaParentText(r)
  assert.match(text, /\*Needed by:\* Dec 15, 2026/)
  assert.match(text, /Asset for partner\/internal use, not posted by IPN/)
  assert.match(text, /Placeholder, not ready for production/)
  assert.match(text, /\*Planned delivery date:\* Not set/)
  assert.doesNotMatch(text, /Requested post by|Planned post date/)
})

test("B: asset-only Needed by TBD and partner platforms", () => {
  const r = request({ postedBy: "", postedByTbd: true, assetOnly: true, platforms: ["For partners: Instagram", "For partners: LinkedIn"] })
  assert.match(renderMediaParentText(r), /\*Needed by:\* TBD/)
  assert.throws(() => request({ postedBy: "", assetOnly: true, platforms: ["N/A"] }), /needed-by date or mark it TBD/)
})

test("B: platform lists stay separate for regular and asset-only requests", () => {
  assert.throws(() => request({ postedBy: "2026-12-15", assetOnly: true, platforms: ["Instagram"] }), /N\/A or a partner platform/)
  assert.throws(() => request({ postedBy: "2026-12-15", platforms: ["N/A"] }), /only for asset-only/)
  assert.throws(() => request({ postedBy: "2026-12-15", platforms: ["For partners: LinkedIn"] }), /only for asset-only/)
  assert.deepEqual(request({ postedBy: "2026-12-15", assetOnly: true, platforms: undefined }).media.platforms, ["N/A"])
  assert.deepEqual(request({ postedBy: "2026-12-15", platforms: undefined }).media.platforms, ["Media to advise"])
})

test("C2: asset-only copy is optional and keeps partner captions and usage notes", () => {
  assert.throws(() => request({ postedBy: "2026-12-15", needsCopyHelp: false }), /copywriting help/)
  const r = request({ postedBy: "2026-12-15", assetOnly: true, platforms: ["N/A"], needsCopyHelp: false, caption: "Partner caption", usageNotes: "Tag IPN" })
  assert.equal(r.media.caption, "Partner caption")
  assert.equal(r.media.usageNotes, "Tag IPN")
  assert.equal(request({ postedBy: "2026-12-15", assetOnly: true, platforms: ["N/A"], needsCopyHelp: false }).media.caption, "")
})

test("C1: asset-only requests end at Delivered, never Published", () => {
  let r = request({ postedBy: "2026-12-15", assetOnly: true, platforms: ["N/A"] })
  assert.equal(mediaNextStatuses(r.status, true).includes("posted"), false)
  assert.equal(mediaNextStatuses(r.status, true).includes("delivered"), true)
  assert.equal(STATUS_LABELS.delivered, "Delivered: Ready for partner use")
  const publication = { scheduledDate: "2026-12-14", assetUrl: "", publishedUrl: "", postedDate: "" }
  assert.throws(() => change(r, "media_save", { ownerId: "", status: "delivered", publication }), /media owner/)
  assert.throws(() => change(r, "media_save", { ownerId: owner.id, status: "delivered", publication }), /final Drive or Canva link before marking the asset delivered/)
  assert.throws(() => change(r, "media_save", { ownerId: owner.id, status: "posted", publication: { ...publication, assetUrl: asset } }), /not available|Delivered instead/)
  r = change(r, "media_save", { ownerId: owner.id, status: "ready_to_post", publication: { ...publication, assetUrl: asset } })
  assert.throws(() => change(r, "media_save", { ownerId: owner.id, status: r.status, publication: { ...publication, assetUrl: asset, publishedUrl: "https://example.com/p", postedDate: "2026-12-15" } }), /Delivered instead/)
  const previous = r
  r = change(r, "media_save", { ownerId: owner.id, status: "delivered", publication: { ...publication, assetUrl: asset } })
  assert.equal(r.status, "delivered")
  const slackChange = detectMediaSlackChange(previous, r, "saved")
  assert.equal(shouldBroadcastMediaReply(slackChange), true)
  assert.equal(MEDIA_STATUS_EMOJI.delivered, ":package:")
  assert.match(renderMediaThreadReply(slackChange), /Delivered: Ready for partner use/)
  assert.doesNotMatch(renderMediaThreadReply(slackChange), /Published/)
})

test("C1: regular requests cannot be marked Delivered", () => {
  const r = request({ postedBy: "2026-12-15" })
  assert.throws(() => change(r, "status", { status: "delivered" }), /only for asset-only/)
})

test("asset-only thread replies talk about delivery, not posting", () => {
  const r = request({ postedBy: "2026-12-15", assetOnly: true, platforms: ["N/A"] })
  const next = change(r, "media_save", { ownerId: owner.id, status: r.status, publication: { scheduledDate: "2026-12-12", assetUrl: "", publishedUrl: "", postedDate: "" } })
  const reply = renderMediaThreadReply(detectMediaSlackChange(r, next, "saved"))
  assert.match(reply, /Planned delivery date set to Dec 12, 2026/)
  assert.doesNotMatch(reply, /post date/)
})

test("C5: edits after submit follow the same TBD and asset-only rules", () => {
  let r = request({ postedBy: "2026-12-01", platforms: ["Instagram"] })
  r = edit(r, { postedBy: "", postedByTbd: true })
  assert.equal(r.media.postedByTbd, true)
  assert.equal(r.media.postedBy, "")
  assert.throws(() => edit(r, { postedBy: "", postedByTbd: false }), /or mark it TBD/)
  assert.throws(() => edit(r, { assetOnly: true }), /N\/A or a partner platform/)
  r = edit(r, { assetOnly: true, placeholder: true, platforms: ["N/A"], postedBy: "2026-12-15", postedByTbd: false })
  assert.equal(r.media.assetOnly, true)
  assert.equal(r.media.placeholder, true)
  assert.match(renderMediaParentText(r), /\*Needed by:\* Dec 15, 2026/)
  r = edit(r, { assetOnly: false, placeholder: false, platforms: ["Instagram"] })
  assert.equal(r.media.assetOnly, false)
  assert.match(renderMediaParentText(r), /\*Requested post by:\* Dec 15, 2026/)
})
