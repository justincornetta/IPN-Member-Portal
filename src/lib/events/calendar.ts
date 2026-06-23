import type { EventRecord } from "./types"

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
    timeZoneName: end ? undefined : "short",
    timeZone: timezone,
  }).format(start)

  if (!end) return `${date} at ${startTime}`

  const endDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(end)

  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timezone,
  }).format(end)

  if (date !== endDate) return `${date}, ${startTime} - ${endDate}, ${endTime}`

  return `${date}, ${startTime} - ${endTime}`
}

export function registrationBand(count: number): string | null {
  if (count < 10) return null
  return `${Math.floor(count / 10) * 10}+ registered`
}

export function canJoinEvent(startsAt: string, timezone: string, now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(now) >= fmt.format(new Date(startsAt))
}

export function buildCalendarDescription(event: EventRecord): string {
  const parts = [
    event.summary,
    event.description,
    "You can join from the link in your email or through the IPN member portal.",
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

export function buildOutlookCalendarUrl(event: EventRecord): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.starts_at).toISOString(),
    enddt: new Date(event.ends_at ?? event.starts_at).toISOString(),
    body: buildCalendarDescription(event),
    location: event.location_label ?? event.location_details ?? "Online",
  })

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function buildIcsContent(event: EventRecord): string {
  const description = buildCalendarDescription(event)
  const location = event.location_label ?? event.location_details ?? "Online"

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IPN//Member Portal//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@members.intercollegiatepsychedelics.net`,
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
