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

export function formatMeetupDateTime(startsAt: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(startsAt))
}
