// Pure helpers shared by admin content-intake server actions (events,
// resources, conferences). Not "use server" — these are plain sync
// functions, which a server-actions file cannot export directly.

export function clean(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

export function toIso(value: string | null | undefined) {
  const trimmed = clean(value)
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function parseDateTimeLocal(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  }
}

function timeZoneOffsetMs(timezone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  )

  return asUtc - date.getTime()
}

export function toIsoInTimeZone(
  value: string | null | undefined,
  timezone: string,
): string | null {
  const trimmed = clean(value)
  if (!trimmed) return null

  if (!parseDateTimeLocal(trimmed)) return toIso(trimmed)

  const local = parseDateTimeLocal(trimmed)
  if (!local) return null

  let utcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  )

  utcMs -= timeZoneOffsetMs(timezone, new Date(utcMs))
  utcMs =
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    ) - timeZoneOffsetMs(timezone, new Date(utcMs))

  const date = new Date(utcMs)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
