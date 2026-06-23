"use client"

import { useState } from "react"
import {
  buildGoogleCalendarUrl,
  buildIcsContent,
  buildOutlookCalendarUrl,
} from "@/lib/events/calendar"
import EventDateTime from "@/components/events/EventDateTime"
import type { EventRecord } from "@/lib/events/types"

type Props = {
  event: EventRecord
  compact?: boolean
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer")
}

export default function AddToCalendarButton({ event, compact = false }: Props) {
  const [open, setOpen] = useState(false)

  function openAppleCalendar() {
    const blob = new Blob([buildIcsContent(event)], {
      type: "text/calendar;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    openInNewTab(url)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md border border-zinc-200 bg-white font-medium text-zinc-600 transition hover:border-ipn/30 hover:bg-zinc-50 hover:text-zinc-900 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
        }`}
      >
        Add to Calendar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">
                  Add to Calendar
                </h2>
                <p className="mt-1 text-sm text-zinc-500">{event.title}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  <EventDateTime
                    startsAt={event.starts_at}
                    endsAt={event.ends_at}
                    timezone={event.timezone}
                  />
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Close calendar modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => openInNewTab(buildGoogleCalendarUrl(event))}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:bg-ipn/5"
              >
                Google Calendar
              </button>
              <button
                type="button"
                onClick={openAppleCalendar}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:bg-ipn/5"
              >
                Apple Calendar
              </button>
              <button
                type="button"
                onClick={() => openInNewTab(buildOutlookCalendarUrl(event))}
                className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:bg-ipn/5"
              >
                Outlook Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
