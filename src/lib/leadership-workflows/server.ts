import { randomUUID, createHash } from "node:crypto"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { LEADERSHIP_TEAMS } from "@/lib/admin/leadership"
import { formatEventDateTime } from "@/lib/events/calendar"
import {
  applyChange,
  canRead,
  createRequest,
  eventFieldsText,
  object,
  text,
  date,
  WorkflowError,
  type Activity,
  type BankEntry,
  type Bootstrap,
  type Cash,
  type EventFields,
  type EventOption,
  type Person,
  type WorkflowRequest
} from "./domain"
import { readCash, integrationReady } from "./integrations"

import { drainJobs } from "./worker"
import { isExcludedRequest } from "./request-exclusions"
import { mediaJobsFor, withMediaSlackChange } from "./slack-media"
type DB = ReturnType<typeof createAdminClient>
export type Context = {
  db: DB | null
  user: Person
  approverId: string
  demo: boolean
}
export const JUSTIN_ID = "a8be2531-9c64-4cd6-b1cd-1a12f8465609"
const MEMBER_ID = "11111111-1111-4111-8111-111111111111"
const DEMO_PEOPLE: Person[] = [
  {
    id: JUSTIN_ID,
    name: "Justin Cornetta",
    email: "justin@example.test",
    team: "Strategy and Operations"
  },
  {
    id: MEMBER_ID,
    name: "Alex Morgan",
    email: "alex@example.test",
    team: "Community"
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Agnes Horie",
    email: "agnes@example.test",
    team: "Media"
  }
]
type DemoState = {
  requests: WorkflowRequest[]
  activity: Activity[]
  bank: BankEntry[]
}
const demoPath = () => join(process.cwd(), "data", "leadership-demo.json")
let demoQueue: Promise<unknown> = Promise.resolve()
async function demoState(): Promise<DemoState> {
  try {
    return JSON.parse(await readFile(demoPath(), "utf8"))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { requests: [], activity: [], bank: [] }
    throw e
  }
}
async function demoWrite<T>(callback: (s: DemoState) => T): Promise<T> {
  const result = demoQueue.then(async () => {
    const s = await demoState()
    const value = callback(s)
    await mkdir(dirname(demoPath()), { recursive: true })
    await writeFile(demoPath(), JSON.stringify(s))
    return value
  })
  demoQueue = result.catch(() => {})
  return result
}
export function isDemo(request: Request) {
  const u = new URL(request.url)
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.LEADERSHIP_LOCAL_DEMO === "1" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  )
}
export function sameOrigin(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new WorkflowError("Cross-site request rejected.", 403)
  const origin = request.headers.get("origin")
  if (origin) {
    const expected = new URL(request.url)
    const host = request.headers.get("host")
    if (host) expected.host = host
    if (origin !== expected.origin)
      throw new WorkflowError("Cross-site request rejected.", 403)
  }
}
export async function context(request: Request): Promise<Context> {
  sameOrigin(request)
  if (isDemo(request))
    return {
      db: null,
      user: DEMO_PEOPLE[
        request.headers.get("x-workflow-demo-user") === "member" ? 1 : 0
      ],
      approverId: JUSTIN_ID,
      demo: true
    }
  const client = await createClient()
  const {
    data: { user },
    error
  } = await client.auth.getUser()
  if (error || !user) throw new WorkflowError("Sign in to continue.", 401)
  const { data: p, error: pe } = await client
    .from("profiles")
    .select("id, first_name, last_name, email, role, team, is_banned")
    .eq("id", user.id)
    .single()
  if (
    pe ||
    !p ||
    p.is_banned ||
    !(
      p.role === "superadmin" ||
      (p.role === "admin" &&
        (LEADERSHIP_TEAMS as readonly string[]).includes(p.team))
    )
  )
    throw new WorkflowError("Leadership access required.", 403)
  const db = createAdminClient()
  const { data: settings, error: se } = await db
    .from("leadership_workflow_settings")
    .select("expense_approver_id")
    .eq("singleton", true)
    .single()
  if (se || !settings)
    throw new WorkflowError(
      "Leadership workflows are awaiting database setup.",
      503
    )
  return {
    db,
    user: {
      id: user.id,
      name:
        [p.first_name, p.last_name].filter(Boolean).join(" ") || "IPN leader",
      email: p.email || user.email || "",
      team: p.team
    },
    approverId: settings.expense_approver_id,
    demo: false
  }
}
export async function readRequests(c: Context): Promise<WorkflowRequest[]> {
  if (c.demo)
    return (await demoState()).requests.filter((r) =>
      !r.deletedAt && canRead(r, c.user.id, c.approverId)
    )
  let q = c
    .db!.from("leadership_requests")
    .select("data")
    .order("created_at", { ascending: false })
    .limit(1000)
  if (c.user.id !== c.approverId)
    q = q.or(`kind.eq.media,requester_id.eq.${c.user.id}`)
  const { data, error } = await q
  if (error) throw new Error("Unable to load requests.")
  return (data ?? [])
    .map((row) => row.data as WorkflowRequest)
    .filter((r) => !r.deletedAt && !isExcludedRequest(r.id))
}
export async function readRequest(
  c: Context,
  id: string
): Promise<WorkflowRequest> {
  if (c.demo) {
    const r = (await demoState()).requests.find((r) => r.id === id)
    if (!r || r.deletedAt || !canRead(r, c.user.id, c.approverId))
      throw new WorkflowError("Request not found.", 404)
    return r
  }
  if (isExcludedRequest(id))
    throw new WorkflowError("Request not found.", 404)
  const { data, error } = await c
    .db!.from("leadership_requests")
    .select("data")
    .eq("id", id)
    .maybeSingle()
  if (error || !data || data.data.deletedAt || !canRead(data.data, c.user.id, c.approverId))
    throw new WorkflowError("Request not found.", 404)
  return data.data as WorkflowRequest
}
async function people(c: Context): Promise<Person[]> {
  if (c.demo) return DEMO_PEOPLE
  const { data, error } = await c
    .db!.from("profiles")
    .select("id, first_name, last_name, email, role, team, is_banned")
    .in("role", ["admin", "superadmin"])
  if (error) throw new Error("Unable to load leadership.")
  return (data ?? [])
    .filter(
      (p) =>
        !p.is_banned &&
        (p.role === "superadmin" ||
          (LEADERSHIP_TEAMS as readonly string[]).includes(p.team))
    )
    .map((p) => ({
      id: p.id,
      name:
        [p.first_name, p.last_name].filter(Boolean).join(" ") || "IPN leader",
      email: p.email || "",
      team: p.team
    }))
}
const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://members.intercollegiatepsychedelics.net"
const plain = (value: unknown) =>
  typeof value === "string" ? value.trim() : ""
