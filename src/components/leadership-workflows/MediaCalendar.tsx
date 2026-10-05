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
  const entries = records
    .filter((r) => r.media && r.status !== "cancelled")
    .flatMap((r) => {
      const media = r.media!
      const deadlines =
        r.status === "posted"
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
          title: `${r.title} · ${d.name}`,
          label: d.status === "posted" ? "Posted" : "Scheduled",
          status: d.status.replace(/_/g, " ")
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
        View request deadlines, scheduled deliverables and actual posting dates.
        Select an entry to open its request. Cancelled requests are excluded.
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
    </section>
  )
}
