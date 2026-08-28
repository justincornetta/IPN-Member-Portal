"use client"

import { useMemo } from "react"
import CommunityEventDetail, {
  type CommunityActivity,
} from "@/components/events/CommunityEventDetail"
import EventCard from "@/components/events/EventCard"
import type { ConferenceRecord } from "@/lib/conferences/types"
import type { EventWithRegistration } from "@/lib/events/types"

type AgendaActivity =
  | {
      key: string
      kind: "event"
      startsAt: string
      event: EventWithRegistration
    }
  | {
      key: string
      kind: "community"
      startsAt: string
      item: CommunityActivity
    }

export default function UpcomingAgenda({
  events,
  conferences,
  registeredMeetupIds = [],
}: {
  events: EventWithRegistration[]
  conferences: ConferenceRecord[]
  registeredMeetupIds?: string[]
}) {
  const activities = useMemo<AgendaActivity[]>(
    () =>
      [
        ...events.map((event) => ({
          key: `event:${event.id}`,
          kind: "event" as const,
          startsAt: event.starts_at,
          event,
        })),
        ...conferences.flatMap((conference) =>
          conference.meetups.map((meetup) => ({
            key: `community:${conference.id}:${meetup.id}`,
            kind: "community" as const,
            startsAt: meetup.startsAt,
            item: { meetup, conference },
          })),
        ),
      ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [conferences, events],
  )

  return (
    <section aria-label="Upcoming events">
      <div className="flex flex-col gap-4">
        {activities.map((activity) =>
          activity.kind === "event" ? (
            <EventCard
              key={activity.key}
              event={activity.event}
              variant="full"
            />
          ) : (
            <CommunityEventDetail
              key={activity.key}
              item={activity.item}
              isRegistered={registeredMeetupIds.includes(activity.item.meetup.id)}
            />
          ),
        )}
      </div>
    </section>
  )
}
