import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import {
  applyChange,
  canRead,
  isQueueRequest,
  mediaStages,
  ownDrafts,
  saveDraft,
  sendDraft,
  STATUS_LABELS
} from "../src/lib/leadership-workflows/domain.ts"
import {
  mediaJobsFor,
  withMediaSlackChange
} from "../src/lib/leadership-workflows/slack-media.ts"

const justin = { id: "a8be2531-9c64-4cd6-b1cd-1a12f8465609", name: "Justin", email: "justin@example.test", team: "Strategy and Operations" }
const luke = { id: "22222222-2222-4222-8222-222222222222", name: "Luke", email: "luke@example.test", team: "Media" }
const people = [justin, luke]
const t0 = new Date("2026-11-25T15:00:00Z")
const t1 = new Date("2026-11-25T16:00:00Z")
const t2 = new Date("2026-11-25T17:00:00Z")

const create = (input, actor = luke, at = t0) =>
  saveDraft(undefined, { id: randomUUID(), kind: "media", action: "save_draft", ...input }, actor, at).record
const readyToSend = (draft, extra = {}) => ({
  id: draft.id,
  kind: "media",
  title: "Office hours",
  media: { type: "event", team: "Community", brief: "Weekly office hours", postedBy: "2026-12-01", platforms: ["Instagram"], needsCopyHelp: true, ...extra }
})

test("a draft saves with every required field missing and gets no date", () => {
  const draft = create({})
  assert.equal(draft.status, "draft")
  assert.equal(draft.title, "")
  assert.equal(draft.revision, 1)
  assert.equal(draft.media.team, "")
  assert.equal(draft.media.brief, "")
  assert.equal(draft.media.postedBy, "")
  assert.equal(draft.media.postedByTbd, false)
  assert.deepEqual(draft.media.platforms, ["Media to advise"])
})

test("a partly filled draft keeps what was entered, including PR #86 options", () => {
  const draft = create({
    title: "Media kit",
    media: {
      type: "campaign", team: "PsychedelX", brief: "Kit for partners", assetOnly: true, postedByTbd: true,
      placeholder: true, platforms: ["For partners: LinkedIn"], caption: "Partner caption",
      links: [{ label: "x", url: "not a link yet" }], destinationUrl: "half typed"
    }
  })
  assert.equal(draft.media.assetOnly, true)
  assert.equal(draft.media.postedByTbd, true)
  assert.equal(draft.media.postedBy, "")
  assert.equal(draft.media.placeholder, true)
  assert.deepEqual(draft.media.platforms, ["For partners: LinkedIn"])
  assert.equal(draft.media.links[0].url, "not a link yet")
  assert.equal(draft.media.destinationUrl, "half typed")
})

test("drafts still reject unusable input such as oversized text", () => {
  assert.throws(() => create({ title: "x".repeat(181) }), /too long/)
  assert.throws(() => create({ media: { brief: 12 } }), /must be text/)
})

test("saving a draft makes no Slack job or Slack change, on create or update", () => {
  const draft = create({ title: "Idea", media: { team: "Media" } })
  assert.deepEqual(mediaJobsFor(draft, "draft_saved"), [])
  assert.equal("slackChange" in withMediaSlackChange(draft, "draft_saved", undefined, "", "Luke"), false)
  const { record, event } = saveDraft(draft, { revision: 1, title: "Better idea", media: { ...draft.media, team: "Community", brief: "More" } }, luke, t1)
  assert.equal(event, "draft_saved")
  assert.equal(record.revision, 2)
  assert.equal(record.status, "draft")
  assert.equal(record.id, draft.id)
  assert.equal(record.submittedAt, draft.submittedAt)
  assert.deepEqual(mediaJobsFor(record, event, draft), [])
  assert.equal("slackChange" in withMediaSlackChange(record, event, draft, "", "Luke"), false)
  // Even a status-like edit on a draft cannot raise a Slack job.
  assert.deepEqual(mediaJobsFor(record, "saved", draft), [])
})

test("drafts stay out of the queue and calendar and appear only in the creator's drafts", () => {
  const mine = create({ title: "Mine" })
  const theirs = create({ title: "Theirs" }, justin)
  const rows = [mine, theirs]
  assert.deepEqual(rows.filter(isQueueRequest), [])
  assert.deepEqual(ownDrafts(rows, luke.id).map((r) => r.title), ["Mine"])
  assert.deepEqual(ownDrafts(rows, justin.id).map((r) => r.title), ["Theirs"])
  assert.equal(canRead(mine, luke.id, justin.id), true)
  assert.equal(canRead(mine, justin.id, justin.id), false, "even the approver cannot read another person's draft")
  assert.equal(canRead(mine, "33333333-3333-4333-8333-333333333333", justin.id), false)
})

test("draft is not a queue stage or filter option", () => {
  assert.equal(STATUS_LABELS.draft, "Draft")
  assert.equal(mediaStages(false).includes("draft"), false)
  assert.equal(mediaStages(true).includes("draft"), false)
})

test("only the creator can update, send or delete a draft", () => {
  const draft = create({ title: "Private" })
  assert.throws(() => saveDraft(draft, { revision: 1, media: {} }, justin, t1), /not found/i)
  assert.throws(() => sendDraft(draft, readyToSend(draft), justin, t1), /not found/i)
  assert.throws(() => applyChange(draft, { revision: 1, action: "delete" }, justin, justin.id, people, t1), /do not have access/)
})

