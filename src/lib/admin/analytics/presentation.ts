import type { AnalyticsDataSource } from "./types"
import type { PortalAnalyticsRefreshSource } from "@/lib/portal-analytics/types"

export type AnalyticsGranularity = "daily" | "weekly" | "monthly"

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function numericDate(date: Date) {
  return `${date.getUTCMonth() + 1}/${String(date.getUTCDate()).padStart(2, "0")}`
}

export function analyticsGranularityBucket(date: Date, granularity: AnalyticsGranularity) {
  if (granularity === "daily") {
    const key = isoDate(date)
    return { key, label: key }
  }

  if (granularity === "monthly") {
    const key = isoDate(date).slice(0, 7)
    return { key, label: key }
  }

  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const daysSinceMonday = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - daysSinceMonday)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)

  return {
    key: isoDate(start),
    label: `${numericDate(start)}–${numericDate(end)}`,
  }
}

function timestamp(value: string | null | undefined) {
  if (!value) return null
  const milliseconds = new Date(value).getTime()
  return Number.isNaN(milliseconds) ? null : milliseconds
}

export function analyticsSourceIsHealthy(status: string | null | undefined, refreshedAt: string | null | undefined) {
  if (!refreshedAt) return false
  const normalized = status?.toLowerCase() ?? ""
  return normalized === "success"
    || normalized === "warning"
    || normalized === "watch"
    || normalized === "basic"
    || normalized === "live"
    || normalized === "active"
    || normalized === "snapshot"
}

export function resolveExternalSourceConnection(
  snapshotSource: AnalyticsDataSource | undefined,
  refreshSource: PortalAnalyticsRefreshSource | undefined,
  refreshFinishedAt: string | null | undefined,
) {
  const snapshotStatusAt = timestamp(snapshotSource?.lastAttemptedAt ?? snapshotSource?.lastPull)
  const refreshStatusAt = timestamp(
    refreshSource?.lastAttemptedAt ?? refreshSource?.lastRefreshedAt ?? refreshFinishedAt,
  )
  const useSnapshot = Boolean(snapshotSource) && (
    !refreshSource || (snapshotStatusAt != null && (refreshStatusAt == null || snapshotStatusAt > refreshStatusAt))
  )

  if (useSnapshot) {
    const refreshedAt = snapshotSource?.lastPull ?? null
    return {
      refreshedAt,
      healthy: analyticsSourceIsHealthy(snapshotSource?.status, refreshedAt),
      statusSource: "snapshot" as const,
    }
  }

  const refreshedAt = refreshSource?.lastRefreshedAt
    ?? refreshSource?.lastSuccessfulAt
    ?? refreshSource?.lastAttemptedAt
    ?? refreshFinishedAt
    ?? snapshotSource?.lastPull
    ?? null
  return {
    refreshedAt,
    healthy: analyticsSourceIsHealthy(refreshSource?.status ?? snapshotSource?.status, refreshedAt),
    statusSource: refreshSource ? "refresh" as const : "snapshot" as const,
  }
}

export function snapshotSupersedesRefresh(snapshotGeneratedAt: string, refreshFinishedAt: string | null | undefined) {
  const snapshotTime = timestamp(snapshotGeneratedAt)
  const refreshTime = timestamp(refreshFinishedAt)
  return snapshotTime != null && (refreshTime == null || snapshotTime > refreshTime)
}
