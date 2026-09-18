export type InventoryRegistration = { name: string; email: string; registeredAt: string | null }

export function isPublicInventoryZoomEvent(event: {
  id: string; type: string; inclusionStatus?: string; includeInAnalytics?: boolean; portalExternalEventId?: string | null
}, overrides: { event_id: string; event_type: string; include_in_analytics: boolean }[] = []) {
  const override = overrides.find((row) => row.event_id === event.id)
    ?? overrides.find((row) => row.event_id === event.portalExternalEventId)
  if (override) return override.event_type === "public" && override.include_in_analytics
  return event.type === "public" && event.inclusionStatus !== "excluded" && event.includeInAnalytics !== false
}

// Portal rows are passed first, so their names and timestamps win known overlaps.
// Do not merge unrelated people just because they share a name.
export function mergeInventoryRegistrations(...sources: InventoryRegistration[][]) {
  const seenEmails = new Set<string>()
  const result: InventoryRegistration[] = []
  for (const row of sources.flat()) {
    const email = row.email.trim().toLowerCase()
    if (email && seenEmails.has(email)) continue
    if (email) seenEmails.add(email)
    result.push(row)
  }
  return result.sort((a, b) => (a.registeredAt ?? "9999").localeCompare(b.registeredAt ?? "9999") || a.name.localeCompare(b.name))
}

export function inventoryRegistrationTrend(registrations: InventoryRegistration[], dailyCounts?: { date: string; tickets: number }[]) {
  const counts = new Map<string, number>()
  for (const row of registrations) {
    if (!row.registeredAt || !Number.isFinite(Date.parse(row.registeredAt))) continue
    const date = new Date(row.registeredAt).toISOString().slice(0, 10)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  if (dailyCounts) {
    for (const row of dailyCounts) {
      if (!Number.isFinite(Date.parse(row.date)) || !Number.isFinite(row.tickets) || row.tickets < 0) continue
      const date = new Date(row.date).toISOString().slice(0, 10)
      counts.set(date, (counts.get(date) ?? 0) + row.tickets)
    }
  }
  let cumulative = 0
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, daily]) => {
    cumulative += daily
    return { date, daily, cumulative }
  })
}

export function inventoryRegistrationCount(event: { status: "live" | "upcoming" | "past"; activeRsvps: number | null; totalRegistrations: number | null }) {
  return event.status === "past" ? event.totalRegistrations ?? event.activeRsvps : event.activeRsvps ?? event.totalRegistrations
}