test("a stale draft revision is rejected", () => {
  const draft = create({ title: "Stale" })
  assert.throws(() => saveDraft(draft, { revision: 7, media: {} }, luke, t1), /changed in another window/)
  assert.throws(() => saveDraft(draft, { media: {} }, luke, t1), /changed in another window/)
})

test("sending a draft runs the strict submit checks", () => {
  const draft = create({ title: "Half done", media: { team: "Community" } })
  assert.throws(() => sendDraft(draft, { ...readyToSend(draft), title: "" }, luke, t1), /Idea name is required/)
  assert.throws(() => sendDraft(draft, readyToSend(draft, { team: "" }), luke, t1), /Team \/ project is required/)
  assert.throws(() => sendDraft(draft, readyToSend(draft, { brief: "" }), luke, t1), /Event description is required/)
  assert.throws(() => sendDraft(draft, readyToSend(draft, { postedBy: "" }), luke, t1), /date or mark it TBD/)
  assert.throws(() => sendDraft(draft, readyToSend(draft, { needsCopyHelp: false }), luke, t1), /copywriting help/)
  assert.throws(() => sendDraft(draft, { ...readyToSend(draft), id: randomUUID() }, luke, t1), /Invalid request ID/)
})

test("a sent draft becomes a normal submitted request that posts one Slack parent", () => {
  const draft = create({ title: "Office hours" })
  const saved = saveDraft(draft, { revision: 1, title: "Office hours", media: { team: "Community" } }, luke, t1).record
  const sent = sendDraft(saved, readyToSend(saved), luke, t2)
  assert.equal(sent.id, draft.id)
  assert.equal(sent.status, "submitted")
  assert.equal(sent.revision, saved.revision + 1)
  assert.equal(sent.submittedAt, t2.toISOString())
  assert.equal(sent.requesterId, luke.id)
  assert.equal(isQueueRequest(sent), true)
  assert.equal(canRead(sent, justin.id, justin.id), true)
  assert.deepEqual(ownDrafts([sent], luke.id), [])
  // Same Slack path as a brand-new request: parent post only, no thread reply data.
  assert.deepEqual(mediaJobsFor(sent, "submitted", saved), [{ target: "slack_media" }])
  assert.equal("slackChange" in withMediaSlackChange(sent, "submitted", saved, "", "Luke"), false)
  // It is now an ordinary request: it cannot be saved as a draft again.
  assert.throws(() => saveDraft(sent, { revision: sent.revision, media: {} }, luke, t2), /already been sent/)
  assert.throws(() => sendDraft(sent, readyToSend(sent), luke, t2), /already been sent/)
})

test("PR #86 behavior survives the draft round trip: TBD date and asset-only", () => {
  const draft = create({ title: "Kit", media: { assetOnly: true, postedByTbd: true, platforms: ["N/A"], placeholder: true } })
  const sent = sendDraft(draft, readyToSend(draft, { type: "campaign", assetOnly: true, postedBy: "", postedByTbd: true, platforms: ["N/A"], placeholder: true, needsCopyHelp: false }), luke, t1)
  assert.equal(sent.media.assetOnly, true)
  assert.equal(sent.media.postedByTbd, true)
  assert.equal(sent.media.postedBy, "")
  assert.equal(sent.media.placeholder, true)
  assert.ok(mediaStages(true).includes("delivered"))
})

test("the creator can soft-delete a draft, and nothing else can be done to it", () => {
  const draft = create({ title: "Delete me" })
  assert.throws(() => applyChange(draft, { revision: 1, action: "comment", note: "hi" }, luke, justin.id, people, t1), /Open this draft/)
  assert.throws(() => applyChange(draft, { revision: 1, action: "status", status: "accepted" }, luke, justin.id, people, t1), /Open this draft/)
  const { record, event } = applyChange(draft, { revision: 1, action: "delete" }, luke, justin.id, people, t1)
  assert.equal(event, "delete")
  assert.equal(record.deletedBy, luke.id)
  assert.ok(record.deletedAt)
  assert.deepEqual(mediaJobsFor(record, event, draft), [])
  assert.deepEqual(ownDrafts([record], luke.id), [])
  assert.equal(isQueueRequest(record), false)
})

test("the wizard offers Save draft on every step and the workspace lists My drafts", () => {
  const form = readFileSync("src/components/leadership-workflows/MediaIntakeForm.tsx", "utf8")
  const footer = form.slice(form.indexOf("<footer"))
  assert.match(footer, /Save draft/)
  assert.ok(form.indexOf("<footer") > form.indexOf("{step === 3 && <>"), "button sits outside the per-step blocks")
  assert.match(form, /action: "save_draft"/)
  assert.doesNotMatch(form.slice(form.indexOf("async function saveDraftNow"), form.indexOf("function cancel")), /validate\(/)
  const workspace = readFileSync("src/components/leadership-workflows/WorkflowWorkspace.tsx", "utf8")
  assert.match(workspace, /My drafts/)
  const server = readFileSync("src/lib/leadership-workflows/server.ts", "utf8")
  assert.match(server, /startsWith\("draft_"\)/)
})
