export type PortalAnalyticsRefreshRunStatus = "running" | "success" | "partial_failure" | "failed"

export type PortalAnalyticsRefreshSourceStatus = "success" | "warning" | "error"

export type PortalAnalyticsRefreshSource = {
  id: string
  label: string
  status: PortalAnalyticsRefreshSourceStatus
  lastRefreshedAt: string | null
  records: number | null
  note: string | null
}

export type PortalAnalyticsRefreshRun = {
  id: string
  startedAt: string
  finishedAt: string | null
  status: PortalAnalyticsRefreshRunStatus
  trigger: string
  sources: PortalAnalyticsRefreshSource[]
  summary: Record<string, unknown>
  errorMessage: string | null
  createdAt: string
}
