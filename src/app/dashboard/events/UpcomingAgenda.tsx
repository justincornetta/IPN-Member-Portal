"use client"

import { useMemo, useState } from "react"
import CommunityEventDetail, { type CommunityActivity } from "@/components/events/CommunityEventDetail"
import EventCard from "@/components/events/EventCard"
import type { ConferenceRecord } from "@/lib/conferences/types"
import type { EventWithRegistration } from "@/lib/events/types"

type AgendaActivity =
  | { key: string; kind: "event"; startsAt: string; event: EventWithRegistration }
  | { key: string; kind: "community"; startsAt: string; item: CommunityActivity }

function dateParts(value: string) {
  const date = new Date(value)
  return {
    month: new Intl.DateTimeFormat("en", { month: "short" }).format(date),
    day: new Intl.DateTimeFormat("en", { day: "numeric" }).format(date),
    weekday: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
  }
}

function AgendaList({ activities, selectedKey, onSelect }: { activities: AgendaActivity[]; selectedKey?: string; onSelect: (key: string) => void }) {
  return (
    <div className="max-h-[35rem] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white shadow-sm" aria-label="Upcoming events agenda">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <p className="text-sm font-semibold text-zinc-900">Upcoming events</p>
        <p className="mt-0.5 text-xs text-zinc-500">Select an event to see details</p>
      </div>
      {activities.map((activity) => {
        const date = dateParts(activity.startsAt)
        const selected = activity.key === selectedKey
        const isCommunity = activity.kind === "community"
        const title = isCommunity ? activity.item.meetup.title : activity.event.title
        const location = isCommunity
          ? activity.item.meetup.location || `At ${activity.item.conference.name}`
          : activity.event.location_label ?? "Online"

        return (
          <button key={activity.key} type="button" onClick={() => onSelect(activity.key)} className={`grid w-full grid-cols-[3.25rem_1fr] gap-3 border-b border-zinc-100 px-3 py-4 text-left transition last:border-0 ${selected ? (isCommunity ? "bg-[#F1FBF8]" : "bg-ipn-light") : "hover:bg-zinc-50"}`} aria-pressed={selected}>
            <span className="text-center">
              <span className={`block text-[10px] font-semibold uppercase ${isCommunity ? "text-[#176B5B]" : "text-ipn"}`}>{date.weekday}</span>
              <span className="block text-lg font-semibold text-zinc-900">{date.day}</span>
              <span className="block text-[10px] uppercase text-zinc-400">{date.month}</span>
            </span>
            <span className="min-w-0">
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${isCommunity ? "bg-[#E4F6F1] text-[#176B5B]" : "bg-white text-ipn ring-1 ring-ipn/10"}`}>
                {isCommunity ? "Community" : activity.event.event_type}
              </span>
              <span className="mt-2 block text-sm font-semibold leading-5 text-zinc-900">{title}</span>
              <span className="mt-1 block truncate text-xs text-zinc-500">
                {location}{activity.kind === "event" && activity.event.is_registered ? " · Registered" : ""}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function UpcomingAgenda({ events, conferences }: { events: EventWithRegistration[]; conferences: ConferenceRecord[] }) {
  const activities = useMemo<AgendaActivity[]>(() => [
    ...events.map((event) => ({ key: `event:${event.id}`, kind: "event" as const, startsAt: event.starts_at, event })),
    ...conferences.flatMap((conference) => conference.meetups.map((meetup) => ({ key: `community:${conference.id}:${meetup.id}`, kind: "community" as const, startsAt: meetup.startsAt, item: { meetup, conference } }))),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [conferences, events])
  const [selectedKey, setSelectedKey] = useState(activities[0]?.key)
  const selected = activities.find((activity) => activity.key === selectedKey) ?? activities[0]
  if (!selected) return null

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-zinc-900">Upcoming IPN events</h2>
        <p className="mt-1 text-sm text-zinc-500">IPN Labs, member meetups, and community programming in one chronological agenda.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <AgendaList activities={activities} selectedKey={selected.key} onSelect={setSelectedKey} />
        {selected.kind === "event" ? (
          <EventCard key={selected.event.id} event={selected.event} variant="featured" />
        ) : (
          <CommunityEventDetail key={selected.key} item={selected.item} />
        )}
      </div>
    </section>
  )
}
