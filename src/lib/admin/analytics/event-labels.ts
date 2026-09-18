export type AnalyticsEventProgram = "IPN Labs" | "PsychedelX" | "Community" | "Other"
export type EventLabelOverride = { event_id: string; program_label: AnalyticsEventProgram; event_type: "public" | "internal"; include_in_analytics: boolean }
export type LabelableEvent = {
  id: string; topic: string; date: string | null; program: string; type: string
  includeInAnalytics?: boolean; inclusionStatus?: string; portalExternalEventId?: string | null
  source?: string; sourceLabel?: string
}

export function eventLabels(event: Pick<LabelableEvent, "id" | "program" | "type" | "includeInAnalytics" | "inclusionStatus" | "portalExternalEventId">, overrides: EventLabelOverride[]) {
  const override = overrides.find((row) => row.event_id === event.id)
    ?? overrides.find((row) => row.event_id === event.portalExternalEventId)
  return {
    program: override?.program_label ?? event.program,
    type: override?.event_type ?? event.type,
    includeInAnalytics: override?.include_in_analytics ?? (event.includeInAnalytics !== false && event.inclusionStatus !== "excluded"),
  }
}

// The editor is intentionally unfiltered: internal/excluded records must remain editable.
export function eventLabelCatalog(...sources: LabelableEvent[][]) {
  const byId = new Map<string, LabelableEvent>()
  for (const event of sources.flat()) if (!byId.has(event.id)) byId.set(event.id, event)
  return [...byId.values()].sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0) || a.topic.localeCompare(b.topic))
}

export function inventoryProgramMatches(program: string, filter: string) {
  return filter === "all" || program === filter
}
