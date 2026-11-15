import test from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync, createSign } from "node:crypto"
import { readFileSync } from "node:fs"
import ts from "typescript"
import * as domain from "../src/lib/leadership-workflows/domain.ts"

function loadSyncExpense() {
  const mockModule = { exports: {} }
  const compiled = ts.transpileModule(
    readFileSync(new URL("../src/lib/leadership-workflows/integrations.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText
  new Function("require", "module", "exports", compiled)((path) => {
    if (path === "node:crypto") return { createSign }
    if (path === "./domain") return domain
    if (path === "./slack-media") return { DIRECTOR_SLACK_ID: "director" }
    if (path === "./slack-signature") return { verifySlack() {} }
    throw new Error(`Unexpected import: ${path}`)
  }, mockModule, mockModule.exports)
  return mockModule.exports.syncExpense
}

const syncExpense = loadSyncExpense()

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const TEST_KEY = privateKey.export({ type: "pkcs1", format: "pem" })
const REQUEST_ID = "303efb5d-7fa2-43eb-b151-234779cb62d5"

function expense(status) {
  return {
    id: REQUEST_ID,
    kind: "expense",
    requesterId: "leader",
    requesterName: "Justin Cornetta",
    requesterEmail: "justin@example.test",
    title: "Reimbursement for past operating expenses",
    status,
    revision: 4,
    submittedAt: "2026-10-08T16:08:44.419Z",
    updatedAt: "2026-11-15T15:00:00.000Z",
    expense: {
      purpose: "Past operating expenses",
      amountCents: 31796,
      itemUrl: "",
      expectedMonth: "2026-10",
      approvedBy: "leader",
      approvedAt: "2026-10-08T16:08:53.698Z",
      approvedAmountCents: 31796,
      paymentMethod: status === "reimbursed" ? "personal" : "ipn_card",
      actualAmountCents: 31796,
      purchaseDate: "2026-10-08",
      paidDate: "2026-10-08",
      account: "Relay",
      receiptUrl: "https://drive.google.com/file/test"
    }
  }
}

async function syncWithSheet(request, existingIds = [[REQUEST_ID]]) {
  const previous = {
    email: process.env.WORKFLOW_GOOGLE_CLIENT_EMAIL,
    key: process.env.WORKFLOW_GOOGLE_PRIVATE_KEY
  }
  process.env.WORKFLOW_GOOGLE_CLIENT_EMAIL = "sheets-test@example.test"
  process.env.WORKFLOW_GOOGLE_PRIVATE_KEY = TEST_KEY
  const reads = []
  const writes = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url)
    if (href.includes("oauth2.googleapis.com/token")) {
      return {
        ok: true,
        json: async () => ({ access_token: "test-token", expires_in: 3600 })
      }
    }
    if (href.includes("Transactions")) {
      throw new Error(`Transactions tab should not be read or written: ${href}`)
    }
    const body = options.body ? JSON.parse(options.body) : null
    if (body && JSON.stringify(body).includes("Transactions")) {
      throw new Error("Transactions tab should not appear in a sheet write.")
    }
    if (href.includes("/values/") && (options.method || "GET") === "GET") {
      reads.push(decodeURIComponent(href.split("/values/")[1]))
      return { ok: true, json: async () => ({ values: existingIds }) }
    }
    if (href.endsWith("/values:batchUpdate") && options.method === "POST") {
      writes.push(body)
      return { ok: true, json: async () => ({}) }
    }
    throw new Error(`Unexpected request: ${options.method || "GET"} ${href}`)
  }
  try {
    const result = await syncExpense(request)
    return { result, reads, writes }
  } finally {
    globalThis.fetch = originalFetch
    if (previous.email === undefined) delete process.env.WORKFLOW_GOOGLE_CLIENT_EMAIL
    else process.env.WORKFLOW_GOOGLE_CLIENT_EMAIL = previous.email
    if (previous.key === undefined) delete process.env.WORKFLOW_GOOGLE_PRIVATE_KEY
    else process.env.WORKFLOW_GOOGLE_PRIVATE_KEY = previous.key
  }
}

function assertExpenseRequestsWrite(session, statusLabel, row = 6) {
  assert.deepEqual(session.reads, ["'Expense Requests'!A6:A1000"])
  assert.equal(session.writes.length, 1)
  const write = session.writes[0]
  assert.equal(write.valueInputOption, "RAW")
  assert.equal(write.data.length, 1)
  assert.equal(write.data[0].range, `'Expense Requests'!A${row}:U${row}`)
  const values = write.data[0].values[0]
  assert.equal(values[0], REQUEST_ID)
  assert.equal(values[11], statusLabel)
  assert.equal(values[12], 317.96)
  assert.equal(values[14], "Relay")
}

test("purchased requests update Expense Requests and do not touch Transactions", async () => {
  const session = await syncWithSheet(expense("purchased"))
  assert.equal(session.result.requestRow, 6)
  assertExpenseRequestsWrite(session, "Purchased")
})

test("reimbursed requests update Expense Requests and do not touch Transactions", async () => {
  const session = await syncWithSheet(expense("reimbursed"))
  assert.equal(session.result.requestRow, 6)
  assertExpenseRequestsWrite(session, "Reimbursed")
})

test("a new expense still appends one Expense Requests row and skips Transactions", async () => {
  const session = await syncWithSheet(expense("purchased"), [["existing-row"]])
  assert.equal(session.result.requestRow, 7)
  assertExpenseRequestsWrite(session, "Purchased", 7)
})
