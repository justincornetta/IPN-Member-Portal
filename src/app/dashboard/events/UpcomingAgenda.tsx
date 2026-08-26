"use client"

import { useState } from "react"
import EventCard from "@/components/events/EventCard"
import type { EventWithRegistration } from "@/lib/events/types"

function dateParts(value: string) {
  const date = new Date(value)
  return {
    month: new Intl.DateTimeFormat("en", { month: "short" }).format(date),
    day: new Intl.DateTimeFormat("en", { day: "numeric" }).format(date),
    weekday: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
  }
}

function AgendaList({ events, selectedId, onSelect }: { events: EventWithRegistration[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <div className="max-h-[34rem] overflow-y-auto overscroll-contain rounded-xl border border-zinc-200 bg-white" aria-label="Upcoming events agenda">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <p className="text-sm font-semibold text-zinc-900">Upcoming events</p>
        <p className="mt-0.5 text-xs text-zinc-500">Select an event to see details</p>
      </div>
      {events.map((event) => {
        const date = dateParts(event.starts_at)
        const selected = event.id === selectedId
        return (
          <button key={event.id} type="button" onClick={() => onSelect(event.id)} className={`grid w-full grid-cols-[3.25rem_1fr] gap-3 border-b border-zinc-100 px-3 py-4 text-left last:border-0 ${selected ? "bg-ipn-light" : "hover:bg-zinc-50"}`} aria-pressed={selected}>
            <span className="text-center">
              <span className="block text-[10px] font-semibold uppercase text-ipn">{date.weekday}</span>
              <span className="block text-lg font-semibold text-zinc-900">{date.day}</span>
              <span className="block text-[10px] uppercase text-zinc-400">{date.month}</span>
            </span>
            <span className="min-w-0">
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-ipn ring-1 ring-ipn/10">{event.event_type}</span>
              <span className="mt-2 block text-sm font-semibold leading-5 text-zinc-900">{event.title}</span>
              <span className="mt-1 block truncate text-xs text-zinc-500">{event.location_label ?? "Online"}{event.is_registered ? " · Registered" : ""}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default function UpcomingAgenda({ events }: { events: EventWithRegistration[] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id)
  const selected = events.find((event) => event.id === selectedId) ?? events[0]
  if (!selected) return null

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-zinc-900">Upcoming IPN events</h2>
        <p className="mt-1 text-sm text-zinc-500">IPN Labs, member meetups, and community programming.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <AgendaList events={events} selectedId={selected.id} onSelect={setSelectedId} />
        <EventCard key={selected.id} event={selected} variant="featured" />
      </div>
    </section>
  )
}
