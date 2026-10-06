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
  MEDIA_FORMATS,
  mediaFormats,
  mediaPostCaption,
  EXPENSE_STATUSES,
  MEDIA_STATUSES,
  STATUS_LABELS,
  mediaNextStatuses,
  usd,
  unpaidCents,
  type Bootstrap,
  type Kind,
  type MediaBrief,
  type Person,
  type WorkflowRequest
} from "@/lib/leadership-workflows/domain"

import MediaCalendar from "./MediaCalendar"
import MediaList, {
  MEDIA_COLUMNS,
  mediaListValue,
  sortMediaRequests,
  type MediaSortKey,
  type SortDirection
} from "./MediaList"

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
  formats: ["Media to advise"],
  needsCopyHelp: false,
  headline: "",
  caption: "",
  additionalDetails: "",
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
            children as ReactElement<{
              id?: string
              "aria-label"?: string
              "aria-describedby"?: string
            }>,
            {
              id: fieldId,
              "aria-label": label,
              "aria-describedby": hint ? `${fieldId}-hint` : undefined
            }
          )
        : children}
      {hint && (
        <span
          id={`${fieldId}-hint`}
          className="text-xs font-normal text-zinc-500"
        >
          {hint}
        </span>
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
    [expenseTab, setExpenseTab] = useState("requests"),
    [mediaView, setMediaView] = useState("queue"),
    [mediaSort, setMediaSort] = useState<MediaSortKey>("deadline"),
    [mediaDirection, setMediaDirection] = useState<SortDirection>("asc")
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
        [
          r.title,
          r.requesterName,
          r.media?.team,
          r.media?.brief,
          r.expense?.purpose,
          ...(r.kind === "media"
            ? MEDIA_COLUMNS.map((column) =>
                mediaListValue(r, column.key, data?.people ?? [])
              )
            : [])
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()))
  )
  const sortedMedia =
    kind === "media"
      ? sortMediaRequests(
          visible,
          data?.people ?? [],
          mediaSort,
          mediaDirection
        )
      : []
  function sortMedia(key: MediaSortKey) {
    if (key === mediaSort)
      setMediaDirection((current) => (current === "asc" ? "desc" : "asc"))
    else {
      setMediaSort(key)
      setMediaDirection(key === "submitted" ? "desc" : "asc")
    }
  }
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 text-zinc-900 sm:p-8">
      {demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span>
            Local preview · no sign-in needed · sample people · notifications
            and tracker writes disabled
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
              ? "Share a brief, coordinate production, and track each request through posting."
              : isApprover
                ? "Review requests, record purchases, and keep receipts."
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
          <section
            aria-label="IPN funds"
            className="rounded-xl border border-zinc-200 bg-white p-5 sm:col-span-2"
          >
            <p className="text-xs text-zinc-500">Total IPN funds</p>
            <p className="mt-2 text-2xl font-semibold">
              {data.cash
                ? usd(data.cash.relayCents + data.cash.reconsiderCents)
                : "Not connected"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {data.cash
                ? "Includes estimated Reconsider holdings."
                : "Connect the finance tracker to show dated balances."}
            </p>
            {data.cash && (
              <dl className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-zinc-500">Recorded Relay cash</dt>
                  <dd className="mt-1 text-base font-semibold">
                    {usd(data.cash.relayCents)}
                  </dd>
                  <dd className="mt-1 text-xs text-zinc-500">
                    As of {data.cash.relayAsOf}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-500">
                    Reconsider-held funds
                  </dt>
                  <dd className="mt-1 text-base font-semibold">
                    {usd(data.cash.reconsiderCents)}
                  </dd>
                  <dd className="mt-1 text-xs text-zinc-500">
                    Estimated · as of {data.cash.reconsiderAsOf}
                  </dd>
                </div>
              </dl>
            )}
          </section>
          <Stat
            title="Approved unpaid commitments"
            value={usd(records.reduce((n, r) => n + unpaidCents(r), 0))}
            note={`${records.filter((r) => unpaidCents(r) && !r.expense?.expectedMonth).length} without an expected spending month`}
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
      {data && kind === "media" && (
        <nav
          aria-label="Media views"
          className="flex gap-2 border-b border-zinc-200 pb-3"
        >
          {[
            { id: "queue", label: "Request queue" },
            { id: "calendar", label: "Media calendar" }
          ].map((view) => (
            <button
              key={view.id}
              disabled={busy}
              aria-pressed={mediaView === view.id}
              className={mediaView === view.id ? primary : secondary}
              onClick={() => {
                setMediaView(view.id)
                setSelected("")
                setCreating(false)
              }}
            >
              {view.label}
            </button>
          ))}
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
              {current.kind === "expense" && (
                <p className="mt-1 text-sm text-zinc-500">
                  {current.requesterName} · Submitted{" "}
                  {current.submittedAt.slice(0, 10)} ·{" "}
                  {usd(current.expense!.amountCents)}
                </p>
              )}
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
          <div className="flex flex-wrap items-center gap-3">
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
            {kind === "media" && mediaView === "queue" && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-zinc-600" htmlFor="media-sort">
                  Sort by
                </label>
                <select
                  id="media-sort"
                  aria-label="Sort media by"
                  className={`${input} w-auto`}
                  style={{ width: "auto" }}
                  value={mediaSort}
                  onChange={(e) => {
                    const key = e.target.value as MediaSortKey
                    setMediaSort(key)
                    setMediaDirection(key === "submitted" ? "desc" : "asc")
                  }}
                >
                  {MEDIA_COLUMNS.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
                <button
                  aria-label="Toggle media sort direction"
                  className={secondary}
                  onClick={() =>
                    setMediaDirection((current) =>
                      current === "asc" ? "desc" : "asc"
                    )
                  }
                >
                  {mediaDirection === "asc" ? "↑ Ascending" : "↓ Descending"}
                </button>
              </div>
            )}
            <button className={secondary} onClick={() => void load()}>
              Refresh
            </button>
          </div>
          {kind === "media" && mediaView === "calendar" ? (
            <MediaCalendar
              records={visible}
              open={(id) => {
                setSelected(id)
                setError("")
              }}
            />
          ) : (
            <>
              {kind === "expense" ? (
                <ExpenseList
                  records={visible}
                  open={(id) => {
                    setSelected(id)
                    setError("")
                  }}
                />
              ) : (
                <MediaList
                  records={sortedMedia}
                  people={data?.people ?? []}
                  sortKey={mediaSort}
                  direction={mediaDirection}
                  sort={sortMedia}
                  open={(id) => {
                    setSelected(id)
                    setError("")
                  }}
                />
              )}
              {data && visible.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                  <p className="font-medium">
                    {records.length
                      ? "No matching requests"
                      : "No requests yet"}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {kind === "media"
                      ? "Start with an idea or an upcoming event."
                      : "Submit an expense before making the purchase."}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
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
function ExpenseList({
  records,
  open
}: {
  records: WorkflowRequest[]
  open: (id: string) => void
}) {
  return (
    <div>
      <div
        role="region"
        aria-label="Expense list"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ipn"
      >
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">
            Expense requests. Select an expense to open its details.
          </caption>
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              {[
                "Expense",
                "Purpose",
                "Submitter",
                "Submitted date",
                "Cost",
                "Status"
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className={`px-4 py-3 ${label === "Cost" ? "text-right" : ""}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {records.map((r) => (
              <tr
                key={r.id}
                onClick={() => open(r.id)}
                className="cursor-pointer hover:bg-ipn-light/40 focus-within:bg-ipn-light/40"
              >
                <th
                  scope="row"
                  className="min-w-44 max-w-60 px-4 py-4 font-medium"
                >
                  <button
                    aria-label={`Open expense: ${r.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      open(r.id)
                    }}
                    className="w-full break-words text-left text-ipn hover:underline focus:outline-none focus-visible:underline"
                  >
                    {r.title}
                  </button>
                </th>
                <td className="min-w-48 max-w-80 whitespace-pre-wrap break-words px-4 py-4 text-zinc-600">
                  <p className="line-clamp-2" title={r.expense!.purpose}>
                    {r.expense!.purpose}
                  </p>
                </td>
                <td className="px-4 py-4 text-zinc-600">{r.requesterName}</td>
                <td className="whitespace-nowrap px-4 py-4 text-zinc-600">
                  <time dateTime={r.submittedAt}>
                    {new Date(r.submittedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </time>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums">
                  {usd(r.expense!.actualAmountCents ?? r.expense!.amountCents)}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <Badge record={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Select a row to open the expense. Cost shows the requested amount until
        a purchase is recorded, then the actual cost. Scroll sideways on smaller
        screens to see all columns.
      </p>
    </div>
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
      record?.media
        ? { ...record.media, body: undefined, caption: mediaPostCaption(record.media) }
        : { ...emptyMedia, team: data.user.team || "" }
    ),
    [links, setLinks] = useState(
      record?.media?.links.map((l) => l.url).join("\n") || ""
    ),
    [purpose, setPurpose] = useState(record?.expense?.purpose || ""),
    [amount, setAmount] = useState(
      record?.expense ? (record.expense.amountCents / 100).toFixed(2) : ""
    ),
    [itemUrl, setItemUrl] = useState(record?.expense?.itemUrl || ""),
    [copyChoice, setCopyChoice] = useState(
      record?.media
        ? record.media.needsCopyHelp
          ? "help"
          : record.media.headline || mediaPostCaption(record.media)
            ? "self"
            : ""
        : ""
    )
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
        <Field
          label="Submitter"
          hint="Filled in automatically from your portal profile."
        >
          <input
            className={`${input} bg-zinc-50`}
            value={record?.requesterName || data.user.name}
            readOnly
          />
        </Field>
        <Field
          label={kind === "media" ? "Idea name" : "Expense"}
          hint={
            kind === "media"
              ? "A short title that will identify this request in the queue and calendar."
              : "Name the item or service you want to purchase."
          }
        >
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
            <Field
              label="Cost (USD)"
              hint="For example, $45.00: enter 45.00 using numbers and up to two decimal places, without the $ sign."
            >
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,2})?"
                placeholder="45.00"
                className={input}
                value={amount}
                onChange={(e) => {
                  if (/^\d*(\.\d{0,2})?$/.test(e.target.value))
                    setAmount(e.target.value)
                }}
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
            <Field
              label="Request type"
              hint="Choose what this content supports: an event, announcement, campaign or educational piece."
            >
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
            <Field
              label="Team / project"
              hint="The IPN team or project requesting this content."
            >
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
                  <Field
                    label="Existing event"
                    hint="Select an event to prefill its details, then check and update the brief."
                  >
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
                  <Field
                    label="Event details"
                    hint="Include date, time, timezone, location, speakers and the registration link."
                  >
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
            <Field
              label="When does this need to be posted by?"
              hint="The latest date this content should be published, rather than the event date. This appears as a deadline in the calendar."
            >
              <input
                type="date"
                className={input}
                value={media.postedBy}
                onChange={(e) => m({ postedBy: e.target.value })}
                required
              />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-zinc-700">
                Media format
              </p>
              <details className="relative rounded-lg border border-zinc-300 bg-white">
                <summary
                  aria-label="Media format"
                  className="cursor-pointer px-3 py-2.5 text-sm"
                >
                  {mediaFormats(media).join(", ") || "Choose formats"}
                </summary>
                <div
                  role="group"
                  aria-label="Media format options"
                  className="flex flex-col gap-3 border-t border-zinc-200 p-3"
                >
                  {MEDIA_FORMATS.map((format) => (
                    <label
                      key={format}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={mediaFormats(media).includes(format)}
                        onChange={(e) => {
                          const current = mediaFormats(media)
                          const selected = e.target.checked
                            ? format === "Media to advise"
                              ? [format]
                              : [
                                  ...current.filter(
                                    (f) => f !== "Media to advise"
                                  ),
                                  format
                                ]
                            : current.filter((f) => f !== format)
                          const formats = selected.length
                            ? selected
                            : ["Media to advise"]
                          m({ formats, format: formats.join(", ") })
                        }}
                      />
                      {format}
                    </label>
                  ))}
                </div>
              </details>
              <p className="mt-1.5 text-xs text-zinc-500">
                Select formats for this content, or choose Media to advise.
                Submit separate requests for outputs needing their own status or
                posting date.
              </p>
            </div>
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
                  "Email",
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
                            ? platform === "Media to advise"
                              ? [platform]
                              : [
                                  ...media.platforms.filter(
                                    (p) => p !== "Media to advise"
                                  ),
                                  platform
                                ]
                            : media.platforms.filter((p) => p !== platform)
                                  .length
                              ? media.platforms.filter((p) => p !== platform)
                              : ["Media to advise"]
                        })
                      }
                    />
                    {platform}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Where should this content appear? Select all that apply. Email
                covers direct email campaigns; Newsletter is the regular IPN
                newsletter.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={media.urgent}
                onChange={(e) => m({ urgent: e.target.checked })}
              />
              Urgent — alert Agnes
            </label>
            <p className="text-xs text-zinc-500">
              Use Urgent for time-sensitive requests. Agnes still needs to
              review and accept the brief.
            </p>
            <section
              aria-label="Link to include"
              className="rounded-xl border border-ipn/20 bg-ipn-light/40 p-4 sm:col-span-2"
            >
              <h3 className="text-sm font-semibold">
                Link to include (optional)
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                The destination readers should visit, such as an event invite,
                member portal page or portfolio. This is separate from source
                asset links.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Destination URL"
                  hint="Paste the full HTTPS link the audience should open."
                >
                  <input
                    type="url"
                    className={input}
                    placeholder="https://…"
                    value={media.destinationUrl || ""}
                    onChange={(e) => m({ destinationUrl: e.target.value })}
                  />
                </Field>
                <Field
                  label="Where to include the link"
                  hint="For example: Instagram bio, story sticker, caption or email button. Required when you supply a link."
                >
                  <input
                    className={input}
                    value={media.linkPlacement || ""}
                    required={Boolean(media.destinationUrl?.trim())}
                    maxLength={1000}
                    onChange={(e) => m({ linkPlacement: e.target.value })}
                  />
                </Field>
              </div>
            </section>
            <div className="sm:col-span-2">
              <details className="rounded-xl border border-zinc-200 p-4" open>
                <summary className="cursor-pointer text-sm font-medium">
                  Draft copy and supporting materials
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  <Field
                    label="Draft copy"
                    hint="Choose copywriting help, or supply a headline or post caption yourself."
                  >
                    <select
                      className={input}
                      value={copyChoice}
                      required
                      onChange={(e) => {
                        setCopyChoice(e.target.value)
                        m({ needsCopyHelp: e.target.value === "help" })
                      }}
                    >
                      <option value="">
                        Choose how the copy will be written
                      </option>
                      <option value="help">Need copywriting help</option>
                      <option value="self">I will provide the copy</option>
                    </select>
                  </Field>
                  {copyChoice === "help" && (
                    <p className="text-sm text-zinc-500">
                      The Media team will draft the copy using your brief. Add
                      any suggested wording or reference material below.
                    </p>
                  )}
                  {copyChoice && (
                    <>
                      <Field
                        label="Headline"
                        hint="A short opening line or title for the content."
                      >
                        <input
                          className={input}
                          value={media.headline}
                          required={
                            copyChoice === "self" &&
                            !media.caption.trim()
                          }
                          onChange={(e) => m({ headline: e.target.value })}
                        />
                      </Field>
                      <Field
                        label="Post caption"
                        hint="The full text for the post: main message, key details, call to action and any useful links."
                      >
                        <textarea
                          className={input}
                          rows={5}
                          value={media.caption}
                          onChange={(e) => m({ caption: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
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
            <div className="col-span-full">
              <Field
                label="Additional details for the media team (optional)"
                hint="Add any extra context, preferences or instructions the Media team should know. These notes are for the team and are not part of the published copy."
              >
                <textarea
                  className={input}
                  rows={4}
                  maxLength={10000}
                  value={media.additionalDetails || ""}
                  onChange={(e) => m({ additionalDetails: e.target.value })}
                />
              </Field>
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
function MediaSection({
  title,
  children
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="border-t border-zinc-200 py-5">
      <h3 className="text-base font-bold text-zinc-900">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function MediaRequestSummary({
  record: r,
  people
}: {
  record: WorkflowRequest
  people: Person[]
}) {
  const media = r.media!
  const caption = mediaPostCaption(media)
  const eventDetails = media.eventDetails.trim()
  const brief = media.brief.trim()
  const requestType = {
    event: "Event",
    announcement: "Announcement",
    campaign: "Campaign",
    educational: "Educational content"
  }[media.type]
  const overview = [
    ["Submitter", r.requesterName],
    ["Submitted date", r.submittedAt.slice(0, 10)],
    ["Publish by date", media.postedBy],
    ["Request type", requestType],
    ["Team / project", media.team],
    ["Requested platforms", media.platforms.join(", ")],
    ["Media formats", mediaFormats(media).join(", ")]
  ]
  return (
    <div>
      <MediaSection title="Request overview">
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {overview.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="font-semibold text-zinc-600">{label}</dt>
              <dd className="mt-1 break-words text-zinc-900">{value}</dd>
            </div>
          ))}
          {media.urgent && (
            <div>
              <dt className="font-semibold text-zinc-600">Priority</dt>
              <dd className="mt-1 font-semibold text-amber-700">Urgent</dd>
            </div>
          )}
        </dl>
      </MediaSection>
      <MediaSection
        title={eventDetails ? "Brief and event details" : "Request brief"}
      >
        {brief !== eventDetails && (
          <div>
            {eventDetails && (
              <h4 className="mb-2 text-sm font-semibold">Idea / brief</h4>
            )}
            <p className="whitespace-pre-wrap break-words text-sm leading-7">
              {brief}
            </p>
          </div>
        )}
        {eventDetails && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Event details</h4>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">
              {eventDetails}
            </p>
          </div>
        )}
      </MediaSection>
      {(media.needsCopyHelp || media.headline || caption) && (
        <MediaSection title="Draft copy">
          {media.needsCopyHelp && (
            <p className="rounded-lg bg-ipn-light/50 px-3 py-2 text-sm text-ipn-dark">
              Copywriting requested from the Media team.
            </p>
          )}
          {[
            ["Headline", media.headline],
            ["Post caption", caption]
          ].map(([label, value]) => value ? (
              <div key={label}>
                <h4 className="text-sm font-semibold text-zinc-700">{label}</h4>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                  {value}
                </p>
              </div>
            ) : null
          )}
        </MediaSection>
      )}
      {(media.destinationUrl || media.links.length > 0) && (
        <MediaSection title="Links and assets">
          {media.destinationUrl && (
            <section
              aria-label="Requested publishing link"
              className="rounded-xl border border-ipn/25 bg-ipn-light/40 p-4"
            >
              <h4 className="text-sm font-bold">Link to include when posting</h4>
              <a
                href={media.destinationUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm text-ipn underline"
              >
                {media.destinationUrl}
              </a>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                <span className="font-semibold">Where to include it:</span>{" "}
                {media.linkPlacement}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                {media.linkConfirmedAt
                  ? `Inclusion confirmed by ${people.find((person) => person.id === media.linkConfirmedBy)?.name || "Unassigned"} · ${media.linkConfirmedAt.slice(0, 10)}`
                  : "The Media owner must confirm this link was included before marking the request Posted."}
              </p>
            </section>
          )}
          {media.links.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-zinc-700">
                Supporting materials
              </h4>
              <ul className="space-y-3">
                {media.links.map((link, i) => (
                  <li key={i} className="text-sm">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-ipn underline"
                    >
                      {link.label} {i + 1}
                    </a>
                    <p className="mt-1 break-all text-xs text-zinc-500">
                      {link.url}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </MediaSection>
      )}
      {media.additionalDetails && (
        <MediaSection title="Additional details for the media team">
          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            {media.additionalDetails}
          </p>
        </MediaSection>
      )}
    </div>
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
    [note, setNote] = useState("")
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
  return (
    <div className="flex flex-col gap-4">
      {r.kind === "media" ? (
        <>
          <MediaRequestSummary record={r} people={data.people} />
          <Production
            record={r}
            people={data.people}
            busy={busy}
            save={apply}
          />
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
      <details
        open={r.kind === "expense"}
        className="border-t border-zinc-200 pt-4"
      >
        <summary className="cursor-pointer text-sm">
          <h3 className={r.kind === "media" ? "inline text-base font-bold" : "inline font-semibold"}>
            Activity history{" "}
            <span className="ml-1 font-normal text-zinc-500">
              ({data.activity.filter((a) => a.requestId === r.id).length})
            </span>
          </h3>
        </summary>
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
        {r.kind === "media" && (
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
        )}
      </details>
    </div>
  )
}
function PersonSelect({
  label,
  value,
  people,
  onChange,
  unassignedLabel = "Unassigned"
}: {
  label: string
  value: string
  people: Person[]
  onChange: (value: string) => void
  unassignedLabel?: string
}) {
  return (
    <Field label={label}>
      <select
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{unassignedLabel}</option>
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
  const [owner, setOwner] = useState(r.media!.productionOwnerId)
  const [status, setStatus] = useState(r.status)
  const [reviewNote, setReviewNote] = useState("")
  const publication = r.media!.deliverables[0]
  const [details, setDetails] = useState({
    scheduledDate: publication?.scheduledDate || "",
    assetUrl: publication?.assetUrl || "",
    publishedUrl: publication?.publishedUrl || "",
    postedDate: publication?.postedDate || "",
    linkIncluded: Boolean(r.media!.linkConfirmedAt)
  })
  const locked = r.status === "posted"
  const legacyMultiple = r.media!.deliverables.length > 1
  const update = (patch: Partial<typeof details>) =>
    setDetails({ ...details, ...patch })
  const name = (id?: string) =>
    people.find((person) => person.id === id)?.name || "Unassigned"
  return (
    <section aria-label="Production and publication" className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="text-base font-bold">Production and publication</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Assign the Media owner, review the request, then add assets and publication details as work progresses. Save all changes together below.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save({
            action: "media_save",
            ownerId: owner,
            status,
            note: reviewNote,
            publication: details
          }).catch(() => {})
        }}
      >
        <fieldset disabled={busy || locked} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PersonSelect label="Media owner" people={people} value={owner} onChange={setOwner} />
          </div>
          <MediaSection title="Review and status">
            {(r.media!.acceptedAt || r.media!.reviewedAt) && (
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {r.media!.acceptedAt && (
                  <div>
                    <dt className="font-semibold text-zinc-600">Accepted by</dt>
                    <dd className="mt-1">{name(r.media!.acceptedBy)} · {r.media!.acceptedAt.slice(0, 10)}</dd>
                  </div>
                )}
                {r.media!.reviewedAt && (
                  <div>
                    <dt className="font-semibold text-zinc-600">Final review</dt>
                    <dd className="mt-1">{name(r.media!.reviewedBy)} · {r.media!.reviewedAt.slice(0, 10)}</dd>
                  </div>
                )}
              </dl>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Move request to" hint="Keep the current status when saving other updates, or choose the next stage.">
                <select className={input} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {[r.status, ...mediaNextStatuses(r.status)].map((stage) => (
                    <option key={stage} value={stage}>{STATUS_LABELS[stage]}</option>
                  ))}
                </select>
              </Field>
              {!locked && (
                <Field label="Review notes / missing information">
                  <textarea className={input} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} maxLength={8000} required={status === "needs_information" && status !== r.status} />
                </Field>
              )}
            </div>
          </MediaSection>
          {legacyMultiple ? (
            <div className="space-y-3 text-sm">
              <p>This older request contains several outputs. Their saved records are retained below; use separate requests for future work.</p>
              {r.media!.deliverables.map((item) => (
                <div key={item.id} className="rounded-lg border bg-white p-3">
                  <p className="font-medium">{item.name} · {item.platform}</p>
                  <p className="text-xs text-zinc-500">{item.status.replace(/_/g, " ")}</p>
                  {item.assetUrl && <a href={item.assetUrl} target="_blank" rel="noreferrer" className="mr-3 text-ipn underline">Final asset</a>}
                  {item.publishedUrl && <a href={item.publishedUrl} target="_blank" rel="noreferrer" className="text-ipn underline">Published content</a>}
                  {item.postedDate && <p>Posted {item.postedDate}</p>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2">
                <Field label="Final asset link (Drive / Canva)" hint="Link to the finished content or a folder containing its assets. Required before Ready to post.">
                  <input type="url" className={input} value={details.assetUrl} onChange={(e) => update({ assetUrl: e.target.value })} />
                </Field>
                <Field label="Scheduled posting date" hint="The planned posting date, shown in the media calendar. Leave blank until scheduled.">
                  <input type="date" className={input} value={details.scheduledDate} onChange={(e) => update({ scheduledDate: e.target.value })} />
                </Field>
              </div>
              <details className="rounded-lg border border-zinc-200 bg-white" open={locked}>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Publication record</summary>
                <div className="grid gap-4 border-t border-zinc-100 p-4 sm:grid-cols-2">
                  <Field label="Published link" hint="Add the live post, video or sent campaign link after publication.">
                    <input type="url" className={input} value={details.publishedUrl} onChange={(e) => update({ publishedUrl: e.target.value })} />
                  </Field>
                  <Field label="Actual posting date" hint="Add with the published link after posting. Saving both marks the reviewed request Posted.">
                    <input type="date" className={input} value={details.postedDate} onChange={(e) => update({ postedDate: e.target.value })} />
                  </Field>
                </div>
              </details>
              {r.media!.destinationUrl && (
                <div className="rounded-lg border border-ipn/20 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold">Posting checklist</p>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={details.linkIncluded} required={Boolean(details.publishedUrl || details.postedDate)} disabled={!locked && r.status !== "ready_to_post"} onChange={(e) => update({ linkIncluded: e.target.checked })} />
                    I included the requested link in the specified location
                  </label>
                  <p className="mt-2 text-xs text-zinc-500">Confirm after posting, then save the published link and actual date. Final review is required first.</p>
                </div>
              )}
            </>
          )}
          {!locked && <button className={`${primary} self-start`}>{busy ? "Saving…" : "Save"}</button>}
        </fieldset>
      </form>
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
      ((e.actualAmountCents ?? e.amountCents) / 100).toFixed(2)
    ),
    [purchaseDate, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [account, setAccount] = useState("Relay"),
    [receipt, setReceipt] = useState(e.receiptUrl)
  const run = (body: Record<string, unknown>) => void save(body).catch(() => {})
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
          <Field
            label="Actual cost (USD)"
            hint="For example, $45.00: enter 45.00 without the $ sign. The amount must stay within the approved cost."
          >
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              placeholder="45.00"
              className={input}
              value={actual}
              onChange={(e) => {
                if (/^\d*(\.\d{0,2})?$/.test(e.target.value))
                  setActual(e.target.value)
              }}
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
