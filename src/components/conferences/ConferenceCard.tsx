import Link from "next/link"
import ConferenceCover from "@/components/conferences/ConferenceCover"
import { formatConferenceDateRange } from "@/lib/conferences/format"
import type { ConferenceRecord } from "@/lib/conferences/types"

export default function ConferenceCard({
  conference,
  priority = false,
  preview = false,
  compact = false,
}: {
  conference: ConferenceRecord
  priority?: boolean
  preview?: boolean
  compact?: boolean
}) {
  const location = [conference.city, conference.state, conference.country].filter(Boolean).join(", ")
  const card = (
    <article className={`flex h-full min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-ipn/30 group-hover:shadow-md ${compact ? "" : "sm:p-4"}`}>
      <ConferenceCover
        imageUrl={conference.cover_image_url}
        category={conference.category}
        hasMeetup={conference.meetups.length > 0}
        sizes="(max-width: 639px) calc(100vw - 56px), (max-width: 1023px) 44vw, 27vw"
        className="rounded-lg"
        priority={priority}
      />

      <div className={`mt-3 flex min-w-0 flex-1 flex-col ${compact ? "" : "sm:mt-4"}`}>
        <p className="text-xs font-medium text-zinc-500">
          {formatConferenceDateRange(conference.starts_at, conference.ends_at, conference.timezone)}
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-zinc-900 group-hover:text-ipn">{conference.name}</h3>
        <p className="mt-1 text-xs text-zinc-500">{location}</p>
        {conference.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{conference.summary}</p>}
        {conference.discounts.length > 0 && (
          <p className="mt-2 line-clamp-1 text-xs font-medium text-ipn">
            {conference.discounts[0].label}{conference.discounts[0].code ? ` — code ${conference.discounts[0].code}` : ""}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <span className="text-xs text-zinc-500">
            {conference.rsvp_count ? `${conference.rsvp_count} member${conference.rsvp_count === 1 ? "" : "s"} going` : "No RSVPs yet"}
          </span>
          <span className="text-sm font-medium text-ipn">View details</span>
        </div>
      </div>
    </article>
  )

  if (preview) return <div className="group h-full min-w-0">{card}</div>
  return <Link href={`/dashboard/conferences/${conference.slug}`} className="group block h-full min-w-0">{card}</Link>
}
