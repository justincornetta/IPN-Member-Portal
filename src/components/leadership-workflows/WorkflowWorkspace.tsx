"use client"
import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode
} from "react"
import {
  EXPENSE_STATUSES,
  MEDIA_STATUSES,
  STATUS_LABELS,
  mediaNextStatuses,
  usd,
  unpaidCents,
  type Bootstrap,
  type Deliverable,
  type Kind,
  type MediaBrief,
  type Person,
  type WorkflowRequest
} from "@/lib/leadership-workflows/domain"

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/15"
const primary =
  "rounded-lg bg-ipn px-4 py-2.5 text-sm font-medium text-white hover:bg-ipn-dark disabled:opacity-50"
const secondary =
  "rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
const emptyMedia: MediaBrief = {
  type: "announcement",
  team: "",
  brief: "",
  postedBy: "",
  urgent: false,
  platforms: ["Media to advise"],
  format: "Media to advise",
  needsCopyHelp: false,
  headline: "",
  body: "",
  caption: "",
  links: [],
  eventId: "",
  eventDetails: "",
  deliverables: [],
  productionOwnerId: "",
  publisherId: ""
}
function Field({
  label,
  children,
  hint
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const fieldId = useId()
  return (
    <label
      htmlFor={fieldId}
      className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-zinc-700"
    >
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ id?: string; "aria-label"?: string }>,
            {
              id: fieldId,
              "aria-label": label
            }
          )
        : children}
      {hint && (
        <span className="text-xs font-normal text-zinc-500">{hint}</span>
      )}
    </label>
  )
}
function Badge({ record }: { record: WorkflowRequest }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${["posted", "purchased", "reimbursed"].includes(record.status) ? "bg-emerald-50 text-emerald-800" : record.status === "rejected" || record.status === "cancelled" ? "bg-zinc-100 text-zinc-600" : "bg-ipn-light text-ipn"}`}
    >
      {STATUS_LABELS[record.status]}
    </span>
  )
}
type Save = (body: Record<string, unknown>) => Promise<void>
export default function WorkflowWorkspace({
  kind,
  demo = false
}: {
  kind: Kind
  demo?: boolean
}) {
  const [data, setData] = useState<Bootstrap | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState(""),
    [demoUser, setDemoUser] = useState("approver"),
    [expenseTab, setExpenseTab] = useState("requests")
  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...(demo ? { "x-workflow-demo-user": demoUser } : {})
    }),
    [demo, demoUser]
  )
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/workflows", {
        headers: headers(),
        cache: "no-store"
      })
      const result = await response.json()
      if (!result.ok) throw new Error(result.error)
      setData(result.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load requests.")
    }
  }, [headers])
  useEffect(() => {
    let alive = true
    fetch("/api/admin/workflows", { headers: headers(), cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        if (alive) {
          if (!r.ok) throw new Error(r.error)
          setData(r.data)
          setError("")
          setSelected(
            new URLSearchParams(window.location.search).get("request") || ""
          )
        }
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [headers])
  const save: Save = async (body) => {
    setBusy(true)
    setError("")
    try {
      const response = await fetch(
        selected && !creating
          ? `/api/admin/workflows/${selected}`
          : "/api/admin/workflows",
        {
          method: selected && !creating ? "PATCH" : "POST",
          headers: headers(),
          body: JSON.stringify(body)
        }
      )
      const result = await response.json()
      if (!result.ok) throw new Error(result.error)
      if (result.data?.id) {
        setSelected(result.data.id)
        if (kind === "expense")
          setExpenseTab(
            [
              "approved",
              "awaiting_reimbursement",
              "purchased",
              "reimbursed"
            ].includes(result.data.status)
              ? "approved"
              : "requests"
          )
      }
      setCreating(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.")
      throw e
    } finally {
      setBusy(false)
    }
  }
  const extra: Save = async (body) => {
    setBusy(true)
    setError("")
    try {
      const r = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body)
      })
      const result = await r.json()
      if (!result.ok) throw new Error(result.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete action.")
    } finally {
      setBusy(false)
    }
  }
  const records = (data?.requests ?? []).filter((r) => r.kind === kind),
    current = records.find((r) => r.id === selected),
    isApprover = data?.user.id === data?.approverId
  const visible = records.filter(
    (r) =>
      (kind !== "expense" ||
        [
          "approved",
          "awaiting_reimbursement",
          "purchased",
          "reimbursed"
        ].includes(r.status) ===
          (expenseTab === "approved")) &&
      (!filter || r.status === filter) &&
      (!search ||
        [r.title, r.requesterName, r.media?.team, r.expense?.purpose]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()))
  )
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 text-zinc-900 sm:p-8">
      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span>
            Local preview · no sign-in needed · sample people · notifications and tracker writes
            disabled
          </span>
          <label className="flex items-center gap-2">
            Preview as
            <select
              aria-label="Preview as"
              disabled={busy}
              className={input}
              value={demoUser}
              onChange={(e) => {
                setDemoUser(e.target.value)
                setData(null)
                setSelected("")
                setCreating(false)
              }}
            >
              <option value="approver">Justin</option>
              <option value="member">Leadership member</option>
            </select>
          </label>
        </div>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ipn">
            IPN leadership
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {kind === "media" ? "Media Requests" : "Expense Submissions"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            {kind === "media"
              ? "Share a brief, coordinate production, and follow each deliverable through posting."
              : isApprover
                ? "Review requests, record purchases, and reconcile payments."
                : "Get approval before spending, then keep the receipt with your request."}
          </p>
        </div>
        <button
          className={primary}
          disabled={!data || busy}
          onClick={() => {
            setCreating(true)
            setSelected("")
            setError("")
          }}
        >
          {kind === "media" ? "New media request" : "Submit expense"}
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {!data && !error && (
        <p role="status" className="text-sm text-zinc-500">
          Loading requests…
        </p>
      )}
      {data && kind === "expense" && isApprover && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            title="Recorded Relay cash"
            value={data.cash ? usd(data.cash.relayCents) : "Not connected"}
            note={
              data.cash
                ? `As of ${data.cash.relayAsOf}`
                : "Connect the finance tracker to show dated balances."
            }
          />
          <Stat
            title="Approved unpaid commitments"
            value={usd(records.reduce((n, r) => n + unpaidCents(r), 0))}
            note={`${records.filter((r) => unpaidCents(r) && !r.expense?.expectedMonth).length} without an expected spending month`}
          />
          <Stat
            title="Reconsider-held funds"
            value={data.cash ? usd(data.cash.reconsiderCents) : "Not connected"}
            note={
              data.cash
                ? `Estimated · as of ${data.cash.reconsiderAsOf}`
                : "Tracked separately from Relay cash."
            }
          />
        </div>
      )}
      {data && kind === "expense" && (
        <nav
          aria-label="Expense views"
          className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3"
        >
          {[
            { id: "requests", label: "Requests" },
            { id: "approved", label: "Approved expenses" }
          ].map((tab) => (
            <button
              key={tab.id}
              disabled={busy}
              aria-pressed={expenseTab === tab.id}
              className={expenseTab === tab.id ? primary : secondary}
              onClick={() => {
                setExpenseTab(tab.id)
                setSelected("")
                setCreating(false)
                setFilter("")
              }}
            >
              {tab.label}
            </button>
          ))}
          <p className="basis-full text-xs text-zinc-500">
            Approved requests are commitments. Only completed IPN payments
            reduce recorded cash and appear in Transactions.
          </p>
        </nav>
      )}
      {creating && data ? (
        <RequestForm
          key={`new-${kind}`}
          kind={kind}
          data={data}
          busy={busy}
          save={save}
          close={() => setCreating(false)}
        />
      ) : current && data ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge record={current} />
              <h2 className="mt-3 text-xl font-semibold">{current.title}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {current.requesterName} · Submitted{" "}
                {current.submittedAt.slice(0, 10)} ·{" "}
                {current.kind === "media"
                  ? `Post by ${current.media!.postedBy}`
                  : usd(current.expense!.amountCents)}
              </p>
            </div>
            <button
              className={secondary}
              onClick={() => {
                setSelected("")
                setError("")
              }}
            >
              Back to queue
            </button>
          </div>
          <RequestDetail
            key={`${current.id}:${current.revision}`}
            record={current}
            data={data}
            busy={busy}
            save={save}
          />
        </section>
      ) : (
        <section aria-label="Request queue" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <input
              aria-label="Search requests"
              placeholder="Search requests…"
              className={`${input} max-w-sm`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter by status"
              className={`${input} max-w-xs`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {(kind === "media" ? MEDIA_STATUSES : EXPENSE_STATUSES).map(
                (s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                )
              )}
            </select>
            <button className={secondary} onClick={() => void load()}>
              Refresh
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelected(r.id)
                  setError("")
                }}
                className="rounded-xl border border-zinc-200 bg-white p-5 text-left transition hover:border-ipn/50 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge record={r} />
                  {r.media?.urgent && (
                    <span className="text-xs font-semibold text-amber-700">
                      Urgent
                    </span>
                  )}
                </div>
                <h2 className="mt-3 font-semibold">{r.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {r.requesterName}
                  {r.media
                    ? ` · ${r.media.team}`
                    : ` · ${usd(r.expense!.amountCents)}`}
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  {r.media
                    ? `Post by ${r.media.postedBy} · ${r.media.deliverables.filter((d) => d.status === "posted").length}/${r.media.deliverables.length} deliverables posted`
                    : `Submitted ${r.submittedAt.slice(0, 10)}`}
                </p>
              </button>
            ))}
          </div>
          {data && visible.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
              <p className="font-medium">
                {records.length ? "No matching requests" : "No requests yet"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {kind === "media"
                  ? "Start with an idea or an upcoming event."
                  : "Submit an expense before making the purchase."}
              </p>
            </div>
          )}
        </section>
      )}
      {data && kind === "expense" && isApprover && !creating && !current && (
        <BankImport data={data} busy={busy} save={extra} />
      )}
      {data && isApprover && !demo && (
        <details className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            Integration status
          </summary>
          <p className="mt-3 text-zinc-600">
            Slack: {data.integrations.slack ? "Configured" : "Awaiting setup"} ·
            Finance tracker:{" "}
            {data.integrations.sheets ? "Configured" : "Awaiting setup"} ·
            Pending deliveries: {data.integrations.pending}
          </p>
          <button
            className={`${secondary} mt-3`}
            disabled={busy}
            onClick={() => void extra({ action: "retry" })}
          >
            Retry pending deliveries
          </button>
        </details>
      )}
    </main>
  )
}
function Stat({
  title,
  value,
  note
}: {
  title: string
  value: string
  note: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{note}</p>
    </div>
  )
}
function RequestForm({
  kind,
  data,
  busy,
  save,
  close,
  record
}: {
  kind: Kind
  data: Bootstrap
  busy: boolean
  save: Save
  close: () => void
  record?: WorkflowRequest
}) {
  const [id] = useState(() => record?.id || crypto.randomUUID()),
    [title, setTitle] = useState(record?.title || ""),
    [media, setMedia] = useState<MediaBrief>(
      record?.media || { ...emptyMedia, team: data.user.team || "" }
    ),
    [links, setLinks] = useState(
      record?.media?.links.map((l) => l.url).join("\n") || ""
    ),
    [purpose, setPurpose] = useState(record?.expense?.purpose || ""),
    [amount, setAmount] = useState(
      record?.expense ? String(record.expense.amountCents / 100) : ""
    ),
    [itemUrl, setItemUrl] = useState(record?.expense?.itemUrl || "")
  const m = (patch: Partial<MediaBrief>) =>
    setMedia((previous) => ({ ...previous, ...patch }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await save({
        id,
        kind,
        title,
        ...(record ? { action: "edit", revision: record.revision } : {}),
        ...(kind === "media"
          ? {
              media: {
                ...media,
                links: links
                  .split(/\n/)
                  .map((url) => ({
                    label: "Supporting material",
                    url: url.trim()
                  }))
                  .filter((l) => l.url)
              }
            }
          : { expense: { purpose, amountCents: amount, itemUrl } })
      })
    } catch {}
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6"
    >
      <h2 className="mb-5 text-lg font-semibold">
        {record
          ? "Edit request"
          : kind === "media"
            ? "New media brief"
            : "Request approval before spending"}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Submitter">
          <input
            className={`${input} bg-zinc-50`}
            value={record?.requesterName || data.user.name}
            readOnly
          />
        </Field>
        <Field label={kind === "media" ? "Idea name" : "Expense"}>
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={180}
          />
        </Field>
        {kind === "expense" ? (
          <>
            <div className="sm:col-span-2">
              <Field label="Purpose">
                <textarea
                  className={input}
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Cost (USD)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={input}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field
              label="Link to item / expense"
              hint="Optional if there is no purchase page."
            >
              <input
                type="url"
                className={input}
                value={itemUrl}
                onChange={(e) => setItemUrl(e.target.value)}
                placeholder="https://…"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Request type">
              <select
                className={input}
                value={media.type}
                onChange={(e) =>
                  m({
                    type: e.target.value as MediaBrief["type"],
                    eventId: "",
                    eventDetails: ""
                  })
                }
              >
                <option value="event">Event</option>
                <option value="announcement">Announcement</option>
                <option value="campaign">Campaign</option>
                <option value="educational">Educational content</option>
              </select>
            </Field>
            <Field label="Team / project">
              <input
                className={input}
                value={media.team}
                onChange={(e) => m({ team: e.target.value })}
                required
              />
            </Field>
            {media.type === "event" && (
              <>
                <div className="sm:col-span-2">
                  <Field label="Existing event">
                    <select
                      className={input}
                      value={media.eventId}
                      onChange={(e) => {
                        const ev = data.events.find(
                          (x) => x.id === e.target.value
                        )
                        m({
                          eventId: ev?.id || "",
                          eventDetails: ev?.details || "",
                          brief: ev?.details || "",
                          postedBy: ev?.postedBy || ""
                        })
                        setTitle(ev?.title || "")
                      }}
                    >
                      <option value="">
                        Write an event brief from scratch
                      </option>
                      {data.events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Event details">
                    <textarea
                      className={input}
                      rows={3}
                      value={media.eventDetails}
                      onChange={(e) => m({ eventDetails: e.target.value })}
                      placeholder="Date, time, timezone, location, speaker, and registration link"
                    />
                  </Field>
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Field
                label="Idea / brief"
                hint="Who is this for, what should they know, and what should they do?"
              >
                <textarea
                  className={input}
                  rows={4}
                  value={media.brief}
                  onChange={(e) => m({ brief: e.target.value })}
                  required
                />
              </Field>
            </div>
            <Field label="When does this need to be posted by?">
              <input
                type="date"
                className={input}
                value={media.postedBy}
                onChange={(e) => m({ postedBy: e.target.value })}
                required
              />
            </Field>
            <Field label="Media format">
              <select
                className={input}
                value={media.format}
                onChange={(e) => m({ format: e.target.value })}
              >
                {[
                  "Media to advise",
                  "Image",
                  "Carousel",
                  "Story",
                  "Short video",
                  "Long video",
                  "Blog / article",
                  "Newsletter",
                  "Other"
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-zinc-700">
                Requested platforms
              </p>
              <div className="flex flex-wrap gap-4">
                {[
                  "Media to advise",
                  "Instagram",
                  "LinkedIn",
                  "Newsletter",
                  "Website / blog",
                  "Member portal"
                ].map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={media.platforms.includes(platform)}
                      onChange={(e) =>
                        m({
                          platforms: e.target.checked
                            ? [...media.platforms, platform]
                            : media.platforms.filter((p) => p !== platform)
                        })
                      }
                    />
                    {platform}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={media.urgent}
                onChange={(e) => m({ urgent: e.target.checked })}
              />
              Urgent — alert Agnes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={media.needsCopyHelp}
                onChange={(e) => m({ needsCopyHelp: e.target.checked })}
              />
              Need copywriting help
            </label>
            <div className="sm:col-span-2">
              <details
                className="rounded-xl border border-zinc-200 p-4"
                open={!!record}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  Draft copy and supporting materials (optional)
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  <Field label="Headline">
                    <input
                      className={input}
                      value={media.headline}
                      onChange={(e) => m({ headline: e.target.value })}
                    />
                  </Field>
                  <Field label="Body">
                    <textarea
                      className={input}
                      rows={4}
                      value={media.body}
                      onChange={(e) => m({ body: e.target.value })}
                    />
                  </Field>
                  <Field label="Post caption">
                    <textarea
                      className={input}
                      rows={3}
                      value={media.caption}
                      onChange={(e) => m({ caption: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Google Drive / Canva links"
                    hint="One link per line. Keep source files in Drive or Canva and give the Media team access."
                  >
                    <textarea
                      className={input}
                      rows={3}
                      value={links}
                      onChange={(e) => setLinks(e.target.value)}
                    />
                  </Field>
                </div>
              </details>
            </div>
          </>
        )}
      </div>
      <div className="mt-6 flex gap-3">
        <button disabled={busy} className={primary}>
          {busy ? "Saving…" : record ? "Save changes" : "Submit request"}
        </button>
        <button type="button" className={secondary} onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  )
}
function RequestDetail({
  record: r,
  data,
  busy,
  save
}: {
  record: WorkflowRequest
  data: Bootstrap
  busy: boolean
  save: Save
}) {
  const [editing, setEditing] = useState(false),
    [note, setNote] = useState(""),
    [status, setStatus] = useState(mediaNextStatuses(r.status)[0] || r.status)
  const apply = (body: Record<string, unknown>) =>
    save({ revision: r.revision, ...body })
  const run = (body: Record<string, unknown>) =>
    void apply(body).catch(() => {})
  if (editing)
    return (
      <RequestForm
        kind={r.kind}
        data={data}
        busy={busy}
        save={save}
        close={() => setEditing(false)}
        record={r}
      />
    )
  const name = (id?: string) =>
    data.people.find((p) => p.id === id)?.name || "Unassigned"
  return (
    <div className="flex flex-col gap-6">
      {r.kind === "media" ? (
        <>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>
              {r.media!.type} · {r.media!.team}
            </span>
            {r.media!.urgent && (
              <span className="font-semibold text-amber-700">Urgent</span>
            )}
            <span>
              {r.media!.platforms.join(", ")} · {r.media!.format}
            </span>
            {r.media!.needsCopyHelp && <span>Copywriting requested</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {r.media!.brief}
          </p>
          {r.media!.eventDetails && (
            <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm">
              {r.media!.eventDetails}
            </p>
          )}
          {["headline", "body", "caption"].map((key) => {
            const value = r.media![key as "headline" | "body" | "caption"]
            return value ? (
              <div key={key}>
                <p className="text-xs font-medium uppercase text-zinc-500">
                  {key}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
              </div>
            ) : null
          })}
          <div className="flex flex-wrap gap-3">
            {r.media!.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-ipn underline"
              >
                {l.label} {i + 1}
              </a>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            {r.media!.acceptedAt && (
              <span>
                Accepted by {name(r.media!.acceptedBy)} ·{" "}
                {r.media!.acceptedAt.slice(0, 10)}
              </span>
            )}
            {r.media!.reviewedAt && (
              <span>
                Final review: {name(r.media!.reviewedBy)} ·{" "}
                {r.media!.reviewedAt.slice(0, 10)}
              </span>
            )}
          </div>
          <Production
            record={r}
            people={data.people}
            busy={busy}
            save={apply}
          />
          {r.status !== "posted" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Move request to">
                <select
                  disabled={busy}
                  className={input}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  {mediaNextStatuses(r.status).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Review notes / missing information">
                <textarea
                  className={input}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </Field>
              <button
                className={`${primary} justify-self-start`}
                disabled={busy || !mediaNextStatuses(r.status).length}
                onClick={() => run({ action: "status", status, note })}
              >
                Update status
              </button>
            </div>
          )}
        </>
      ) : (
        <ExpenseDetail record={r} data={data} busy={busy} save={apply} />
      )}
      {![
        "posted",
        "purchased",
        "reimbursed",
        "awaiting_reimbursement",
        "cancelled"
      ].includes(r.status) && (
        <button
          className={`${secondary} self-start`}
          onClick={() => setEditing(true)}
        >
          Edit request
        </button>
      )}
      <div className="border-t border-zinc-200 pt-5">
        <h3 className="font-semibold">Activity and feedback</h3>
        <ol className="mt-3 space-y-3">
          {data.activity
            .filter((a) => a.requestId === r.id)
            .map((a) => (
              <li key={a.id} className="border-l-2 border-ipn-light pl-3">
                <p className="text-xs text-zinc-500">
                  {a.actorName} · {a.event.replace(/_/g, " ")} ·{" "}
                  {new Date(a.createdAt).toLocaleString()}
                </p>
                {a.note && (
                  <p className="mt-1 whitespace-pre-wrap text-sm">{a.note}</p>
                )}
              </li>
            ))}
        </ol>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: "comment", note })
          }}
        >
          <Field label="Add a comment">
            <textarea
              className={input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </Field>
          <button
            disabled={busy || !note.trim()}
            className={`${secondary} self-start`}
          >
            Add comment
          </button>
        </form>
      </div>
    </div>
  )
}
function PersonSelect({
  label,
  value,
  people,
  onChange
}: {
  label: string
  value: string
  people: Person[]
  onChange: (value: string) => void
}) {
  return (
    <Field label={label}>
      <select
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Unassigned</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  )
}
function Production({
  record: r,
  people,
  busy,
  save
}: {
  record: WorkflowRequest
  people: Person[]
  busy: boolean
  save: Save
}) {
  const [owner, setOwner] = useState(r.media!.productionOwnerId),
    [publisher, setPublisher] = useState(r.media!.publisherId),
    [items, setItems] = useState(r.media!.deliverables)
  const update = (i: number, patch: Partial<Deliverable>) =>
    setItems(items.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const locked = r.status === "posted"
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="font-semibold">Production and publication</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Final assets stay in Google Drive or Canva. Agnes leads acceptance,
        assignment, and review.
      </p>
      <fieldset disabled={busy || locked} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <PersonSelect
            label="Production owner"
            people={people}
            value={owner}
            onChange={setOwner}
          />
          <PersonSelect
            label="Publishing owner"
            people={people}
            value={publisher}
            onChange={setPublisher}
          />
        </div>
        {items.map((d, i) => (
          <fieldset
            key={d.id}
            disabled={
              d.status === "posted" &&
              r.media!.deliverables.some(
                (x) => x.id === d.id && x.status === "posted"
              )
            }
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Deliverable name">
                <input
                  className={input}
                  value={d.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </Field>
              <Field label="Platform">
                <input
                  className={input}
                  value={d.platform}
                  onChange={(e) => update(i, { platform: e.target.value })}
                />
              </Field>
              <Field label="Format">
                <input
                  className={input}
                  value={d.format}
                  onChange={(e) => update(i, { format: e.target.value })}
                />
              </Field>
              <Field label="Deliverable status">
                <select
                  className={input}
                  value={d.status}
                  onChange={(e) =>
                    update(i, {
                      status: e.target.value as Deliverable["status"]
                    })
                  }
                >
                  {[
                    "planned",
                    "in_production",
                    "review",
                    "ready",
                    "posted"
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <PersonSelect
                label="Production assignee"
                people={people}
                value={d.assigneeId}
                onChange={(value) => update(i, { assigneeId: value })}
              />
              <PersonSelect
                label="Publisher"
                people={people}
                value={d.publisherId}
                onChange={(value) => update(i, { publisherId: value })}
              />
              <Field label="Scheduled posting date">
                <input
                  type="date"
                  className={input}
                  value={d.scheduledDate}
                  onChange={(e) => update(i, { scheduledDate: e.target.value })}
                />
              </Field>
              <Field label="Final asset link (Drive / Canva)">
                <input
                  type="url"
                  className={input}
                  value={d.assetUrl}
                  onChange={(e) => update(i, { assetUrl: e.target.value })}
                />
              </Field>
              <Field label="Published link">
                <input
                  type="url"
                  className={input}
                  value={d.publishedUrl}
                  onChange={(e) => update(i, { publishedUrl: e.target.value })}
                />
              </Field>
              <Field label="Actual posting date">
                <input
                  type="date"
                  className={input}
                  value={d.postedDate}
                  onChange={(e) => update(i, { postedDate: e.target.value })}
                />
              </Field>
            </div>
            {d.status !== "posted" && (
              <button
                className="mt-3 text-xs text-zinc-500 underline"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove deliverable
              </button>
            )}
          </fieldset>
        ))}
        {!locked && (
          <div className="flex flex-wrap gap-3">
            <button
              className={secondary}
              onClick={() =>
                setItems([
                  ...items,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    platform: "",
                    format: r.media!.format,
                    assigneeId: owner,
                    publisherId: publisher,
                    scheduledDate: r.media!.postedBy,
                    status: "planned",
                    assetUrl: "",
                    publishedUrl: "",
                    postedDate: ""
                  }
                ])
              }
            >
              Add deliverable
            </button>
            <button
              className={primary}
              onClick={() =>
                void save({
                  action: "production",
                  productionOwnerId: owner,
                  publisherId: publisher,
                  deliverables: items
                }).catch(() => {})
              }
            >
              Save production
            </button>
          </div>
        )}
      </fieldset>
    </section>
  )
}
function ExpenseDetail({
  record: r,
  data,
  busy,
  save
}: {
  record: WorkflowRequest
  data: Bootstrap
  busy: boolean
  save: Save
}) {
  const e = r.expense!,
    approver = data.user.id === data.approverId
  const [note, setNote] = useState(""),
    [month, setMonth] = useState(e.expectedMonth),
    [paymentMethod, setMethod] = useState(approver ? "ipn_card" : "personal"),
    [actual, setActual] = useState(
      String((e.actualAmountCents ?? e.amountCents) / 100)
    ),
    [purchaseDate, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [account, setAccount] = useState("Relay"),
    [receipt, setReceipt] = useState(e.receiptUrl),
    [match, setMatch] = useState("")
  const run = (body: Record<string, unknown>) => void save(body).catch(() => {})
  const matched = new Set(
    data.requests
      .filter((x) => x.id !== r.id)
      .map((x) => x.expense?.bankTransactionId)
      .filter(Boolean)
  )
  const matches = data.bankEntries.filter(
    (b) =>
      b.amountCents === -e.actualAmountCents! &&
      b.account === e.account &&
      !matched.has(b.id)
  )
  return (
    <div className="flex flex-col gap-5">
      <p className="whitespace-pre-wrap text-sm">{e.purpose}</p>
      {e.itemUrl && (
        <a
          href={e.itemUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-ipn underline"
        >
          Item / expense link
        </a>
      )}
      {e.approvedAt && (
        <p className="text-xs text-zinc-500">
          Approved by Justin · {e.approvedAt.slice(0, 10)} ·{" "}
          {usd(e.approvedAmountCents!)}
          {e.expectedMonth
            ? ` · Expected ${e.expectedMonth}`
            : " · Spending month not scheduled"}
        </p>
      )}
      {e.purchaseDate && (
        <p className="text-sm">
          Purchased {e.purchaseDate} · {usd(e.actualAmountCents!)} ·{" "}
          {e.paymentMethod === "personal" ? "Paid personally" : e.account}
          {e.paidDate ? ` · IPN payment ${e.paidDate}` : ""}
        </p>
      )}
      {e.receiptUrl && (
        <a
          href={e.receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-ipn underline"
        >
          View saved receipt
        </a>
      )}
      {r.status === "pending" && approver && (
        <div className="grid gap-4 rounded-xl bg-ipn-light p-4 sm:grid-cols-2">
          <Field label="Expected spending month (optional)">
            <input
              type="month"
              className={input}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
          <Field label="Decision note / rejection reason">
            <textarea
              className={input}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <div className="flex gap-3">
            <button
              disabled={busy}
              className={primary}
              onClick={() =>
                run({ action: "approve", expectedMonth: month, note })
              }
            >
              Approve expense
            </button>
            <button
              disabled={busy || !note.trim()}
              className={secondary}
              onClick={() => run({ action: "reject", note })}
            >
              Reject expense
            </button>
          </div>
        </div>
      )}
      {r.status === "approved" && (
        <form
          className="grid gap-4 rounded-xl border border-zinc-200 p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            run({
              action: "purchase",
              actualAmountCents: actual,
              purchaseDate,
              paymentMethod,
              account,
              receiptUrl: receipt
            })
          }}
        >
          <h3 className="font-semibold sm:col-span-2">Record the purchase</h3>
          <Field label="Paid with">
            <select
              className={input}
              value={approver ? paymentMethod : "personal"}
              onChange={(e) => setMethod(e.target.value)}
            >
              {approver && <option value="ipn_card">IPN debit card</option>}
              <option value="personal">
                Personal funds — reimbursement needed
              </option>
            </select>
          </Field>
          <Field label="Actual cost (USD)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={e.approvedAmountCents! / 100}
              className={input}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
            />
          </Field>
          <Field label="Purchase date">
            <input
              type="date"
              className={input}
              value={purchaseDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          {approver && paymentMethod === "ipn_card" && (
            <Field label="Payment account">
              <select
                className={input}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option>Relay</option>
                <option>Reconsider</option>
              </select>
            </Field>
          )}
          <Field
            label="Receipt link (Drive / Canva)"
            hint="Add the receipt now or save it after purchase."
          >
            <input
              type="url"
              className={input}
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
          </Field>
          <button className={`${primary} justify-self-start`} disabled={busy}>
            Record purchase
          </button>
        </form>
      )}
      {r.status === "awaiting_reimbursement" && approver && (
        <form
          className="grid gap-4 rounded-xl bg-ipn-light p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            run({ action: "reimburse", paidDate: purchaseDate, account })
          }}
        >
          <h3 className="font-semibold sm:col-span-2">
            Record reimbursement payment
          </h3>
          <Field label="Reimbursement payment date">
            <input
              type="date"
              className={input}
              value={purchaseDate}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Payment account">
            <select
              className={input}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option>Relay</option>
              <option>Reconsider</option>
            </select>
          </Field>
          <button disabled={busy} className={`${primary} justify-self-start`}>
            Mark reimbursed
          </button>
        </form>
      )}
      {["purchased", "awaiting_reimbursement", "reimbursed"].includes(
        r.status
      ) && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            run({ action: "receipt", receiptUrl: receipt })
          }}
        >
          <Field label="Add or update receipt link">
            <input
              type="url"
              className={input}
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              required
              placeholder="Google Drive or Canva link"
            />
          </Field>
          <button disabled={busy} className={`${secondary} self-start`}>
            Save receipt
          </button>
        </form>
      )}
      {approver &&
        ["approved", "awaiting_reimbursement"].includes(r.status) && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              run({ action: "schedule", expectedMonth: month })
            }}
          >
            <Field label="Expected spending month">
              <input
                type="month"
                className={input}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </Field>
            <button className={secondary} disabled={busy}>
              Save spending month
            </button>
          </form>
        )}
      {approver && ["purchased", "reimbursed"].includes(r.status) && (
        <div className="rounded-xl border border-zinc-200 p-4">
          <h3 className="font-semibold">Reconcile bank activity</h3>
          {e.bankTransactionId && (
            <p className="mt-2 text-sm text-emerald-700">
              Matched to imported bank activity.
            </p>
          )}
          <select
            aria-label="Matching bank transaction"
            className={`${input} mt-3`}
            value={match}
            onChange={(event) => setMatch(event.target.value)}
          >
            <option value="">Select a matching bank entry</option>
            {matches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.date} · {b.description} · {usd(b.amountCents)}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !match}
            className={`${secondary} mt-3`}
            onClick={() => run({ action: "match", bankTransactionId: match })}
          >
            Confirm match
          </button>
          <p className="mt-2 text-xs text-zinc-500">
            Matching links the existing payment; it does not record another
            expense.
          </p>
        </div>
      )}
      {["pending", "approved", "rejected"].includes(r.status) && (
        <button
          disabled={busy}
          className={`${secondary} self-start`}
          onClick={() => run({ action: "cancel" })}
        >
          Cancel request
        </button>
      )}
    </div>
  )
}
function BankImport({
  data,
  busy,
  save
}: {
  data: Bootstrap
  busy: boolean
  save: Save
}) {
  const [account, setAccount] = useState("Relay"),
    [error, setError] = useState("")
  async function imported(file: File) {
    setError("")
    try {
      const { parseBankCsv } =
        await import("@/lib/leadership-workflows/bank-csv")
      const entries = parseBankCsv(await file.text())
      await save({ action: "import_bank", account, entries })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to import CSV.")
    }
  }
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-5">
      <summary className="cursor-pointer font-medium">
        Import bank activity for reconciliation
      </summary>
      <p className="mt-3 text-sm text-zinc-500">
        Import a CSV with Date, Description, and Amount columns (signed USD;
        expenses negative). Include a Transaction ID when available. Imports
        suggest matches and do not create expenses or change cash.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <select
          aria-label="Bank import account"
          className={`${input} max-w-xs`}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option>Relay</option>
          <option>Reconsider</option>
        </select>
        <input
          aria-label="Import bank CSV"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="max-w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void imported(file)
            e.target.value = ""
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        {data.bankEntries.length} imported bank entries
      </p>
    </details>
  )
}