function eventTime(startsAt: string, endsAt: unknown, timezone: unknown) {
  try {
    return formatEventDateTime(
      startsAt,
      plain(endsAt) || null,
      plain(timezone) || "America/New_York"
    )
  } catch {
    return startsAt
  }
}
// Shape an event or conference meetup for the media intake prefill.
function eventOption(e: {
  id: string
  title: string
  kind?: unknown
  startsAt: string
  endsAt?: unknown
  timezone?: unknown
  leader?: unknown
  howTo: unknown[]
  registrationUrl?: unknown
  description: unknown[]
}): EventOption {
  const fields: EventFields = {
    name: e.title,
    kind: plain(e.kind),
    time: eventTime(e.startsAt, e.endsAt, e.timezone),
    leader: plain(e.leader),
    howTo: [...new Set(e.howTo.map(plain).filter(Boolean))].join(" · "),
    registrationUrl: /^https:\/\//i.test(plain(e.registrationUrl))
      ? plain(e.registrationUrl)
      : ""
  }
  const description = [
    ...new Set(e.description.map(plain).filter(Boolean))
  ].join("\n\n")
  return {
    id: e.id,
    title: e.title,
    details: eventFieldsText(fields),
    fields,
    description,
    postedBy: e.startsAt.slice(0, 10)
  }
}
export async function bootstrap(c: Context): Promise<Bootstrap> {
  const requests = await readRequests(c)
  const roster = await people(c)
  let events: Bootstrap["events"] = [],
    activity: Activity[] = [],
    bankEntries: BankEntry[] = [],
    cash: Cash | null = null,
    pending = 0
  if (c.demo) {
    const s = await demoState()
    activity = s.activity.filter((a) =>
      requests.some((r) => r.id === a.requestId)
    )
    bankEntries = c.user.id === c.approverId ? s.bank : []
    events = [
      eventOption({
        id: "demo-event",
        title: "IPN Labs research seminar",
        kind: "IPN Labs",
        startsAt: "2026-10-20T22:00:00Z",
        timezone: "America/New_York",
        leader: "IPN Labs research team",
        howTo: ["Online", "Zoom link sent after registration"],
        registrationUrl: `${siteUrl()}/events/ipn-labs-research-seminar`,
        description: [
          "A walkthrough of current IPN Labs research and how members can get involved."
        ]
      })
    ]
    cash =
      c.user.id === c.approverId
        ? {
            relayCents: 100000,
            relayAsOf: "2026-09-29",
            reconsiderCents: 200000,
            reconsiderAsOf: "2026-09-29",
            reconsiderEstimated: true,
            source: "Demonstration using sample balances"
          }
        : null
    if (cash)
      for (const r of s.requests) {
        const e = r.expense
        if (!e?.paidDate || !e.actualAmountCents || e.paidDate <= "2026-09-29")
          continue
        if (e.account === "Relay") {
          cash.relayCents -= e.actualAmountCents
          cash.relayAsOf =
            cash.relayAsOf > e.paidDate ? cash.relayAsOf : e.paidDate
        }
        if (e.account === "Reconsider") {
          cash.reconsiderCents -= e.actualAmountCents
          cash.reconsiderAsOf =
            cash.reconsiderAsOf > e.paidDate ? cash.reconsiderAsOf : e.paidDate
        }
      }
  } else {
    const [eventRows, conferences, history, jobs, bank] = await Promise.all([
      c
        .db!.from("events")
        .select(
          "id,slug,title,event_type,starts_at,ends_at,timezone,summary,description,speakers,location_label,location_details,registration_url"
        )
        .eq("status", "published")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(200),
      c
        .db!.from("conferences")
        .select("id,timezone,meetups")
        .eq("status", "published")
        .limit(200),
      requests.length
        ? c
            .db!.from("leadership_request_activity")
            .select("*")
            .in(
              "request_id",
              requests.map((r) => r.id)
            )
            .order("created_at")
            .limit(2000)
        : Promise.resolve({ data: [] }),
      c
        .db!.from("leadership_integration_jobs")
        .select("id", { count: "exact", head: true })
        .neq("state", "done")
        .in(
          "request_id",
          requests.map((r) => r.id)
        ),
      c.user.id === c.approverId
        ? c
            .db!.from("leadership_bank_activity")
            .select("data")
            .order("imported_at", { ascending: false })
            .limit(1000)
        : Promise.resolve({ data: [] })
    ])
    if (eventRows.error || conferences.error)
      throw new Error("Unable to load events for media intake.")
    events = (eventRows.data ?? []).map((e) =>
      eventOption({
        id: e.id,
        title: e.title,
        kind: e.event_type,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        timezone: e.timezone,
        leader: e.speakers,
        howTo: [e.location_label, e.location_details],
        registrationUrl:
          e.registration_url ||
          (e.slug ? `${siteUrl()}/events/${encodeURIComponent(e.slug)}` : ""),
        description: [e.summary, e.description]
      })
    )
    for (const conf of conferences.data ?? [])
      for (const raw of Array.isArray(conf.meetups) ? conf.meetups : []) {
        const m = raw as Record<string, unknown>
        if (
          typeof m.id === "string" &&
          typeof m.title === "string" &&
          typeof m.startsAt === "string" &&
          m.startsAt >= new Date().toISOString()
        )
          events.push(
            eventOption({
              id: `conference:${conf.id}:${m.id}`,
              title: m.title,
              kind: m.type,
              startsAt: m.startsAt,
              endsAt: m.endsAt,
              timezone: conf.timezone,
              howTo: [m.location],
              registrationUrl: m.registrationUrl,
              description: [m.description]
            })
          )
      }
    activity = (history.data ?? []).map((a) => ({
      id: a.id,
      requestId: a.request_id,
      actorName: a.actor_name,
      event: a.event,
      note: a.note,
      createdAt: a.created_at
    }))
    bankEntries = (bank.data ?? []).map((b) => b.data as BankEntry)
    pending = jobs.count ?? 0
    if (c.user.id === c.approverId) cash = await readCash().catch(() => null)
  }
  return {
    user: c.user,
    approverId: c.approverId,
    people: roster,
    events,
    requests,
    activity,
    bankEntries,
    cash,
    demo: c.demo,
    integrations: { ...integrationReady(), pending }
  }
}
function jobsFor(
  r: WorkflowRequest,
  event: string,
  previous?: WorkflowRequest,
  note = ""
) {
  if (r.deletedAt) return []
  const jobs: { target: string; recipientId?: string }[] = []
  if (r.kind === "expense") {
    jobs.push({ target: "sheets" })
    if (event === "submitted" || (event === "edit" && r.status === "pending"))
      jobs.push({ target: "slack_expense" })
    else if (event !== "comment") {
      jobs.push({ target: "slack_expense" })
      jobs.push({ target: "slack_dm", recipientId: r.requesterId })
    }
  } else {
    jobs.push(...mediaJobsFor(r, event, previous, note))
  }
  return jobs
}
async function save(
  c: Context,
  r: WorkflowRequest,
  expected: number,
  event: string,
  note: string,
  previous?: WorkflowRequest
) {
  r = withMediaSlackChange(r, event, previous, note)
  if (c.demo)
    return demoWrite((s) => {
      const index = s.requests.findIndex((x) => x.id === r.id)
      if (index >= 0 && s.requests[index].revision !== expected)
        throw new WorkflowError("Request changed; reload before saving.", 409)
      if (index < 0 && expected !== 0)
        throw new WorkflowError("Request not found.", 404)
      if (index >= 0) s.requests[index] = r
      else s.requests.unshift(r)
      s.activity.push({
        id: randomUUID(),
        requestId: r.id,
        actorName: c.user.name,
        event,
        note,
        createdAt: new Date().toISOString()
      })
      return r
    })
  const { error } = await c.db!.rpc("leadership_save_request", {
    p_data: r,
    p_expected_revision: expected,
    p_actor: c.user.id,
    p_actor_name: c.user.name,
    p_event: event,
    p_note: note,
    p_jobs: jobsFor(r, event, previous, note)
  })
  if (error) {
    if (error.code === "40001" || error.code === "23505")
      throw new WorkflowError("Request changed; reload before saving.", 409)
    throw new Error("Unable to save the request.")
  }
  // Delivery failures stay in the durable outbox, never roll back a saved request.
  await drainJobs(c.db!, r.id)
  return r
}
export async function submit(c: Context, value: unknown) {
  const r = createRequest(value, c.user)
  return save(c, r, 0, "submitted", "")
}
export async function change(c: Context, id: string, value: unknown) {
  const current = await readRequest(c, id)
  const result = applyChange(
    current,
    value,
    c.user,
    c.approverId,
    await people(c)
  )
  if (result.event === "match") {
    const banks = c.demo
      ? (await demoState()).bank
      : ((
          await c.db!.from("leadership_bank_activity").select("data")
        ).data?.map((b) => b.data as BankEntry) ?? [])
    const entry = banks.find(
      (b) => b.id === result.record.expense!.bankTransactionId
    )
    const e = result.record.expense!
    if (
      !entry ||
      entry.amountCents !== -e.actualAmountCents! ||
      entry.account !== e.account
    )
      throw new WorkflowError(
        "Choose a bank entry with the same amount and payment account."
      )
    const matches = await readRequests(c)
    if (
      matches.some(
        (r) => r.id !== id && r.expense?.bankTransactionId === entry.id
      )
    )
      throw new WorkflowError("This bank entry is already matched.")
  }
  return save(c, result.record, current.revision, result.event, result.note, current)
}
export async function retry(c: Context) {
  if (c.user.id !== c.approverId)
    throw new WorkflowError("Only Justin can retry integrations.", 403)
  if (!c.demo) {
    await c
      .db!.from("leadership_integration_jobs")
      .update({ next_attempt_at: new Date().toISOString() })
      .eq("state", "pending")
    await drainJobs(c.db!)
  }
}
export async function resetDemo(c: Context) {
  if (!c.demo) throw new WorkflowError("Not found.", 404)
  await demoWrite((s) => {
    s.requests = []
    s.activity = []
    s.bank = []
  })
}
export async function importBank(c: Context, value: unknown) {
  if (c.user.id !== c.approverId)
    throw new WorkflowError("Only Justin imports bank activity.", 403)
  const v = object(value)
  const account = text(v.account, "Account", true)
  if (!["Relay", "Reconsider"].includes(account))
    throw new WorkflowError("Choose a payment account.")
  if (!Array.isArray(v.entries) || v.entries.length > 1000)
    throw new WorkflowError("Import at most 1,000 rows.")
  const entries: BankEntry[] = v.entries.map((raw) => {
    const row = object(raw)
    const day = date(row.date)
    const amount = Number(row.amountCents)
    if (!Number.isSafeInteger(amount) || amount === 0)
      throw new WorkflowError(
        "Bank amounts must be nonzero signed USD amounts."
      )
    const description = text(row.description, "Description", true, 500)
    const sourceId = text(row.sourceId, "Source transaction ID", false, 100)
    const id = createHash("sha256")
      .update(JSON.stringify([account, sourceId || [day, amount, description]]))
      .digest("hex")
    return { id, date: day, amountCents: amount, description, account }
  })
  if (c.demo)
    await demoWrite((s) => {
      for (const entry of entries)
        if (!s.bank.some((b) => b.id === entry.id)) s.bank.push(entry)
    })
  else {
    const { error } = await c.db!.from("leadership_bank_activity").upsert(
      entries.map((e) => ({ id: e.id, data: e, imported_by: c.user.id })),
      { onConflict: "id", ignoreDuplicates: true }
    )
    if (error) throw new Error("Unable to import bank activity.")
  }
  return { count: entries.length }
}
export async function api(
  request: Request,
  callback: (c: Context) => Promise<unknown>
) {
  try {
    const c = await context(request)
    const data = await callback(c)
    return Response.json(
      { ok: true, data },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (e) {
    const status = e instanceof WorkflowError ? e.status : 500
    if (status === 500)
      console.error(
        "Leadership workflow request failed",
        e instanceof Error ? e.message : e
      )
    return Response.json(
      {
        ok: false,
        error:
          e instanceof WorkflowError
            ? e.message
            : "Unable to complete this request. Please try again."
      },
      { status }
    )
  }
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 100_000)
    throw new WorkflowError("Request is too large.", 413)
  const raw = await request.text()
  if (raw.length > 100_000)
    throw new WorkflowError("Request is too large.", 413)
  try {
    return JSON.parse(raw)
  } catch {
    throw new WorkflowError("Invalid request details.")
  }
}
