"use client"

import { useMemo, useSyncExternalStore } from "react"
import { formatEventDateTime } from "@/lib/events/calendar"

type Props = {
  startsAt: string
  endsAt?: string | null
  timezone: string
  className?: string
  secondaryClassName?: string
  secondaryPrefix?: string
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return null
  }
}

export default function EventDateTime({
  startsAt,
  endsAt = null,
  timezone,
  className,
  secondaryClassName,
  secondaryPrefix = "Event time",
}: Props) {
  const viewerTimezone = useSyncExternalStore(
    () => () => {},
    browserTimezone,
    () => null,
  )

  const displayTimezone = viewerTimezone ?? timezone
  const primary = useMemo(
    () => formatEventDateTime(startsAt, endsAt, displayTimezone),
    [displayTimezone, endsAt, startsAt],
  )
  const eventTime = useMemo(
    () => formatEventDateTime(startsAt, endsAt, timezone),
    [endsAt, startsAt, timezone],
  )
  const showSecondary = Boolean(viewerTimezone && viewerTimezone !== timezone)

  return (
    <span className={className}>
      {primary}
      {showSecondary && (
        <span className={secondaryClassName ? `block ${secondaryClassName}` : "block text-[11px] text-zinc-400"}>
          {secondaryPrefix}: {eventTime}
        </span>
      )}
    </span>
  )
}
