export function formatConferenceDateRange(startsAt: string, endsAt: string, timezone: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()

  const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: timezone })
  const dayOnly = new Intl.DateTimeFormat("en", { day: "numeric", timeZone: timezone })
  const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: timezone })

  if (sameMonth) {
    return `${monthDay.format(start)}–${dayOnly.format(end)}, ${year.format(end)}`
  }

  return `${monthDay.format(start)} – ${monthDay.format(end)}, ${year.format(end)}`
}

function meetupDateKey(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function formatMeetupDateTime(startsAt: string, timezone: string, endsAt?: string | null) {
  const start = new Date(startsAt)
  const startFormatter = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  })
  const formattedStart = startFormatter.format(start)
  if (!endsAt) return formattedStart

  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return formattedStart
  const sameDay = meetupDateKey(start, timezone) === meetupDateKey(end, timezone)
  const endFormatter = new Intl.DateTimeFormat("en", sameDay
    ? { hour: "numeric", minute: "2-digit", timeZone: timezone }
    : { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone })

  return `${formattedStart}–${endFormatter.format(end)}`
}
