import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"
import * as exclusions from "../src/lib/leadership-workflows/request-exclusions.ts"

test("quarantined preview purchases cannot reach Slack or the ledger while real jobs still deliver", async () => {
  const previous = process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
  process.env.WORKFLOW_EXCLUDED_REQUEST_IDS = "simulated"
  try {
    const updates = [], claimed = [], delivered = []
    const db = {
      from() {
        let update, id
        const q = {
          select() { return q }, neq() { return q }, lte() { return q }, order() { return q }, limit() { return q },
          update(value) { update = value; return q },
          eq(_, value) { id = value; return q },
          then(resolve) {
            if (update) { updates.push({ id, ...update }); return Promise.resolve({}).then(resolve) }
            return Promise.resolve({ data: [{ id: "fake-payment", request_id: "simulated" }, { id: "real-notification", request_id: "real" }] }).then(resolve)
          }
        }
        return q
      },
      async rpc(_, args) {
        claimed.push(args.p_id)
        return { data: [{ id: args.p_id, request_id: "real", target: "slack_media" }] }
      }
    }
    const mockModule = { exports: {} }
    const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/leadership-workflows/worker.ts", import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    new Function("require", "module", "exports", compiled)((path) => {
      if (path === "./request-exclusions") return exclusions
      if (path === "./integrations") return { deliverJob: async (_, job) => { delivered.push(job.id); return { delivered: true } } }
      throw new Error(`Unexpected import: ${path}`)
    }, mockModule, mockModule.exports)
    await mockModule.exports.drainJobs(db)
    assert.deepEqual(claimed, ["real-notification"])
    assert.deepEqual(delivered, ["real-notification"])
    assert.equal(updates.find((x) => x.id === "fake-payment").state, "done")
    assert.match(updates.find((x) => x.id === "fake-payment").result.skipped, /Simulated request/)
  } finally {
    if (previous === undefined) delete process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
    else process.env.WORKFLOW_EXCLUDED_REQUEST_IDS = previous
  }
})


test("queued notifications for deleted media skip delivery even with an older job payload", async () => {
  const mockModule = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/leadership-workflows/integrations.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  new Function("require", "module", "exports", compiled)((path) => {
    if (path === "node:crypto") return {}
    if (path === "./domain" || path === "./slack-signature") return {}
    throw new Error(`Unexpected import: ${path}`)
  }, mockModule, mockModule.exports)
  const db = { from() {
    const q = { select() { return q }, eq() { return q }, async single() {
      return { data: { data: { id: "deleted", kind: "media", deletedAt: "2026-10-06T12:00:00Z" } } }
    } }
    return q
  } }
  for (const target of ["slack_media", "slack_dm"]) {
    assert.deepEqual(await mockModule.exports.deliverJob(db, { request_id: "deleted", target, payload: { status: "submitted" } }), { skipped: "Request deleted" })
  }
})
