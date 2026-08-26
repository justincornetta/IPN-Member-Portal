import Link from "next/link"
import EventDateTime from "@/components/events/EventDateTime"
import type { ConferenceMeetup, ConferenceRecord } from "@/lib/conferences/types"

export type CommunityActivity = {
  meetup: ConferenceMeetup
  conference: ConferenceRecord
}

export default function CommunityEventDetail({
  item,
  compact = false,
}: {
  item: CommunityActivity
  compact?: boolean
}) {
  const { meetup, conference } = item
  const conferenceHref = `/dashboard/conferences/${conference.slug}`

  return (
    <article className="flex h-full min-w-0 flex-col rounded-xl border border-[#BFE8DE] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-[#E4F6F1] px-2 py-1 text-[11px] font-semibold text-[#176B5B]">
          Community
        </span>
        <span className="text-xs text-zinc-500">At {conference.name}</span>
      </div>

      <h2 className={`${compact ? "text-lg" : "text-xl"} mt-3 font-semibold leading-snug text-zinc-900`}>
        {meetup.title}
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        <EventDateTime
          startsAt={meetup.startsAt}
          endsAt={null}
          timezone={conference.timezone}
        />
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {meetup.location || conference.venue || [conference.city, conference.state ?? conference.country].filter(Boolean).join(", ") || "Location to be announced"}
      </p>

      <p className={`${compact ? "line-clamp-3" : ""} mt-4 text-sm leading-6 text-zinc-600`}>
        {meetup.description || `Join fellow IPN members gathering alongside ${conference.name}. More meetup details will be shared as they are confirmed.`}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <Link
          href={`${conferenceHref}#ipn-meetups`}
          data-analytics-event="curated_click"
          data-analytics-id={`community-event-rsvp-${meetup.id}`}
          data-analytics-label="RSVP to community event"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#176B5B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#125648] sm:min-h-0"
        >
          RSVP to event
        </Link>
        <Link
          href={conferenceHref}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:text-ipn sm:min-h-0"
        >
          View conference
        </Link>
      </div>
    </article>
  )
}
