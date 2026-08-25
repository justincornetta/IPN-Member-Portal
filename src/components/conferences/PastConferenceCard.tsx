import ConferenceCover from "@/components/conferences/ConferenceCover"
import type { PastConferenceRecord } from "@/lib/conferences/types"

function formatPastDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) return null
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : start
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()

  const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })
  const dayOnly = new Intl.DateTimeFormat("en", { day: "numeric" })
  const year = new Intl.DateTimeFormat("en", { year: "numeric" })

  if (sameMonth) return `${monthDay.format(start)}–${dayOnly.format(end)}, ${year.format(end)}`
  return `${monthDay.format(start)} – ${monthDay.format(end)}, ${year.format(end)}`
}

function ExternalLinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6.75 6.75h3m-3 0A2.25 2.25 0 0 0 4.5 9v8.25a2.25 2.25 0 0 0 2.25 2.25H15a2.25 2.25 0 0 0 2.25-2.25v-3" />
    </svg>
  )
}

export default function PastConferenceCard({ conference }: { conference: PastConferenceRecord }) {
  const location = [conference.city, conference.state, conference.country].filter(Boolean).join(", ")
  const dateRange = formatPastDateRange(conference.starts_at, conference.ends_at)

  return (
    <article className="flex h-full min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
      <ConferenceCover
        imageUrl={conference.cover_image_url}
        category={conference.category}
        sizes="(max-width: 639px) calc(100vw - 56px), (max-width: 1023px) 44vw, 27vw"
        className="rounded-lg"
      />

      <div className="mt-3 flex flex-1 flex-col sm:mt-4">
        {dateRange && <p className="text-xs font-medium text-zinc-500">{dateRange}</p>}
        <h3 className="mt-1 text-base font-semibold leading-snug text-zinc-900">{conference.name}</h3>
        {location && <p className="mt-1 text-xs text-zinc-500">{location}</p>}
        {conference.summary && (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-500">{conference.summary}</p>
        )}
      </div>

      <div className="mt-4 pt-4">
        {conference.drive_folder_url ? (
          <a
            href={conference.drive_folder_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:text-ipn sm:min-h-0"
          >
            View & share photos
            <ExternalLinkIcon />
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-600 sm:min-h-0">
            Photos coming soon
          </span>
        )}
      </div>
    </article>
  )
}
