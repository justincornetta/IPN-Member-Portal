"use client"
import { useState } from "react"
import {
  STATUS_LABELS,
  type WorkflowRequest
} from "@/lib/leadership-workflows/domain"

export default function MediaCalendar({
  records,
  open
}: {
  records: WorkflowRequest[]
  open: (id: string) => void
}) {
  const today = new Date()
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  )
  const [year, monthNumber] = month.split("-").map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const active = records.filter((r) => r.media && r.status !== "cancelled")
  // Asset-only and TBD requests are not IPN posts with a fixed date; list them below the grid.
  const unscheduled = active
    .filter(
      (r) =>
        (r.media!.assetOnly || r.media!.postedByTbd) &&
        !["posted", "delivered"].includes(r.status)
    )
    .sort(
      (a, b) =>
        Number(Boolean(a.media!.postedByTbd)) -
          Number(Boolean(b.media!.postedByTbd)) ||
        a.media!.postedBy.localeCompare(b.media!.postedBy) ||
        a.title.localeCompare(b.title)
    )
  const entries = active
    .filter((r) => !r.media!.assetOnly)
    .flatMap((r) => {
      const media = r.media!
      const deadlines =
        r.status === "posted" || media.postedByTbd
          ? []
          : [
              {
                id: `${r.id}-deadline`,
                requestId: r.id,
                date: media.postedBy,
                title: r.title,
                label: "Deadline",
                status: STATUS_LABELS[r.status]
              }
            ]
      return [
        ...deadlines,
        ...media.deliverables.map((d) => ({
          id: d.id,
          requestId: r.id,
          date: d.status === "posted" ? d.postedDate : d.scheduledDate,
          title:
            media.deliverables.length === 1
              ? r.title
              : `${r.title} · ${d.name}`,
          label: d.status === "posted" ? "Posted" : "Scheduled",
          status: STATUS_LABELS[r.status]
        }))
      ].filter((e) => e.date.startsWith(`${month}-`))
    })
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
    )
  function move(offset: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
    setMonth(next.toISOString().slice(0, 7))
  }
  function item(entry: (typeof entries)[number]) {
    return (
      <button
        key={entry.id}
        onClick={() => open(entry.requestId)}
        className={`w-full rounded-lg border p-2 text-left text-xs ${entry.label === "Posted" ? "border-emerald-200 bg-emerald-50" : entry.label === "Deadline" ? "border-amber-200 bg-amber-50" : "border-purple-200 bg-ipn-light"}`}
      >
        <span className="block font-semibold">
          {entry.label} · {entry.status}
        </span>
        <span className="mt-1 block break-words">{entry.title}</span>
      </button>
    )
  }
  return (
    <section
      aria-label="Media calendar"
      className="rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {first.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC"
          })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous month"
            onClick={() => move(-1)}
            className="rounded-lg border px-3 py-2"
          >
            ←
          </button>
          <input
            aria-label="Calendar month"
            type="month"
            value={month}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value)
            }}
            className="min-w-0 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            aria-label="Next month"
            onClick={() => move(1)}
            className="rounded-lg border px-3 py-2"
          >
            →
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        View request deadlines, scheduled posts and actual posting dates. Select
        an entry to open its request. Cancelled requests are excluded. Requests
        with a TBD date and asset-only requests are listed below the calendar.
      </p>
      <div className="mt-4 hidden grid-cols-7 gap-1 md:grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <p key={day} className="p-2 text-xs font-medium text-zinc-500">
            {day}
          </p>
        ))}
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`
          return (
            <div
              key={date}
              className="min-h-28 min-w-0 rounded-lg border border-zinc-100 p-1.5"
            >
              <p className="mb-2 text-xs font-medium">{i + 1}</p>
              <div className="space-y-1">
                {entries.filter((e) => e.date === date).map(item)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 space-y-3 md:hidden">
        {entries.map((entry) => (
          <div key={entry.id}>
            <p className="mb-1 text-xs text-zinc-500">{entry.date}</p>
            {item(entry)}
          </div>
        ))}
      </div>
      {!entries.length && (
        <p className="mt-4 text-sm text-zinc-500">
          No media deadlines or posts this month.
        </p>
      )}
      <div className="mt-6 border-t border-zinc-200 pt-4">
        <h3 className="text-sm font-semibold">TBD and needed-by requests</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Not on the calendar: no fixed post date yet, or an asset IPN won&apos;t
          post.
        </p>
        {unscheduled.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((r) => {
              const date = r.media!.postedByTbd
                ? "TBD"
                : r.media!.postedBy
                  ? new Date(`${r.media!.postedBy}T12:00:00Z`).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }
                    )
                  : "Not set"
              return (
                <li key={r.id}>
                  <button
                    onClick={() => open(r.id)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-left text-xs hover:border-ipn focus:outline-none focus-visible:ring-2 focus-visible:ring-ipn"
                  >
                    <span className="block font-semibold">
                      {r.media!.assetOnly ? "Needed by" : "Post by"} {date} ·{" "}
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span className="mt-1 block break-words">{r.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">None right now.</p>
        )}
      </div>
    </section>
  )
}
