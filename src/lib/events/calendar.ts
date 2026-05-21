import type { EventRecord } from "./types"

const JOIN_WINDOW_MINUTES = 15

function toUtcCalendarStamp(value: string): string {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

export function formatEventDateTime(
  startsAt: string,
  endsAt: string | null,
  timezone: string,
): string {
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : null

  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(start)

  const startTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(start)

  if (!end) return `${date} at ${startTime}`

  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  }).format(end)

  return `${date}, ${startTime} - ${endTime}`
}

export function registrationBand(count: number): string | null {
  if (count < 10) return null
  return `${Math.floor(count / 10) * 10}+ registered`
}

export function canJoinEvent(startsAt: string, now = new Date()): boolean {
  const opensAt = new Date(startsAt).getTime() - JOIN_WINDOW_MINUTES * 60 * 1000
  return now.getTime() >= opensAt
}

export function joinWindowMessage(startsAt: string, timezone: string): string {
  const opensAt = new Date(
    new Date(startsAt).getTime() - JOIN_WINDOW_MINUTES * 60 * 1000,
  )
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  }).format(opensAt)

  return `This event has not started yet. The join button opens 15 minutes before the event, at ${formatted}.`
}

export function buildCalendarDescription(event: EventRecord): string {
  const parts = [
    event.summary,
    event.description,
    "You can join from the link in your email or through the IPN member portal. The event opens 15 minutes before the scheduled start time.",
  ]

  if (event.join_url) parts.push(`Join link: ${event.join_url}`)

  return parts.filter(Boolean).join("\n\n")
}

export function buildGoogleCalendarUrl(event: EventRecord): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcCalendarStamp(event.starts_at)}/${toUtcCalendarStamp(
      event.ends_at ?? event.starts_at,
    )}`,
    details: buildCalendarDescription(event),
    location: event.location_label ?? event.location_details ?? "Online",
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcsContent(event: EventRecord): string {
  const description = buildCalendarDescription(event)
  const location = event.location_label ?? event.location_details ?? "Online"

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IPN//Member Portal//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@members.ipn.org`,
    `DTSTAMP:${toUtcCalendarStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcCalendarStamp(event.starts_at)}`,
    `DTEND:${toUtcCalendarStamp(event.ends_at ?? event.starts_at)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}
