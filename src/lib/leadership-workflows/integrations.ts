import { createSign } from "node:crypto"
import type { createAdminClient } from "@/lib/supabase/admin"
import {
  projectedCash,
  STATUS_LABELS,
  usd,
  WorkflowError,
  type Cash,
  type WorkflowRequest
} from "./domain"
import type { IntegrationJob } from "./worker"
type DB = ReturnType<typeof createAdminClient>
export const FINANCE_SHEET_ID = "1hG9oRgo19vH9HH54kYIWDy8YeJaQdUtNJdJAARpfnmE"
export const DIRECTOR_SLACK_ID = "U0C5PPBBEK1"
export const APPROVER_SLACK_ID = "U061Z7YC3DX"
const site = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://members.intercollegiatepsychedelics.net"
export function requestUrl(r: WorkflowRequest) {
  return `${site()}/dashboard/admin/${r.kind === "media" ? "media" : "expenses"}?request=${encodeURIComponent(r.id)}`
}
export function integrationReady() {
  return {
    slack:
      process.env.WORKFLOW_INTEGRATION_MODE === "live" &&
      !!process.env.WORKFLOW_SLACK_BOT_TOKEN,
    sheets:
      process.env.WORKFLOW_INTEGRATION_MODE === "live" &&
      !!(
        process.env.WORKFLOW_GOOGLE_CLIENT_EMAIL &&
        process.env.WORKFLOW_GOOGLE_PRIVATE_KEY
      )
  }
}
export { verifySlack } from "./slack-signature"
export async function slack(method: string, body: unknown) {
  const token = process.env.WORKFLOW_SLACK_BOT_TOKEN
  if (!integrationReady().slack) throw new Error("Slack bot setup is pending.")
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2000)
  })
  const result = await response.json()
  if (!response.ok || !result.ok)
    throw new Error(`Slack delivery failed: ${result.error || response.status}`)
  return result
}
const escapeSlack = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
export async function expenseMessage(
  r: WorkflowRequest,
  cash: Cash | null,
  records: WorkflowRequest[]
) {
  const e = r.expense!
  const fields = [
    `*Submitter*\n${escapeSlack(r.requesterName)}`,
    `*Cost*\n${usd(e.amountCents)}`,
    `*Expense*\n${escapeSlack(r.title)}`,
    `*Status*\n${STATUS_LABELS[r.status]}`
  ]
  let balances =
    "Cash projection unavailable until the finance tracker is connected."
  if (cash) {
    const p = projectedCash(cash, records, r)
    balances = `Recorded Relay cash as of ${cash.relayAsOf}: *${usd(cash.relayCents)}*\nAfter this proposed purchase: *${usd(p.afterRequest)}*\nAfter this and other approved unpaid commitments: *${usd(p.afterCommitments)}*\nReconsider-held funds${cash.reconsiderEstimated ? " (estimated)" : ""} as of ${cash.reconsiderAsOf}: ${usd(cash.reconsiderCents)}`
  }
  const actions: Record<string, unknown>[] = [
    {
      type: "button",
      text: { type: "plain_text", text: "Open in Portal" },
      url: requestUrl(r)
    }
  ]
  if (r.status === "pending")
    actions.unshift(
      {
        type: "button",
        text: { type: "plain_text", text: "Approve" },
        style: "primary",
        action_id: "ipn_expense_approve",
        value: `${r.id}:${r.revision}`
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Reject" },
        style: "danger",
        action_id: "ipn_expense_reject",
        value: `${r.id}:${r.revision}`
      }
    )
  return {
    text: `Expense ${STATUS_LABELS[r.status]}: ${r.title} (${usd(e.amountCents)})`,
    parse: "none",
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<@${APPROVER_SLACK_ID}> · Expense submission`
        }
      },
      {
        type: "section",
        fields: fields.map((text) => ({ type: "mrkdwn", text }))
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Purpose*\n${escapeSlack(e.purpose).slice(0, 2500)}${e.itemUrl ? `\n<${e.itemUrl}|Item / expense link>` : ""}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            r.status === "pending"
              ? balances
              : "The status is updated in the portal and tracker."
        }
      },
      { type: "actions", elements: actions }
    ]
  }
}
let googleToken: { value: string; expires: number } | null = null
async function googleAuth() {
  if (googleToken && googleToken.expires > Date.now() + 60_000)
    return googleToken.value
  const email = process.env.WORKFLOW_GOOGLE_CLIENT_EMAIL,
    key = process.env.WORKFLOW_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!email || !key)
    throw new Error("Google Sheets service account setup is pending.")
  const now = Math.floor(Date.now() / 1000)
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url")
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: email, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key, "base64url")
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`
    }),
    signal: AbortSignal.timeout(10000)
  })
  const data = await response.json()
  if (!response.ok || !data.access_token)
    throw new Error("Unable to authenticate Google Sheets service account.")
  googleToken = {
    value: data.access_token,
    expires: Date.now() + Number(data.expires_in) * 1000
  }
  return googleToken.value
}
async function sheets(path: string, method = "GET", body?: unknown) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.WORKFLOW_FINANCE_SHEET_ID || FINANCE_SHEET_ID}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${await googleAuth()}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000)
    }
  )
  if (!response.ok)
    throw new Error(`Finance tracker request failed (${response.status}).`)
  return response.json()
}
async function values(range: string) {
  return (await sheets(`values/${encodeURIComponent(range)}`)).values ?? []
}
function serial(day: string | undefined) {
  if (!day) return ""
  return (
    (Date.parse(day.slice(0, 10) + "T00:00:00Z") - Date.UTC(1899, 11, 30)) /
    86400000
  )
}
function fromSerial(value: unknown) {
  if (typeof value === "number")
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000)
      .toISOString()
      .slice(0, 10)
  const s = String(value || "")
  const parsed = new Date(s)
  return Number.isNaN(parsed.getTime()) ? s : parsed.toISOString().slice(0, 10)
}
export async function readCash(): Promise<Cash | null> {
  if (!integrationReady().sheets) return null
  const rows = await values("Accounts!A5:F20")
  const relay = rows.find(
    (r: unknown[]) => r[0] === "Relay Financial" || r[0] === "Relay"
  )
  const held = rows.find(
    (r: unknown[]) =>
      r[0] === "Reconsider-held funds" ||
      r[0] === "Estimated current Reconsider funds"
  )
  const money = (v: unknown) =>
    Math.round(Number(String(v).replace(/[^\d.-]/g, "")) * 100)
  if (
    !relay ||
    !held ||
    !Number.isFinite(money(relay[1])) ||
    !Number.isFinite(money(held[1]))
  )
    throw new Error("Finance account balances are unavailable.")
  return {
    relayCents: money(relay[1]),
    relayAsOf: fromSerial(relay[2]),
    reconsiderCents: money(held[1]),
    reconsiderAsOf: fromSerial(held[2]),
    reconsiderEstimated: true,
    source: "IPN Finance Dashboard & Forecast"
  }
}
async function rowFor(tab: string, column: string, id: string) {
  const ids = await values(`'${tab}'!${column}6:${column}1000`)
  const index = ids.findIndex((r: unknown[]) => r[0] === id)
  if (index >= 0) return index + 6
  const occupied = column === "A" ? ids : await values(`'${tab}'!A6:A1000`)
  const row = occupied.length + 6
  if (row > 1000)
    throw new Error(`${tab} needs more rows before sync can continue.`)
  return row
}
export async function syncExpense(r: WorkflowRequest) {
  const e = r.expense!
  const approved =
    !!e.approvedAt && !["pending", "rejected", "cancelled"].includes(r.status)
  const row = await rowFor("Expense Requests", "A", r.id)
  const data = [
    r.id,
    r.submittedAt,
    r.requesterName,
    r.title,
    e.purpose,
    e.amountCents / 100,
    e.itemUrl,
    approved
      ? "Approved"
      : r.status === "rejected"
        ? "Rejected"
        : r.status === "cancelled"
          ? "Cancelled"
          : "Pending",
    e.approvedBy || "",
    e.approvedAt || "",
    e.expectedMonth ? serial(e.expectedMonth + "-01") : "",
    STATUS_LABELS[r.status],
    e.actualAmountCents ? e.actualAmountCents / 100 : "",
    serial(e.purchaseDate),
    e.account || "",
    serial(e.paidDate),
    e.receiptUrl,
    requestUrl(r),
    r.updatedAt,
    e.bankTransactionId || "",
    r.revision
  ]
  const updates = [
    { range: `'Expense Requests'!A${row}:U${row}`, values: [data] }
  ]
  if (["purchased", "reimbursed"].includes(r.status)) {
    const tx = await rowFor("Transactions", "J", r.id)
    const existing = await values(`Transactions!A${tx}:L${tx}`)
    const old = existing[0] ?? []
    const txn = [
      serial(e.paidDate),
      e.account,
      r.title,
      -e.actualAmountCents! / 100,
      "Expense",
      old[5] || "Uncategorized / Review",
      old[6] || "No",
      old[7] || "Needs review",
      old[8] || `Portal request ${r.id}`,
      r.id,
      e.receiptUrl,
      e.bankTransactionId || ""
    ]
    updates.push({ range: `Transactions!A${tx}:L${tx}`, values: [txn] })
  }
  await sheets("values:batchUpdate", "POST", {
    valueInputOption: "RAW",
    data: updates
  })
  return { requestRow: row }
}
export async function deliverJob(db: DB, job: IntegrationJob) {
  const { data: stored } = await db
    .from("leadership_requests")
    .select("data")
    .eq("id", job.request_id)
    .single()
  if (!stored) throw new Error("Request is no longer available.")
  const r = stored.data as WorkflowRequest
  if (r.deletedAt) return { skipped: "Request deleted" }
  if (job.target === "sheets") return syncExpense(r)
  if (job.target === "slack_expense") {
    const channel = process.env.WORKFLOW_EXPENSE_SLACK_CHANNEL_ID
    if (!channel) throw new Error("Expense Slack channel setup is pending.")
    const { data: all } = await db
      .from("leadership_requests")
      .select("data")
      .eq("kind", "expense")
    const message = await expenseMessage(
      r,
      await readCash(),
      (all ?? []).map((a) => a.data as WorkflowRequest)
    )
    const result = await slack("chat.postMessage", {
      channel,
      client_msg_id: job.id,
      ...message
    })
    return { channel: result.channel, ts: result.ts }
  }
  if (job.target === "slack_media") {
    const m = r.media!
    const channel = process.env.WORKFLOW_MEDIA_SLACK_CHANNEL_ID || "C088ZJBM0QY"
    const destination = m.destinationUrl
      ? `\n*Link to include:* ${escapeSlack(m.destinationUrl)}\n*Where:* ${escapeSlack(m.linkPlacement || "")}`
      : ""
    const message = `${m.urgent ? "🚩 URGENT · " : ""}<@${DIRECTOR_SLACK_ID}> · ${job.event === "submitted" ? "New media request" : STATUS_LABELS[r.status]}\n*${escapeSlack(r.title)}* · ${escapeSlack(m.team)}\nFrom ${escapeSlack(r.requesterName)} · Post by ${m.postedBy}\n${escapeSlack(m.brief).slice(0, 1800)}${destination}\n<${requestUrl(r)}|Open request>`
    const result = await slack("chat.postMessage", {
      channel,
      text: message,
      parse: "none",
      unfurl_links: false,
      client_msg_id: job.id
    })
    return { channel: result.channel, ts: result.ts }
  }
  const { data: settings } = await db
    .from("leadership_workflow_settings")
    .select("slack_user_ids")
    .eq("singleton", true)
    .single()
  let userId = settings?.slack_user_ids?.[job.recipient_id!]
  if (!userId) {
    const { data: p } = await db
      .from("profiles")
      .select("email")
      .eq("id", job.recipient_id!)
      .single()
    if (!p?.email) throw new Error("Submitter has no Slack email mapping.")
    const lookup = await slack("users.lookupByEmail", { email: p.email })
    userId = lookup.user.id
  }
  const opened = await slack("conversations.open", { users: userId })
  const message =
    r.kind === "expense"
      ? `Your expense request “${escapeSlack(r.title)}” is now *${STATUS_LABELS[r.status]}*.\n${usd(r.expense!.amountCents)} · <${requestUrl(r)}|View details and review notes>`
      : `Media request “${escapeSlack(r.title)}” needs your attention: *${STATUS_LABELS[r.status]}*.\n<${requestUrl(r)}|View assignment and notes>`
  const result = await slack("chat.postMessage", {
    channel: opened.channel.id,
    text: message,
    parse: "none",
    unfurl_links: false,
    client_msg_id: job.id
  })
  return { channel: result.channel, ts: result.ts }
}
export function parseSlackAction(raw: string) {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(new URLSearchParams(raw).get("payload") || "")
  } catch {
    throw new WorkflowError("Invalid Slack payload.")
  }
  return payload
}
