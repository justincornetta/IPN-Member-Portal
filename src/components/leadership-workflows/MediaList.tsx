"use client"
import {
  STATUS_LABELS,
  type Person,
  type WorkflowRequest
} from "@/lib/leadership-workflows/domain"

export const MEDIA_COLUMNS = [
  { key: "title", label: "Idea Name" },
  { key: "type", label: "Request Type" },
  { key: "submitter", label: "Submitter" },
  { key: "submitted", label: "Submitted date" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Media Owner" },
  { key: "deadline", label: "Publish by date" }
] as const
export type MediaSortKey = (typeof MEDIA_COLUMNS)[number]["key"]
export type SortDirection = "asc" | "desc"
const TYPES = {
  event: "Event",
  announcement: "Announcement",
  campaign: "Campaign",
  educational: "Educational content"
}
export function mediaListValue(
  record: WorkflowRequest,
  key: MediaSortKey,
  people: Person[]
): string {
  const media = record.media!
  switch (key) {
    case "title":
      return record.title
    case "type":
      return TYPES[media.type]
    case "submitter":
      return record.requesterName
    case "submitted":
      return record.submittedAt
    case "status":
      return STATUS_LABELS[record.status]
    case "owner":
      return (
        people.find((person) => person.id === media.productionOwnerId)?.name ||
        "Unassigned"
      )
    case "deadline":
      return media.postedBy
  }
}
export function sortMediaRequests(
  records: WorkflowRequest[],
  people: Person[],
  key: MediaSortKey,
  direction: SortDirection
): WorkflowRequest[] {
  return [...records].sort((a, b) => {
    const left = mediaListValue(a, key, people),
      right = mediaListValue(b, key, people)
    // Missing dates stay last in either direction.
    if (!left && right) return 1
    if (left && !right) return -1
    const result = left.localeCompare(right, "en", {
      sensitivity: "base",
      numeric: true
    })
    return (
      (direction === "asc" ? result : -result) ||
      b.submittedAt.localeCompare(a.submittedAt) ||
      a.id.localeCompare(b.id)
    )
  })
}
export default function MediaList({
  records,
  people,
  sortKey,
  direction,
  sort,
  open
}: {
  records: WorkflowRequest[]
  people: Person[]
  sortKey: MediaSortKey
  direction: SortDirection
  sort: (key: MediaSortKey) => void
  open: (id: string) => void
}) {
  function deadline(date: string) {
    return date
      ? new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC"
        })
      : "Not set"
  }
  return (
    <div>
      <div
        role="region"
        aria-label="Media request list"
        tabIndex={0}
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ipn"
      >
        <table className="w-full min-w-[980px] text-left text-sm">
          <caption className="sr-only">
            Media requests. Select an idea to open its details. Column headers
            change the sort order.
          </caption>
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              {MEDIA_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    sortKey === column.key
                      ? direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="px-4 py-3"
                >
                  <button
                    onClick={() => sort(column.key)}
                    className="flex items-center gap-1 text-left hover:text-ipn focus:outline-none focus-visible:underline"
                    aria-label={`Sort by ${column.label}`}
                  >
                    {column.label}
                    <span aria-hidden="true">
                      {sortKey === column.key
                        ? direction === "asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </button>
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
                  className="min-w-48 max-w-72 px-4 py-4 font-medium"
                >
                  <button
                    aria-label={`Open media request: ${r.title}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      open(r.id)
                    }}
                    className="w-full break-words text-left text-ipn hover:underline focus:outline-none focus-visible:underline"
                  >
                    {r.title}
                  </button>
                  {r.media!.urgent && (
                    <span className="mt-1 block text-xs font-semibold text-amber-700">
                      Urgent
                    </span>
                  )}
                </th>
                <td className="px-4 py-4 text-zinc-600">
                  {mediaListValue(r, "type", people)}
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
                <td className="whitespace-nowrap px-4 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${r.status === "posted" ? "bg-emerald-50 text-emerald-800" : r.status === "cancelled" ? "bg-zinc-100 text-zinc-600" : "bg-ipn-light text-ipn"}`}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-4 text-zinc-600">
                  {mediaListValue(r, "owner", people)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-medium">
                  {r.media!.postedBy ? (
                    <time dateTime={r.media!.postedBy}>
                      {deadline(r.media!.postedBy)}
                    </time>
                  ) : (
                    "Not set"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Select a row to open its request. Publish by date is the requested
        posting deadline. Scroll sideways on smaller screens to see all columns.
      </p>
    </div>
  )
}
