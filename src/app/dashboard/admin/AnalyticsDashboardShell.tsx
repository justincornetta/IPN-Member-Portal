"use client"

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react"
import type { CSSProperties, ReactElement, ReactNode } from "react"
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapLayerMouseEvent,
} from "mapbox-gl"
import type { FeatureCollection, Point } from "geojson"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { getMemberDirectoryDetail, saveAnalyticsEventLabelOverride } from "@/lib/admin/actions"
import type { AnalyticsEventLabelOverride } from "@/lib/admin/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import type { AnalyticsPoint, LegacyAnalyticsSnapshot } from "@/lib/admin/analytics/types"
import type { PortalAnalyticsRefreshRun } from "@/lib/portal-analytics/types"
import type {
  MemberDirectoryData,
  MemberDirectoryDetail,
  MemberDirectoryRow,
  MemberDirectorySources,
} from "@/lib/admin/analytics/member-directory-types"

const ANALYTICS_SECTIONS = [
  { id: "members", label: "Members", title: "Member analytics", description: "Live Portal membership and legacy membership source-of-truth data." },
  { id: "community", label: "Community", title: "Community analytics", description: "WhatsApp and current community engagement model." },
  { id: "marketing", label: "Marketing", title: "Marketing analytics", description: "Mailchimp audience, campaign, and acquisition performance." },
  { id: "social-media", label: "Social Media", title: "Social media analytics", description: "Instagram, Facebook, and manually tracked social channels." },
  { id: "website", label: "Website", title: "Website analytics", description: "GA4 traffic, acquisition, page, and conversion performance." },
  { id: "events", label: "Events", title: "Events analytics", description: "Zoom attendance and Eventbrite registration performance." },
  { id: "data-sources", label: "Data Sources & Glossary", title: "Data sources & glossary", description: "Connected platform feeds, refresh status, and metric definitions." },
] as const

type AnalyticsSectionId = (typeof ANALYTICS_SECTIONS)[number]["id"]
type MemberAnalyticsView = "members" | "utilization"
type EventsView = "zoom" | "eventbrite" | "labeling"
type WebsiteGeoView = "countries" | "cities"
type Granularity = "daily" | "weekly" | "monthly"
type EventbriteMetric = "tickets" | "revenue"
type SocialMetric = "followers" | "engagementRate" | "posts"
type DeviceFilter = "all" | "desktop" | "mobile" | "tablet" | "unknown"
type AnalyticsEventProgram = "IPN Labs" | "PsychedelX" | "Other"
type AnalyticsEventType = "public" | "internal"
type LiveConnectionStatus = {
  label: string
  refreshedAt: string | null
  healthy: boolean
}

export type MemberInsightsData = {
  total: number
  discoverable: number
  withTags: number
  whatsappLinked: number
  whatsappOnboardingComplete: number
  registrationTrend: {
    month: string
    registrations: number
    cumulative: number
  }[]
  personaItems: [string, number][]
  fieldItems: [string, number][]
  topTags: [string, number][]
  topSchools: [string, number][]
  topCountries: [string, number][]
  profiles: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    persona: string | null
    field: string | null
    interest_tags: string[] | null
    school: string | null
    country: string | null
    is_discoverable: boolean | null
    created_at: string | null
  }[]
  recent: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    persona: string | null
    created_at: string
    mailchimp_status: MailchimpStatus | null
    mailchimp_last_error_raw: unknown
    mailchimp_last_error_description: string | null
  }[] | null
  memberDirectory: MemberDirectoryData
}

export type PortalUtilizationData = {
  generatedAt: string
  rawRetentionDays: number
  trackingAvailable: boolean
  trackingError: string | null
  funnel: {
    date: string
    device: string
    registrationTraffic: number
    registrationCompleted: number
    registrationConversion: number
    signInTraffic: number
    signInCompleted: number
    signInConversion: number
  }[]
  errors: {
    page: string
    errorCode: string
    count: number
  }[]
  topPages: {
    page: string
    device: string
    sessions: number
    users: number
    avgDurationSeconds: number
    clicks: number
    clicksPerSession: number
  }[]
  topClicks: {
    clickName: string
    page: string
    device: string
    clicks: number
    users: number
    sessions: number
  }[]
  recentSessions: {
    sessionId: string
    memberName: string
    memberEmail: string
    startedAt: string
    lastSeenAt: string
    pages: number
    clicks: number
    durationSeconds: number
    lastPage: string
  }[]
  rsvpTrend: {
    date: string
    rsvps: number
  }[]
  trafficDevices: {
    label: string
    sessions: number
    users: number
  }[]
  recentRsvps: {
    memberName: string
    memberEmail: string
    eventTitle: string
    createdAt: string
  }[]
  whatsapp: {
    linkedProfiles: number
    onboardingComplete: number
    totalMembers: number
  }
}

export type PortalAnalyticsEvent = {
  id: string
  title: string
  slug: string | null
  startsAt: string | null
  eventType: string | null
  status: string | null
  externalEventId: string | null
  registrationCount: number
  registrations: {
    memberName: string
    memberEmail: string
    registeredAt: string
  }[]
}

type Props = {
  memberInsights: MemberInsightsData | null
  portalUtilization: PortalUtilizationData
  analyticsSnapshot: LegacyAnalyticsSnapshot
  analyticsRefresh: PortalAnalyticsRefreshRun | null
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  portalEvents: PortalAnalyticsEvent[]
  isSuperadmin: boolean
}

function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "-"
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value)
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "-"
  return `${formatNumber(value, digits)}%`
}

function roundMetric(value: number, digits = 1) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function tooltipFormatter(value: unknown, name: unknown): [ReactNode, string] {
  const numeric = typeof value === "number" ? value : Number(value)
  const label = String(name)
  if (Number.isNaN(numeric)) return [String(value), label]
  const lowerLabel = label.toLowerCase()
  if (lowerLabel.includes("rate") || lowerLabel.includes("retention")) {
    return [formatPercent(numeric), label]
  }
  if (lowerLabel.includes("revenue")) {
    return [formatCurrency(numeric), label]
  }
  return [formatNumber(numeric, 1), label]
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date)
}

function formatConnectionDateTime(value: string | null | undefined) {
  if (!value) return "Not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const hour = String(date.getUTCHours()).padStart(2, "0")
  const minute = String(date.getUTCMinutes()).padStart(2, "0")
  return `${month}/${day} ${hour}:${minute} UTC`
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return null
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, month, day, year] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toInputDate(value: string | null | undefined) {
  const date = parseDateValue(value)
  return date ? date.toISOString().slice(0, 10) : ""
}

function websiteDateToInput(value: string | null | undefined) {
  if (!value) return ""
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : toInputDate(value)
}

function isWithinDateRange(value: string | null | undefined, from: string, to: string) {
  const date = parseDateValue(value)
  if (!date) return true
  if (from && date < new Date(`${from}T00:00:00Z`)) return false
  if (to && date > new Date(`${to}T23:59:59Z`)) return false
  return true
}

function aggregateByGranularity<T extends Record<string, number>>(
  rows: { date: string | null; values: T }[],
  granularity: Granularity,
) {
  const buckets = new Map<string, { label: string; values: Record<string, number> }>()
  for (const row of rows) {
    const date = parseDateValue(row.date)
    if (!date) continue
    const label = granularityLabel(date, granularity)
    const current = buckets.get(label) ?? { label, values: {} }
    for (const [key, value] of Object.entries(row.values)) {
      current.values[key] = (current.values[key] ?? 0) + value
    }
    buckets.set(label, current)
  }
  return Array.from(buckets.values())
    .map((bucket) => ({ label: bucket.label, ...bucket.values }) as T & { label: string })
    .sort((a, b) => a.label.localeCompare(b.label))
}

function granularityLabel(date: Date, granularity: Granularity) {
  return granularity === "daily"
    ? date.toISOString().slice(0, 10)
    : granularity === "weekly"
      ? `${date.getUTCFullYear()} W${String(Math.ceil((((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)).padStart(2, "0")}`
      : date.toISOString().slice(0, 7)
}

function dateStep(granularity: Granularity) {
  return granularity === "daily" ? 1 : granularity === "weekly" ? 7 : 32
}

function fillMetricBuckets<T extends Record<string, number>>(
  rows: (T & { label: string })[],
  granularity: Granularity,
  dateValues: (string | null | undefined)[],
  zeroValues: T,
) {
  const dates = dateValues
    .map((value) => parseDateValue(value))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())
  if (!dates.length) return rows

  const byLabel = new Map(rows.map((row) => [row.label, row]))
  const filled: (T & { label: string })[] = []
  const cursor = new Date(Date.UTC(dates[0].getUTCFullYear(), dates[0].getUTCMonth(), dates[0].getUTCDate()))
  const end = dates.at(-1)!
  while (cursor <= end) {
    const label = aggregateByGranularity([{ date: cursor.toISOString(), values: zeroValues }], granularity)[0]?.label
    if (label && !filled.some((row) => row.label === label)) {
      filled.push(byLabel.get(label) ?? ({ label, ...zeroValues } as T & { label: string }))
    }
    cursor.setUTCDate(cursor.getUTCDate() + dateStep(granularity))
    if (granularity === "monthly") cursor.setUTCDate(1)
  }

  return filled.sort((a, b) => a.label.localeCompare(b.label))
}

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null || Number.isNaN(minutes)) return "-"
  if (minutes < 60) return `${formatNumber(minutes, 0)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

function formatSeconds(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return "-"
  if (seconds < 60) return `${formatNumber(seconds, 0)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  if (minutes < 60) return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hours}h ${mins}m` : `${hours}h`
}

function truncate(value: string, length = 72) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="flex min-h-32 flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-4 text-3xl font-semibold tabular-nums text-zinc-900">{value}</div>
      {helper && <p className="mt-2 text-sm text-zinc-500">{helper}</p>}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        {subtitle && <p className="mt-1 text-xs leading-5 text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  )
}

function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </label>
  )
}

const inputClassName = "h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 shadow-sm outline-none transition focus:border-ipn focus:ring-2 focus:ring-ipn/10"

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`cursor-pointer ${inputClassName}`}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
      <button type="button" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40">Previous</button>
      <span className="text-xs text-zinc-400">Page {page + 1} of {totalPages}</span>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40">Next</button>
    </div>
  )
}

function SourceFreshnessNote({
  source,
  detail,
  analyticsRefresh,
}: {
  source: LegacyAnalyticsSnapshot["dataSources"][number] | undefined
  detail?: string
  analyticsRefresh?: PortalAnalyticsRefreshRun | null
}) {
  if (!source) return null
  const portalRefreshedAt = analyticsRefresh?.finishedAt ?? analyticsRefresh?.startedAt ?? null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      <span className="font-semibold">{source.label} source snapshot:</span> last pulled {formatDate(source.lastPull)}. {detail ?? source.note}
      {portalRefreshedAt ? ` Portal refresh completed ${formatDateTime(portalRefreshedAt)}.` : ""}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className =
    normalized === "live" || normalized === "active" || normalized === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : normalized === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : normalized === "watch" || normalized === "basic"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"

  return (
    <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${className}`}>
      {status}
    </span>
  )
}

function RefreshBadge({ refresh, fallbackGeneratedAt }: { refresh: PortalAnalyticsRefreshRun | null; fallbackGeneratedAt: string }) {
  const refreshedAt = refresh?.finishedAt ?? refresh?.startedAt ?? fallbackGeneratedAt
  const label = refresh
    ? refresh.status === "success"
      ? `Last refreshed ${formatDateTime(refreshedAt)}`
      : `${refresh.status.replace("_", " ")} ${formatDateTime(refreshedAt)}`
    : `Snapshot generated ${formatDateTime(fallbackGeneratedAt)}`
  const status = refresh?.status ?? "snapshot"
  const className =
    status === "success"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-700"
        : status === "running"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"

  return (
    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function sourceIsHealthy(status: string | null | undefined, refreshedAt: string | null | undefined) {
  if (!refreshedAt) return false
  const normalized = status?.toLowerCase() ?? ""
  return normalized === "success" || normalized === "warning" || normalized === "live" || normalized === "active" || normalized === "snapshot"
}

function buildLiveConnectionStatuses(
  snapshot: LegacyAnalyticsSnapshot,
  analyticsRefresh: PortalAnalyticsRefreshRun | null,
): LiveConnectionStatus[] {
  const byId = new Map(snapshot.dataSources.map((source) => [source.id, source]))
  const refreshById = new Map((analyticsRefresh?.sources ?? []).map((source) => [source.id, source]))
  const externalSources: { id: string; label: string }[] = [
    { id: "instagram", label: "Instagram" },
    { id: "facebook", label: "Facebook" },
    { id: "website", label: "GA4" },
    { id: "zoom", label: "Zoom" },
    { id: "eventbrite", label: "Eventbrite" },
    { id: "mailchimp", label: "Mailchimp" },
    { id: "donations", label: "Donations" },
  ]
  const connections = externalSources.map(({ id, label }) => {
    const refreshSource = refreshById.get(id)
    const snapshotSource = byId.get(id)
    const refreshedAt = refreshSource?.lastRefreshedAt ?? snapshotSource?.lastPull ?? null
    return {
      label: refreshSource?.label ?? label,
      refreshedAt,
      healthy: refreshSource ? sourceIsHealthy(refreshSource.status, refreshedAt) : sourceIsHealthy(snapshotSource?.status, refreshedAt),
    }
  })

  const portalSourceLabels: Record<string, string> = {
    member_profiles: "Supabase (Membership)",
    member_source_of_truth: "Supabase (Member SoT)",
    portal_usage_events: "Supabase (Portal Usage)",
    portal_event_registrations: "Supabase (Event RSVPs)",
  }

  if (analyticsRefresh) {
    for (const [id, label] of Object.entries(portalSourceLabels)) {
      const source = refreshById.get(id)
      connections.push({
        label,
        refreshedAt: source?.lastRefreshedAt ?? analyticsRefresh.finishedAt ?? analyticsRefresh.startedAt,
        healthy: sourceIsHealthy(source?.status, source?.lastRefreshedAt ?? analyticsRefresh.finishedAt ?? analyticsRefresh.startedAt),
      })
    }
  } else {
    connections.push({
      label: "Supabase (Membership)",
      refreshedAt: null,
      healthy: false,
    })
  }

  return connections
}

function LiveConnectionsStrip({
  snapshot,
  analyticsRefresh,
}: {
  snapshot: LegacyAnalyticsSnapshot
  analyticsRefresh: PortalAnalyticsRefreshRun | null
}) {
  const connections = useMemo(
    () => buildLiveConnectionStatuses(snapshot, analyticsRefresh),
    [analyticsRefresh, snapshot],
  )

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {connections.map((connection) => (
          <div key={connection.label} className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${connection.healthy ? "bg-green-500" : "bg-red-500"}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-zinc-800">{connection.label}</p>
              <p className="whitespace-nowrap text-[11px] text-zinc-500">Last refreshed {formatConnectionDateTime(connection.refreshedAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResponsiveChart({ children, height = 280 }: { children: ReactElement; height?: number }) {
  return (
    <div className="h-[var(--chart-height)] min-w-0" style={{ "--chart-height": `${height}px` } as CSSProperties}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function BarList({ items, valueLabel = formatNumber }: { items: AnalyticsPoint[]; valueLabel?: (value: number) => string }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  if (items.length === 0) {
    return <p className="text-sm text-zinc-400">No data for the current filters.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0">
            <div className="flex justify-between gap-3 text-xs text-zinc-600">
              <span className="truncate">{item.label}</span>
              <span className="flex-shrink-0 tabular-nums text-zinc-400">{valueLabel(item.value)}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-ipn" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function sampleSize(items: AnalyticsPoint[]) {
  return items.reduce((sum, item) => sum + item.value, 0)
}

function sampleSubtitle(items: AnalyticsPoint[], unit = "responses") {
  return `n=${formatNumber(sampleSize(items))} ${unit}`
}

function PaginatedBarList({
  items,
  pageSize = 10,
  valueLabel = formatNumber,
}: {
  items: AnalyticsPoint[]
  pageSize?: number
  valueLabel?: (value: number) => string
}) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div>
      <BarList items={pageItems} valueLabel={valueLabel} />
      <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[]
  rows: Record<string, React.ReactNode>[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${column.align === "right" ? "text-right" : "text-left"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-zinc-50">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`max-w-[24rem] px-3 py-3 align-top text-zinc-600 ${column.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionTabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="overflow-x-auto border-b border-zinc-200">
      <div className="flex min-w-max">
        {items.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`cursor-pointer whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
              active === id
                ? "-mb-px border-b-2 border-ipn text-ipn"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function mailchimpBadge(status: MailchimpStatus | null) {
  switch (status) {
    case "subscribed":
      return { label: "Subscribed", className: "border-green-200 bg-green-50 text-green-700" }
    case "unsubscribed":
      return { label: "Unsubscribed", className: "border-zinc-200 bg-zinc-50 text-zinc-500" }
    case "pending":
      return { label: "Pending", className: "border-blue-200 bg-blue-50 text-blue-700" }
    case "cleaned":
      return { label: "Cleaned", className: "border-orange-200 bg-orange-50 text-orange-700" }
    case "transactional":
      return { label: "Transactional", className: "border-violet-200 bg-violet-50 text-violet-700" }
    case "sync_failed":
      return { label: "Sync failed", className: "border-red-200 bg-red-50 text-red-700" }
    case "not_found":
      return { label: "Not found", className: "border-zinc-200 bg-zinc-50 text-zinc-500" }
    default:
      return { label: "Unknown", className: "border-amber-200 bg-amber-50 text-amber-700" }
  }
}

const MEMBER_SOURCE_LABELS: { id: keyof MemberDirectorySources; label: string; short: string }[] = [
  { id: "portal", label: "Member Portal", short: "Portal" },
  { id: "form", label: "Google Form", short: "Form" },
  { id: "mailchimp", label: "Mailchimp", short: "MC" },
  { id: "oldapp", label: "IPN App", short: "IPN App" },
]

function sourceChipClass(source: keyof MemberDirectorySources) {
  switch (source) {
    case "portal":
      return "border-blue-200 bg-blue-50 text-blue-700"
    case "form":
      return "border-green-200 bg-green-50 text-green-700"
    case "mailchimp":
      return "border-yellow-200 bg-yellow-50 text-yellow-700"
    case "oldapp":
      return "border-zinc-200 bg-zinc-50 text-zinc-600"
    default:
      return "border-purple-200 bg-purple-50 text-purple-700"
  }
}

function incrementMemberCount(counts: Map<string, number>, label: string | null | undefined) {
  const cleaned = String(label ?? "").trim()
  if (!cleaned || cleaned === "-") return
  counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1)
}

function topMemberCounts(counts: Map<string, number>, limit = 12) {
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function buildFilteredMemberCharts(rows: MemberDirectoryRow[], directory: MemberDirectoryData) {
  const stage = new Map<string, number>()
  const field = new Map<string, number>()
  const tags = new Map<string, number>()
  const schools = new Map<string, number>()
  const describes = new Map<string, number>()
  const primary = new Map<string, number>()
  const referrals = new Map<string, number>()
  const psychedelic = new Map<string, number>()
  const barriers = new Map<string, number>()

  for (const row of rows) {
    incrementMemberCount(stage, row.persona)
    incrementMemberCount(field, row.primaryField)
    for (const tag of row.interestTags) incrementMemberCount(tags, tag)
    incrementMemberCount(schools, row.school)
    incrementMemberCount(describes, row.persona || row.selfDescription)
    incrementMemberCount(primary, row.primaryField)
    incrementMemberCount(referrals, row.referralSource)
    incrementMemberCount(psychedelic, row.psychedelicFieldStatus)
    for (const barrier of row.psychedelicFieldBarriers) incrementMemberCount(barriers, barrier)
  }

  return {
    stageBreakdown: topMemberCounts(stage),
    fieldBreakdown: topMemberCounts(field),
    topInterestTags: topMemberCounts(tags, 500),
    topSchools: topMemberCounts(schools, 10),
    bestDescribes: topMemberCounts(describes),
    primaryField: topMemberCounts(primary),
    referralSources: topMemberCounts(referrals),
    psychedelicFieldStatus: topMemberCounts(psychedelic),
    psychedelicFieldBarriers: topMemberCounts(barriers),
    gender: directory.chartData.gender,
    age: directory.chartData.age,
    raceEthnicity: directory.chartData.raceEthnicity,
  }
}

function geographyKey(city: string, state: string, country: string) {
  return [city, state, country].map((part) => part.trim().toLowerCase()).join("|")
}

function buildFilteredGeography(rows: MemberDirectoryRow[], directory: MemberDirectoryData): MemberDirectoryData["geography"] {
  const baseById = new Map(directory.geography.map((city) => [city.id, city]))
  const groups = new Map<string, MemberDirectoryData["geography"][number]>()

  for (const row of rows) {
    if (!row.city || !row.country) continue
    const id = geographyKey(row.city, row.state, row.country)
    const base = baseById.get(id)
    const current = groups.get(id) ?? {
      id,
      city: row.city,
      state: row.state,
      country: row.country,
      lat: base?.lat ?? null,
      lng: base?.lng ?? null,
      memberCount: 0,
      identifiableCount: 0,
      sourceCounts: MEMBER_SOURCE_LABELS.map((source) => ({ id: source.id, label: source.label, value: 0 })),
      members: [],
    }
    current.memberCount += 1
    current.identifiableCount += 1
    current.members.push({ id: row.id, name: row.name, email: row.email, sources: row.sources })
    for (const source of current.sourceCounts) {
      if (row.sources[source.id]) source.value += 1
    }
    groups.set(id, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.memberCount - a.memberCount || a.city.localeCompare(b.city))
}

function buildCountryGeography(cities: MemberDirectoryData["geography"]): MemberDirectoryData["geography"] {
  const countries = new Map<string, MemberDirectoryData["geography"][number] & { weightedLat: number; weightedLng: number; weightedCount: number }>()

  for (const city of cities) {
    if (!city.country) continue
    const id = `country:${city.country.toLowerCase()}`
    const current = countries.get(id) ?? {
      id,
      city: "",
      state: "",
      country: city.country,
      lat: null,
      lng: null,
      memberCount: 0,
      identifiableCount: 0,
      sourceCounts: MEMBER_SOURCE_LABELS.map((source) => ({ id: source.id, label: source.label, value: 0 })),
      members: [],
      weightedLat: 0,
      weightedLng: 0,
      weightedCount: 0,
    }
    current.memberCount += city.memberCount
    current.identifiableCount += city.identifiableCount
    current.members.push(...city.members)
    if (city.lat != null && city.lng != null) {
      current.weightedLat += city.lat * city.memberCount
      current.weightedLng += city.lng * city.memberCount
      current.weightedCount += city.memberCount
    }
    for (const source of current.sourceCounts) {
      const citySource = city.sourceCounts.find((item) => item.id === source.id)
      source.value += citySource?.value ?? 0
    }
    countries.set(id, current)
  }

  return Array.from(countries.values())
    .map((country) => ({
      id: country.id,
      city: "",
      state: "",
      country: country.country,
      lat: country.weightedCount ? country.weightedLat / country.weightedCount : null,
      lng: country.weightedCount ? country.weightedLng / country.weightedCount : null,
      memberCount: country.memberCount,
      identifiableCount: country.identifiableCount,
      sourceCounts: country.sourceCounts,
      members: country.members.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.country.localeCompare(b.country))
}

const MEMBER_GEO_SOURCE_ID = "admin-member-geography"
const MEMBER_GEO_CLUSTER_LAYER_ID = "admin-member-geography-clusters"
const MEMBER_GEO_CLUSTER_COUNT_LAYER_ID = "admin-member-geography-cluster-count"
const MEMBER_GEO_POINT_LAYER_ID = "admin-member-geography-points"
const MEMBER_GEO_POINT_COUNT_LAYER_ID = "admin-member-geography-point-count"

type MemberGeoFeatureProperties = {
  id: string
  label: string
  memberCount: number
}

type MemberGeoSource = GeoJSONSource & {
  getClusterExpansionZoom: (
    clusterId: number,
    callback: (error: Error | null, zoom: number) => void,
  ) => void
}

function buildMemberGeoJson(cities: MemberDirectoryData["geography"]): FeatureCollection<Point, MemberGeoFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: cities
      .filter((city) => city.lat != null && city.lng != null)
      .map((city) => ({
        type: "Feature",
        id: city.id,
        properties: {
          id: city.id,
          label: [city.city, city.state, city.country].filter(Boolean).join(", "),
          memberCount: city.memberCount,
        },
        geometry: {
          type: "Point",
          coordinates: [city.lng as number, city.lat as number],
        },
      })),
  }
}

function MembershipGeographyPanel({ cities }: { cities: MemberDirectoryData["geography"] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [geoView, setGeoView] = useState<"city" | "country">("city")
  const [selectedCityId, setSelectedCityId] = useState(cities[0]?.id ?? "")
  const [mapError, setMapError] = useState("")
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const activeLocations = useMemo(() => geoView === "country" ? buildCountryGeography(cities) : cities, [cities, geoView])
  const geoJson = useMemo(() => buildMemberGeoJson(activeLocations), [activeLocations])
  const geoJsonRef = useRef(geoJson)
  const selectedLocation = activeLocations.find((city) => city.id === selectedCityId) ?? activeLocations[0] ?? null
  const totalLocatedRecords = activeLocations.reduce((sum, city) => sum + city.memberCount, 0)
  const selectedLocationLabel = selectedLocation
    ? geoView === "country"
      ? selectedLocation.country
      : [selectedLocation.city, selectedLocation.state, selectedLocation.country].filter(Boolean).join(", ")
    : ""

  useEffect(() => {
    geoJsonRef.current = geoJson
  }, [geoJson])

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || mapRef.current) return
    try {
      mapboxgl.accessToken = mapboxToken
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-98.5795, 39.8283],
        zoom: 1.8,
      })
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left")
      map.on("error", (event) => setMapError(event.error?.message ?? "Mapbox could not load the map."))
      map.on("load", () => {
        map.addSource(MEMBER_GEO_SOURCE_ID, {
          type: "geojson",
          data: geoJsonRef.current,
          cluster: true,
          clusterMaxZoom: 7,
          clusterRadius: 54,
          clusterProperties: {
            memberCountSum: ["+", ["get", "memberCount"]],
          },
        })
        map.addLayer({
          id: MEMBER_GEO_CLUSTER_LAYER_ID,
          type: "circle",
          source: MEMBER_GEO_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#6f51aa",
            "circle-radius": ["step", ["get", "memberCountSum"], 18, 25, 24, 100, 32],
            "circle-opacity": 0.9,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        })
        map.addLayer({
          id: MEMBER_GEO_CLUSTER_COUNT_LAYER_ID,
          type: "symbol",
          source: MEMBER_GEO_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["to-string", ["get", "memberCountSum"]],
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
          },
        })
        map.addLayer({
          id: MEMBER_GEO_POINT_LAYER_ID,
          type: "circle",
          source: MEMBER_GEO_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#2563eb",
            "circle-radius": ["step", ["get", "memberCount"], 10, 10, 14, 30, 18],
            "circle-opacity": 0.9,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        })
        map.addLayer({
          id: MEMBER_GEO_POINT_COUNT_LAYER_ID,
          type: "symbol",
          source: MEMBER_GEO_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["to-string", ["get", "memberCount"]],
            "text-size": 11,
          },
          paint: {
            "text-color": "#ffffff",
          },
        })
      })
      map.on("click", MEMBER_GEO_CLUSTER_LAYER_ID, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        const clusterId = feature?.properties?.cluster_id
        const coordinates = feature?.geometry.type === "Point" ? feature.geometry.coordinates as [number, number] : null
        if (clusterId == null || !coordinates) return
        const source = map.getSource(MEMBER_GEO_SOURCE_ID) as MemberGeoSource
        source.getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (error || typeof zoom !== "number") return
          map.easeTo({ center: coordinates, zoom, duration: 450 })
        })
      })
      map.on("click", MEMBER_GEO_POINT_LAYER_ID, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0]
        const id = typeof feature?.properties?.id === "string" ? feature.properties.id : ""
        if (id) setSelectedCityId(id)
      })
      map.on("mouseenter", MEMBER_GEO_CLUSTER_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer" })
      map.on("mouseenter", MEMBER_GEO_POINT_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer" })
      map.on("mouseleave", MEMBER_GEO_CLUSTER_LAYER_ID, () => { map.getCanvas().style.cursor = "" })
      map.on("mouseleave", MEMBER_GEO_POINT_LAYER_ID, () => { map.getCanvas().style.cursor = "" })
      mapRef.current = map
    } catch (error) {
      window.setTimeout(() => {
        setMapError(error instanceof Error ? error.message : "Mapbox could not initialize.")
      }, 0)
    }

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapboxToken])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(MEMBER_GEO_SOURCE_ID) as GeoJSONSource | undefined
    if (source) {
      source.setData(geoJson)
    }
  }, [geoJson])

  return (
    <Panel title="Membership geography" subtitle={`n=${formatNumber(totalLocatedRecords)} located member records`} className="lg:col-span-2">
      <div className="mb-4 inline-flex rounded-lg border border-zinc-200 bg-white p-1">
        {[
          { id: "city", label: "City" },
          { id: "country", label: "Country" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setGeoView(item.id as "city" | "country")
              setSelectedCityId("")
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${geoView === item.id ? "bg-ipn text-white" : "text-zinc-500 hover:text-zinc-800"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="directory-map-shell relative h-[360px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          {mapboxToken && !mapError ? (
            <div ref={containerRef} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
              {mapError || "Mapbox is not configured locally. City counts are still available."}
            </div>
          )}
        </div>
        <div className="min-w-0">
          {selectedLocation ? (
            <div className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-zinc-900">{selectedLocationLabel}</h4>
                  <p className="mt-1 text-xs text-zinc-400">{formatNumber(selectedLocation.memberCount)} members</p>
                </div>
              </div>
              <div className="mt-4 max-h-80 overflow-y-auto border-t border-zinc-100 pt-3 pr-2">
                {selectedLocation.members.map((member) => (
                  <div key={member.id} className="py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-700">{member.name}</p>
                      <p className="truncate text-zinc-400">{member.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No geography data" description="No filtered members have usable city and country data." />
          )}
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-zinc-200">
            {activeLocations.map((city) => (
              <button key={city.id} type="button" onClick={() => setSelectedCityId(city.id)} className={`flex w-full items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2 text-left text-xs last:border-b-0 ${selectedLocation?.id === city.id ? "bg-ipn-light text-ipn" : "text-zinc-600 hover:bg-zinc-50"}`}>
                <span className="truncate">{geoView === "country" ? city.country : [city.city, city.state, city.country].filter(Boolean).join(", ")}</span>
                <span className="tabular-nums">{formatNumber(city.memberCount)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function MemberSourceChips({ sources }: { sources: MemberDirectorySources }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEMBER_SOURCE_LABELS.filter((source) => sources[source.id]).map((source) => (
        <span key={source.id} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${sourceChipClass(source.id)}`}>
          {source.short}
        </span>
      ))}
    </div>
  )
}

function detailValue(value: ReactNode) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return "-"
  if (Array.isArray(value)) return value.join(", ")
  return value
}

function DetailFieldGrid({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: ReactNode }[]
}) {
  return (
    <section className="border-t border-zinc-200 py-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-xs font-medium text-zinc-400">{row.label}</dt>
            <dd className="mt-1 break-words text-sm text-zinc-700">{detailValue(row.value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function MemberDirectoryDrawer({
  detail,
  loading,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onClose,
}: {
  detail: MemberDirectoryDetail | null
  loading: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}) {
  const [showSensitive, setShowSensitive] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-zinc-900">{detail?.name ?? "Loading member"}</h2>
            <p className="truncate text-sm text-zinc-500">{detail?.email ?? "Fetching directory detail..."}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button type="button" disabled={!canGoPrevious || loading} onClick={onPrevious} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 disabled:opacity-40">Prev</button>
            <button type="button" disabled={!canGoNext || loading} onClick={onNext} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 disabled:opacity-40">Next</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600">Close</button>
          </div>
        </div>

        <div className="px-6">
          {loading && <div className="py-8 text-sm text-zinc-500">Loading member detail...</div>}
          {!loading && detail && (
            <>
              <div className="flex flex-wrap items-center gap-2 py-5">
                <MemberSourceChips sources={detail.sources} />
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${detail.whatsappConnected ? "border-green-200 bg-green-50 text-green-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}>
                  WhatsApp {detail.whatsappConnected ? "connected" : "not connected"}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${mailchimpBadge(detail.mailchimpStatus as MailchimpStatus | null).className}`}>
                  {mailchimpBadge(detail.mailchimpStatus as MailchimpStatus | null).label}
                </span>
              </div>

              <DetailFieldGrid title="Member Portal Fields" rows={[
                { label: "Portal ID", value: detail.portal.id },
                { label: "First name", value: detail.portal.firstName },
                { label: "Last name", value: detail.portal.lastName },
                { label: "Email", value: detail.portal.email },
                { label: "Discoverable", value: detail.portal.discoverable == null ? "" : detail.portal.discoverable ? "Yes" : "No" },
                { label: "Stage", value: detail.portal.persona },
                { label: "Affiliation", value: detail.portal.affiliation },
                { label: "School", value: detail.portal.school },
                { label: "Field", value: detail.portal.field },
                { label: "Psychedelic field", value: detail.portal.psychedelicFieldStatus },
                { label: "Barriers", value: detail.portal.psychedelicFieldBarriers },
                { label: "Role and goals", value: detail.portal.roleAndGoals },
                { label: "IPN inspiration", value: detail.portal.inspiration },
                { label: "Heard about us", value: detail.portal.referralSource },
                { label: "Country", value: detail.portal.country },
                { label: "State", value: detail.portal.state },
                { label: "City", value: detail.portal.city },
                { label: "WhatsApp", value: detail.portal.whatsappUrl },
                { label: "LinkedIn", value: detail.portal.linkedinUrl },
                { label: "Bio", value: detail.portal.bio },
                { label: "Interest tags", value: detail.portal.interestTags },
                { label: "Created", value: formatDateTime(detail.portal.createdAt) },
                { label: "Mailchimp status", value: detail.portal.mailchimpStatus },
              ]} />

              <DetailFieldGrid title="Legacy SoT Fields" rows={[
                { label: "Person ID", value: detail.legacy.personId },
                { label: "Full name", value: detail.legacy.fullName },
                { label: "Original email", value: detail.legacy.originalEmail },
                { label: "Affiliation", value: detail.legacy.affiliation },
                { label: "Self-description", value: detail.legacy.selfDescription },
                { label: "Primary field", value: detail.legacy.primaryField },
                { label: "Psychedelic field", value: detail.legacy.psychedelicFieldStatus },
                { label: "Field barriers", value: detail.legacy.psychedelicFieldBarriers },
                { label: "Role and goals", value: detail.legacy.currentRoleAndGoals },
                { label: "IPN inspiration", value: detail.legacy.ipnInspiration },
                { label: "Heard about us", value: detail.legacy.referralSource },
                { label: "Country", value: detail.legacy.country },
                { label: "State", value: detail.legacy.state },
                { label: "City", value: detail.legacy.city },
                { label: "Sources", value: detail.legacy.channelsPresent },
                { label: "Channel count", value: detail.legacy.channelCount || "" },
                { label: "Engagement status", value: detail.legacy.engagementStatus },
                { label: "First seen", value: formatDateTime(detail.legacy.firstSeenAt) },
                { label: "Last seen", value: formatDateTime(detail.legacy.lastSeenAt) },
                { label: "Mailchimp ID", value: detail.legacy.mailchimpId },
                { label: "Mailchimp audiences", value: detail.legacy.mailchimpAudiences },
                { label: "Mailchimp status", value: detail.legacy.mailchimpStatus },
                { label: "Zoom registrations", value: detail.legacy.zoomRegistrations || "" },
                { label: "Zoom attended", value: detail.legacy.zoomAttended || "" },
                { label: "Zoom total minutes", value: detail.legacy.zoomTotalMinutes ? formatNumber(detail.legacy.zoomTotalMinutes) : "" },
                { label: "Zoom last event", value: detail.legacy.zoomLastEventDate },
                { label: "Zoom attendance status", value: detail.legacy.zoomAttendanceStatus },
                { label: "Eventbrite events", value: detail.legacy.eventbriteEventCount || "" },
                { label: "Eventbrite last event", value: detail.legacy.eventbriteLastEventDate },
                { label: "Notes", value: detail.legacy.notes },
              ]} />

              <section className="border-t border-zinc-200 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Legacy Sensitive Fields</h3>
                  <button type="button" onClick={() => setShowSensitive((value) => !value)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600">
                    {showSensitive ? "Hide sensitive fields" : "Reveal sensitive fields"}
                  </button>
                </div>
                {showSensitive ? (
                  <DetailFieldGrid title="" rows={[
                    { label: "Old app user ID", value: detail.sensitive.oldappUserId },
                    { label: "Date of birth", value: detail.sensitive.dateOfBirth },
                    { label: "Gender", value: detail.sensitive.gender },
                    { label: "Race", value: detail.sensitive.race },
                    { label: "Old app signup location", value: detail.sensitive.oldappSignupLocation },
                  ]} />
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">Sensitive legacy fields are hidden by default.</p>
                )}
              </section>
            </>
          )}
          {!loading && !detail && <EmptyState title="Member detail unavailable" description="The selected member detail could not be loaded from the admin data layer." />}
        </div>
      </div>
    </div>
  )
}

function CombinedMembersPanel({ memberInsights }: { memberInsights: MemberInsightsData | null }) {
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const [whatsappFilter, setWhatsappFilter] = useState("all")
  const [mailchimpFilter, setMailchimpFilter] = useState("all")
  const [countryFilter, setCountryFilter] = useState("all")
  const [stateFilter, setStateFilter] = useState("all")
  const [fieldFilter, setFieldFilter] = useState("all")
  const [psychedelicFilter, setPsychedelicFilter] = useState("all")
  const [attendedOnly, setAttendedOnly] = useState(false)
  const [sortKey, setSortKey] = useState<"name" | "firstSeenAt" | "sourceCount" | "eventCount">("firstSeenAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [sourceFilter, setSourceFilter] = useState<keyof MemberDirectorySources | "all">("all")
  const [page, setPage] = useState(0)
  const [selectedRow, setSelectedRow] = useState<MemberDirectoryRow | null>(null)
  const [detail, setDetail] = useState<MemberDirectoryDetail | null>(null)
  const [isPending, startTransition] = useTransition()

  const directory = memberInsights?.memberDirectory
  const rows = useMemo(() => directory?.rows ?? [], [directory?.rows])
  const countries = useMemo(() => Array.from(new Set(rows.map((row) => row.country).filter(Boolean))).sort(), [rows])
  const states = useMemo(() => Array.from(new Set(rows.map((row) => row.state).filter(Boolean))).sort(), [rows])
  const fields = useMemo(() => Array.from(new Set(rows.map((row) => row.primaryField).filter((field) => field && field !== "-"))).sort(), [rows])
  const psychedelicStatuses = useMemo(() => Array.from(new Set(rows.map((row) => row.psychedelicFieldStatus).filter(Boolean))).sort(), [rows])
  const mailchimpStatuses = useMemo(() => Array.from(new Set(rows.map((row) => row.mailchimpStatus).filter(Boolean))).sort(), [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (query && !`${row.name} ${row.email} ${row.location} ${row.primaryField}`.toLowerCase().includes(query)) return false
        if (!isWithinDateRange(row.firstSeenAt, fromDate, toDate)) return false
        if (sourceFilter !== "all" && !row.sources[sourceFilter]) return false
        if (whatsappFilter === "connected" && !row.whatsappConnected) return false
        if (whatsappFilter === "not_connected" && row.whatsappConnected) return false
        if (mailchimpFilter !== "all" && row.mailchimpStatus !== mailchimpFilter) return false
        if (countryFilter !== "all" && row.country !== countryFilter) return false
        if (stateFilter !== "all" && row.state !== stateFilter) return false
        if (fieldFilter !== "all" && row.primaryField !== fieldFilter) return false
        if (psychedelicFilter !== "all" && row.psychedelicFieldStatus !== psychedelicFilter) return false
        if (attendedOnly && row.eventCount < 1) return false
        return true
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1
        if (sortKey === "name") return a.name.localeCompare(b.name) * direction
        if (sortKey === "sourceCount") return (a.sourceCount - b.sourceCount || a.name.localeCompare(b.name)) * direction
        if (sortKey === "eventCount") return (a.eventCount - b.eventCount || a.name.localeCompare(b.name)) * direction
        const aTime = a.firstSeenAt ? new Date(a.firstSeenAt).getTime() : 0
        const bTime = b.firstSeenAt ? new Date(b.firstSeenAt).getTime() : 0
        return (aTime - bTime || a.name.localeCompare(b.name)) * direction
      })
  }, [attendedOnly, countryFilter, fieldFilter, fromDate, mailchimpFilter, psychedelicFilter, rows, search, sortDirection, sortKey, sourceFilter, stateFilter, toDate, whatsappFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / 25))
  const currentPage = Math.min(page, totalPages - 1)
  const pageRows = filteredRows.slice(currentPage * 25, (currentPage + 1) * 25)
  const selectedIndex = selectedRow ? filteredRows.findIndex((row) => row.id === selectedRow.id) : -1
  const registrationTrend = aggregateByGranularity(filteredRows.map((row) => ({
    date: row.firstSeenAt,
    values: { members: 1 },
  })), granularity).reduce<{ label: string; members: number; cumulative: number }[]>((acc, row) => {
    const previous = acc.at(-1)?.cumulative ?? 0
    acc.push({ label: row.label, members: row.members, cumulative: previous + row.members })
    return acc
  }, [])
  const filteredPortal = filteredRows.filter((row) => row.sources.portal)
  const filteredPortalCount = filteredPortal.length
  const filteredWhatsApp = filteredRows.filter((row) => row.whatsappConnected).length
  const filteredMailchimpSubscribers = filteredRows.filter((row) => row.sources.mailchimp && row.mailchimpStatus === "subscribed").length
  const filteredDiscoverable = filteredPortal.filter((row) => row.portalDiscoverable).length
  const filteredWithTags = filteredPortal.filter((row) => row.portalInterestTagCount > 0).length
  const unfilteredSourceTotals = directory?.sourceTotals ?? []
  const filteredSourceTotals = MEMBER_SOURCE_LABELS.map((source) => ({
    label: source.label,
    value: filteredRows.filter((row) => row.sources[source.id]).length,
  }))
  const sourceTotals = filteredRows.length === rows.length ? unfilteredSourceTotals : filteredSourceTotals
  const filteredCharts = directory ? buildFilteredMemberCharts(filteredRows, directory) : null
  const filteredGeography = directory ? buildFilteredGeography(filteredRows, directory) : []

  function openDetail(row: MemberDirectoryRow) {
    setSelectedRow(row)
    setDetail(null)
    startTransition(async () => {
      const loaded = await getMemberDirectoryDetail({ normalizedEmail: row.normalizedEmail, portalId: row.portalId })
      setDetail(loaded)
    })
  }

  if (!memberInsights || !directory) {
    return <EmptyState title="Member directory unavailable" description="The admin member query did not return directory data." />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        <span className="font-semibold">Legacy SoT import:</span> {formatNumber(directory.importFreshness.rowCount)} rows imported
        {directory.importFreshness.importedAt ? ` on ${formatDateTime(directory.importFreshness.importedAt)}` : ""}. Directory rows merge live Portal profiles with approved legacy records.
      </div>

      <FilterBar>
        <FilterField label="Search">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Name, email, location..." className={inputClassName} />
        </FilterField>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0) }} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0) }} className={inputClassName} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
        <FilterField label="Source">
          <SelectInput value={sourceFilter} onChange={(value) => { setSourceFilter(value as keyof MemberDirectorySources | "all"); setPage(0) }} options={[
            { value: "all", label: "All" },
            ...MEMBER_SOURCE_LABELS.map((source) => ({ value: source.id, label: source.label })),
          ]} />
        </FilterField>
        <FilterField label="WhatsApp">
          <SelectInput value={whatsappFilter} onChange={(value) => { setWhatsappFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            { value: "connected", label: "Connected" },
            { value: "not_connected", label: "Not connected" },
          ]} />
        </FilterField>
        <FilterField label="Mailchimp">
          <SelectInput value={mailchimpFilter} onChange={(value) => { setMailchimpFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            ...mailchimpStatuses.map((status) => ({ value: status, label: status })),
          ]} />
        </FilterField>
        <FilterField label="Country">
          <SelectInput value={countryFilter} onChange={(value) => { setCountryFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            ...countries.map((country) => ({ value: country, label: country })),
          ]} />
        </FilterField>
        <FilterField label="State">
          <SelectInput value={stateFilter} onChange={(value) => { setStateFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            ...states.map((state) => ({ value: state, label: state })),
          ]} />
        </FilterField>
        <FilterField label="Field">
          <SelectInput value={fieldFilter} onChange={(value) => { setFieldFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            ...fields.map((field) => ({ value: field, label: field })),
          ]} />
        </FilterField>
        <FilterField label="Psychedelic field">
          <SelectInput value={psychedelicFilter} onChange={(value) => { setPsychedelicFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            ...psychedelicStatuses.map((status) => ({ value: status, label: status })),
          ]} />
        </FilterField>
        <FilterField label="Sort">
          <SelectInput value={`${sortKey}:${sortDirection}`} onChange={(value) => {
            const [nextKey, nextDirection] = value.split(":") as [typeof sortKey, typeof sortDirection]
            setSortKey(nextKey)
            setSortDirection(nextDirection)
          }} options={[
            { value: "firstSeenAt:desc", label: "First seen, newest" },
            { value: "firstSeenAt:asc", label: "First seen, oldest" },
            { value: "name:asc", label: "Name, A-Z" },
            { value: "sourceCount:desc", label: "Most sources" },
            { value: "eventCount:desc", label: "Most events" },
          ]} />
        </FilterField>
        <FilterField label="Events">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-600">
            <input type="checkbox" checked={attendedOnly} onChange={(event) => { setAttendedOnly(event.target.checked); setPage(0) }} />
            Attended &gt;=1 event
          </label>
        </FilterField>
      </FilterBar>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Directory members" value={formatNumber(filteredRows.length)} helper={`${formatNumber(rows.length)} total merged records`} />
        <StatCard label="Member Portal" value={formatNumber(filteredPortalCount)} helper={`${formatPercent(filteredRows.length ? filteredPortalCount / filteredRows.length * 100 : 0)} of filtered`} />
        <StatCard label="Mailchimp subscribers" value={formatNumber(filteredMailchimpSubscribers)} helper={`${formatPercent(filteredRows.length ? filteredMailchimpSubscribers / filteredRows.length * 100 : 0)} of filtered`} />
        <StatCard label="WhatsApp connected" value={formatNumber(filteredWhatsApp)} helper={`${formatPercent(filteredRows.length ? filteredWhatsApp / filteredRows.length * 100 : 0)} of filtered`} />
        <StatCard label="Member discoverable" value={formatNumber(filteredDiscoverable)} helper={`${formatPercent(filteredPortalCount ? filteredDiscoverable / filteredPortalCount * 100 : 0)} of Member Portal members`} />
        <StatCard label="Members w/ interest tags" value={formatNumber(filteredWithTags)} helper={`${formatPercent(filteredPortalCount ? filteredWithTags / filteredPortalCount * 100 : 0)} of Member Portal members`} />
      </div>

      <Panel title="Member growth" subtitle={`n=${formatNumber(filteredRows.length)} member records, bucketed ${granularity}`}>
        <ResponsiveChart height={320}>
          <ComposedChart data={registrationTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="members" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="cumulative" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar yAxisId="members" dataKey="members" name="New members" fill="#93c5fd" radius={[6, 6, 0, 0]} />
            <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name="Cumulative members" stroke="#2563eb" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveChart>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Source totals" subtitle={sampleSubtitle(sourceTotals, "source records")}><BarList items={sourceTotals} /></Panel>
        {filteredCharts && <Panel title="Top interest tags" subtitle={sampleSubtitle(filteredCharts.topInterestTags, "tag selections")}><PaginatedBarList items={filteredCharts.topInterestTags} /></Panel>}
        {filteredCharts && <Panel title="Top schools" subtitle={sampleSubtitle(filteredCharts.topSchools)}><BarList items={filteredCharts.topSchools} /></Panel>}
        {filteredCharts && <Panel title="Which best describes you" subtitle={sampleSubtitle(filteredCharts.bestDescribes)}><BarList items={filteredCharts.bestDescribes} /></Panel>}
        {filteredCharts && <Panel title="Which field are you primarily in" subtitle={sampleSubtitle(filteredCharts.primaryField)}><BarList items={filteredCharts.primaryField} /></Panel>}
        {filteredCharts && <Panel title="How did you hear about us" subtitle={sampleSubtitle(filteredCharts.referralSources)}><BarList items={filteredCharts.referralSources} /></Panel>}
        {filteredCharts && <Panel title="Psychedelic field status" subtitle={sampleSubtitle(filteredCharts.psychedelicFieldStatus)}><BarList items={filteredCharts.psychedelicFieldStatus} /></Panel>}
        {filteredCharts && <Panel title="Psychedelic field barriers" subtitle={sampleSubtitle(filteredCharts.psychedelicFieldBarriers)}><BarList items={filteredCharts.psychedelicFieldBarriers} /></Panel>}
        <MembershipGeographyPanel cities={filteredGeography} />
      </div>

      <Panel title="Member Directory" subtitle={`Showing ${formatNumber(filteredRows.length)} of ${formatNumber(rows.length)} merged members. Click a row to open full detail.`}>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {["Name", "Email", "Location", "Primary Field", "First Seen", "Sources", "WhatsApp", "Mailchimp", "Events"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {pageRows.map((row) => {
                const badge = mailchimpBadge(row.mailchimpStatus as MailchimpStatus | null)
                return (
                  <tr key={row.id} onClick={() => openDetail(row)} className="cursor-pointer hover:bg-zinc-50">
                    <td className="max-w-[13rem] px-3 py-3 font-medium text-zinc-800">{row.name}</td>
                    <td className="max-w-[15rem] truncate px-3 py-3 text-zinc-500">{row.email}</td>
                    <td className="max-w-[14rem] px-3 py-3 text-zinc-500">{row.location}</td>
                    <td className="max-w-[13rem] px-3 py-3 text-zinc-500">{row.primaryField}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-500">
                      <div>{formatDate(row.firstSeenAt)}</div>
                      {row.firstSeenConfidence === "low" && (
                        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-amber-600">Low confidence</div>
                      )}
                    </td>
                    <td className="px-3 py-3"><MemberSourceChips sources={row.sources} /></td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${row.whatsappConnected ? "border-green-200 bg-green-50 text-green-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}>
                        {row.whatsappConnected ? "Connected" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(row.eventCount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} />
      </Panel>

      {selectedRow && (
        <MemberDirectoryDrawer
          detail={detail}
          loading={isPending}
          canGoPrevious={selectedIndex > 0}
          canGoNext={selectedIndex >= 0 && selectedIndex < filteredRows.length - 1}
          onPrevious={() => {
            if (selectedIndex > 0) openDetail(filteredRows[selectedIndex - 1])
          }}
          onNext={() => {
            if (selectedIndex >= 0 && selectedIndex < filteredRows.length - 1) openDetail(filteredRows[selectedIndex + 1])
          }}
          onClose={() => {
            setSelectedRow(null)
            setDetail(null)
          }}
        />
      )}
    </div>
  )
}

function MembersAnalyticsPanel({
  memberInsights,
  portalUtilization,
}: {
  memberInsights: MemberInsightsData | null
  portalUtilization: PortalUtilizationData
}) {
  const [activeView, setActiveView] = useState<MemberAnalyticsView>("members")

  return (
    <div className="flex flex-col gap-5">
      <SectionTabs
        active={activeView}
        onChange={setActiveView}
        items={[
          { id: "members", label: "Members" },
          { id: "utilization", label: "Member Portal Utilization" },
        ]}
      />
      {activeView === "members" ? (
        <CombinedMembersPanel memberInsights={memberInsights} />
      ) : activeView === "utilization" ? (
        <PortalUtilizationPanel data={portalUtilization} />
      ) : (
        null
      )}
    </div>
  )
}

function PortalUtilizationPanel({ data }: { data: PortalUtilizationData }) {
  const dates = data.funnel.map((row) => row.date).sort()
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [granularity, setGranularity] = useState<Granularity>("daily")
  const [device, setDevice] = useState<DeviceFilter>("all")
  const filteredFunnelRows = data.funnel.filter((row) => (
    row.device === device &&
    isWithinDateRange(row.date, fromDate, toDate)
  ))
  const funnelBuckets = fillMetricBuckets(aggregateByGranularity(filteredFunnelRows.map((row) => ({
    date: row.date,
    values: {
      registrationTraffic: row.registrationTraffic,
      registrationCompleted: row.registrationCompleted,
      signInTraffic: row.signInTraffic,
      signInCompleted: row.signInCompleted,
    },
  })), granularity), granularity, dates, {
    registrationTraffic: 0,
    registrationCompleted: 0,
    signInTraffic: 0,
    signInCompleted: 0,
  })
  const funnel = funnelBuckets.map((row) => ({
    ...row,
    date: row.label,
    registrationConversion: row.registrationTraffic ? row.registrationCompleted / row.registrationTraffic * 100 : 0,
    signInConversion: row.signInTraffic ? row.signInCompleted / row.signInTraffic * 100 : 0,
  }))
  const filteredErrors = data.errors
  const filteredPageRows = data.topPages.filter((row) => device === "all" || row.device === device)
  const filteredClickRows = data.topClicks.filter((row) => device === "all" || row.device === device)
  const pageMap = new Map<string, { page: string; sessions: number; users: number; durationTotal: number; durationSamples: number; clicks: number }>()
  for (const row of filteredPageRows) {
    const current = pageMap.get(row.page) ?? { page: row.page, sessions: 0, users: 0, durationTotal: 0, durationSamples: 0, clicks: 0 }
    current.sessions += row.sessions
    current.users += row.users
    current.durationTotal += row.avgDurationSeconds * row.sessions
    current.durationSamples += row.sessions
    current.clicks += row.clicks
    pageMap.set(row.page, current)
  }
  const filteredTopPages = Array.from(pageMap.values()).map((row) => ({
    page: row.page,
    sessions: row.sessions,
    users: row.users,
    avgDurationSeconds: row.durationSamples ? Math.round(row.durationTotal / row.durationSamples) : 0,
    clicks: row.clicks,
    clicksPerSession: row.sessions ? row.clicks / row.sessions : 0,
  })).sort((a, b) => b.sessions - a.sessions || b.clicks - a.clicks)
  const clickMap = new Map<string, { clickName: string; page: string; clicks: number; users: number; sessions: number }>()
  for (const row of filteredClickRows) {
    const key = `${row.page}:${row.clickName}`
    const current = clickMap.get(key) ?? { clickName: row.clickName, page: row.page, clicks: 0, users: 0, sessions: 0 }
    current.clicks += row.clicks
    current.users += row.users
    current.sessions += row.sessions
    clickMap.set(key, current)
  }
  const filteredTopClicks = Array.from(clickMap.values()).sort((a, b) => b.clicks - a.clicks || b.users - a.users || a.clickName.localeCompare(b.clickName))
  const rsvpBuckets = fillMetricBuckets(aggregateByGranularity(data.rsvpTrend
    .filter((row) => isWithinDateRange(row.date, fromDate, toDate))
    .map((row) => ({ date: row.date, values: { rsvps: row.rsvps } })), granularity), granularity, data.rsvpTrend.map((row) => row.date), { rsvps: 0 })
  const rsvpTrend = rsvpBuckets.map((row) => ({ ...row, date: row.label }))
  const totalRegistrationTraffic = funnel.reduce((sum, row) => sum + row.registrationTraffic, 0)
  const totalRegistrationCompleted = funnel.reduce((sum, row) => sum + row.registrationCompleted, 0)
  const totalSignInTraffic = funnel.reduce((sum, row) => sum + row.signInTraffic, 0)
  const totalSignInCompleted = funnel.reduce((sum, row) => sum + row.signInCompleted, 0)
  const totalRsvps = rsvpTrend.reduce((sum, row) => sum + row.rsvps, 0)
  const deviceOptions = [
    { value: "all", label: "All devices" },
    ...data.trafficDevices.map((item) => ({ value: item.label, label: item.label === "unknown" ? "Unknown" : item.label[0].toUpperCase() + item.label.slice(1) })),
  ]
  const devicePieRows = data.trafficDevices.map((item) => ({
    name: item.label === "unknown" ? "Unknown" : item.label[0].toUpperCase() + item.label.slice(1),
    value: item.sessions,
  }))
  const pieColors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed"]

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
        <FilterField label="Device">
          <SelectInput value={device} onChange={(value) => setDevice(value as DeviceFilter)} options={deviceOptions} />
        </FilterField>
      </FilterBar>

      {!data.trackingAvailable && (
        <EmptyState
          title="Utilization tracking is waiting for the analytics migration"
          description={data.trackingError ?? "After the Portal analytics tables are migrated, this tab will populate from first-party Portal usage events."}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Registration conversion" value={formatPercent(totalRegistrationTraffic ? totalRegistrationCompleted / totalRegistrationTraffic * 100 : 0)} helper={`${formatNumber(totalRegistrationCompleted)} completed / ${formatNumber(totalRegistrationTraffic)} visits`} />
        <StatCard label="Sign-in conversion" value={formatPercent(totalSignInTraffic ? totalSignInCompleted / totalSignInTraffic * 100 : 0)} helper={`${formatNumber(totalSignInCompleted)} completed / ${formatNumber(totalSignInTraffic)} visits`} />
        <StatCard label="Portal RSVPs" value={formatNumber(totalRsvps)} helper={`${formatNumber(data.recentRsvps.length)} recent rows shown`} />
        <StatCard label="WhatsApp profiles" value={formatNumber(data.whatsapp.linkedProfiles)} helper={`${formatPercent(data.whatsapp.totalMembers ? data.whatsapp.linkedProfiles / data.whatsapp.totalMembers * 100 : 0)} of members`} />
        <StatCard label="Raw retention" value={`${data.rawRetentionDays}d`} helper={`Generated ${formatDate(data.generatedAt)}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Registration funnel over time" subtitle="Traffic, completed registrations, and conversion percentage">
          <ResponsiveChart height={300}>
            <ComposedChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="registrationTraffic" name="Registration traffic" fill="#bfdbfe" radius={[6, 6, 0, 0]} />
              <Bar dataKey="registrationCompleted" name="Completed" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="registrationConversion" name="Conversion rate" stroke="#16a34a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Sign-in funnel over time" subtitle="Traffic, completed sign-ins, and conversion percentage">
          <ResponsiveChart height={300}>
            <ComposedChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="signInTraffic" name="Sign-in traffic" fill="#ddd6fe" radius={[6, 6, 0, 0]} />
              <Bar dataKey="signInCompleted" name="Completed" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="signInConversion" name="Conversion rate" stroke="#16a34a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Event RSVPs over time" subtitle="Portal event registrations">
          <ResponsiveChart height={280}>
            <BarChart data={rsvpTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="rsvps" name="RSVPs" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Portal traffic by device" subtitle="Sessions from retained first-party Portal analytics events">
          {devicePieRows.length ? (
            <ResponsiveChart height={280}>
              <PieChart>
                <Pie data={devicePieRows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2}>
                  {devicePieRows.map((row, index) => <Cell key={row.name} fill={pieColors[index % pieColors.length]} />)}
                </Pie>
                <Tooltip formatter={tooltipFormatter} />
                <Legend />
              </PieChart>
            </ResponsiveChart>
          ) : (
            <EmptyState title="No device data yet" description="Device split will populate after new Portal analytics events include device metadata." />
          )}
        </Panel>
        <Panel title="Error types by page">
          {filteredErrors.length ? (
            <SimpleTable
              columns={[
                { key: "page", label: "Page" },
                { key: "errorCode", label: "Error" },
                { key: "count", label: "Count", align: "right" },
              ]}
              rows={filteredErrors.slice(0, 12).map((row) => ({
                page: truncate(row.page || "Unknown", 48),
                errorCode: truncate(row.errorCode, 52),
                count: formatNumber(row.count),
              }))}
            />
          ) : (
            <EmptyState title="No tracked errors yet" description="Registration and sign-in errors will appear here after the analytics migration is applied." />
          )}
        </Panel>
        <Panel title="Top Portal pages" subtitle="Broad clicks per session include all tracked interactive elements on each page" className="lg:col-span-2">
          {filteredTopPages.length ? (
            <SimpleTable
              columns={[
                { key: "page", label: "Page" },
                { key: "sessions", label: "Sessions", align: "right" },
                { key: "users", label: "Members", align: "right" },
                { key: "duration", label: "Avg time", align: "right" },
                { key: "clicksPerSession", label: "Clicks/session", align: "right" },
              ]}
              rows={filteredTopPages.slice(0, 12).map((row) => ({
                page: truncate(row.page || "Unknown", 72),
                sessions: formatNumber(row.sessions),
                users: formatNumber(row.users),
                duration: formatSeconds(row.avgDurationSeconds),
                clicksPerSession: formatNumber(row.clicksPerSession, 1),
              }))}
            />
          ) : (
            <EmptyState title="No page utilization yet" description="Page duration, click totals, and session activity will populate after members use the instrumented Portal." />
          )}
        </Panel>
        <Panel title="Top clicks" subtitle="Named clicks only: buttons and links with explicit Portal analytics labels" className="lg:col-span-2">
          {filteredTopClicks.length ? (
            <SimpleTable
              columns={[
                { key: "clickName", label: "Click name" },
                { key: "page", label: "Page" },
                { key: "clicks", label: "Clicks", align: "right" },
                { key: "users", label: "Members", align: "right" },
              ]}
              rows={filteredTopClicks.slice(0, 12).map((row) => ({
                clickName: truncate(row.clickName || "Unknown click", 72),
                page: truncate(row.page || "Unknown", 56),
                clicks: formatNumber(row.clicks),
                users: formatNumber(row.users),
              }))}
            />
          ) : (
            <EmptyState title="No named clicks yet" description="Named click rows will appear after members interact with tracked Portal buttons and links." />
          )}
        </Panel>
        <Panel title="Recent RSVPs" subtitle="Who RSVPed and when" className="lg:col-span-2">
          <SimpleTable
            columns={[
              { key: "member", label: "Member" },
              { key: "email", label: "Email" },
              { key: "event", label: "Event" },
              { key: "created", label: "RSVP date" },
            ]}
            rows={data.recentRsvps.slice(0, 20).map((row) => ({
              member: row.memberName,
              email: row.memberEmail || "-",
              event: truncate(row.eventTitle, 60),
              created: formatDate(row.createdAt),
            }))}
          />
        </Panel>
        <Panel title="Recent session samples" subtitle="Retained for short-term admin investigation" className="lg:col-span-2">
          {data.recentSessions.length ? (
            <SimpleTable
              columns={[
                { key: "member", label: "Member" },
                { key: "started", label: "Started" },
                { key: "pages", label: "Pages", align: "right" },
                { key: "duration", label: "Duration", align: "right" },
                { key: "clicks", label: "Clicks", align: "right" },
                { key: "lastPage", label: "Last page" },
              ]}
              rows={data.recentSessions.slice(0, 20).map((row) => ({
                member: row.memberName || row.memberEmail || "Anonymous",
                started: formatDate(row.startedAt),
                pages: formatNumber(row.pages),
                duration: formatSeconds(row.durationSeconds),
                clicks: formatNumber(row.clicks),
                lastPage: truncate(row.lastPage || "-", 48),
              }))}
            />
          ) : (
            <EmptyState title="No session samples yet" description="Recent member/session samples will appear after the tracking endpoint receives usage events." />
          )}
        </Panel>
      </div>
    </div>
  )
}

function CommunityPanel() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="WhatsApp members" value="Pending" helper="Integration not connected" />
        <StatCard label="Active conversations" value="Pending" helper="Data model pending" />
        <StatCard label="Event chat joins" value="Pending" helper="Future event workflow" />
        <StatCard label="Connection activity" value="Pending" helper="Portal + WhatsApp model" />
      </div>
      <EmptyState
        title="Community analytics data model pending"
        description="This tab is reserved for the WhatsApp-centered community model. It should combine member activity, event chat participation, and connection workflows once those sources are available."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Planned health inputs">
          <BarList
            items={[
              { label: "WhatsApp membership", value: 100 },
              { label: "Monthly active participants", value: 70 },
              { label: "Event chat participation", value: 45 },
              { label: "Portal connections", value: 35 },
              { label: "Dormancy risk", value: 25 },
            ]}
            valueLabel={(value) => `${value}% model weight placeholder`}
          />
        </Panel>
        <Panel title="Implementation notes">
          <div className="space-y-3 text-sm leading-6 text-zinc-600">
            <p>Use this area for current community operations rather than historical chat metrics.</p>
            <p>Future loaders should stay server-side and follow the same admin verification pattern used by the admin route and server actions.</p>
            <p>Until WhatsApp data is available, Community intentionally remains a designed pending state.</p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function CampaignDetailTable({ campaigns }: { campaigns: LegacyAnalyticsSnapshot["marketing"]["campaigns"] }) {
  const [openId, setOpenId] = useState<string | null>(campaigns[0]?.id ?? null)
  const [page, setPage] = useState(0)
  const pageSize = 10
  const totalPages = Math.ceil(campaigns.length / pageSize)
  const pageCampaigns = campaigns.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              {["Campaign", "Date", "List", "Sent", "Opens", "Open %", "Clicks", "Click %", "Unsubs"].map((label, index) => (
                <th key={label} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${index >= 3 ? "text-right" : "text-left"}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
          {pageCampaigns.map((campaign) => {
            const open = openId === campaign.id
            const totalUniqueDetailClicks = campaign.clickDetail.reduce((sum, item) => sum + (item.uniqueClicks ?? item.clicks), 0)
            return (
              <Fragment key={campaign.id}>
                <tr className="hover:bg-zinc-50">
                  <td className="max-w-[22rem] px-3 py-3 align-top">
                    <button type="button" onClick={() => setOpenId(open ? null : campaign.id)} className="flex cursor-pointer items-start gap-2 text-left font-medium text-zinc-800">
                      <span className="mt-0.5 text-xs text-zinc-400">{open ? "▼" : "▶"}</span>
                      <span className="min-w-0">
                        <span className="block break-words">{campaign.title}</span>
                        <span className="mt-1 block break-words text-xs font-normal text-zinc-500">{campaign.subject}</span>
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-600">{formatShortDate(campaign.date)}</td>
                  <td className="max-w-[15rem] px-3 py-3 align-top text-zinc-600">{campaign.listName}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(campaign.sent)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(campaign.opens)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatPercent(campaign.openRate)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(campaign.clicks)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatPercent(campaign.clickRate)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(campaign.unsubscribes)}</td>
                </tr>
                {open && (
                  <tr className="bg-zinc-50/70">
                    <td colSpan={9} className="px-3 py-4">
                      {campaign.clickDetail.length > 0 ? (
                        <div className="rounded-lg border border-zinc-200 bg-white">
                          <div className="grid grid-cols-[minmax(18rem,1fr)_8rem_8rem_8rem] gap-3 border-b border-zinc-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            <span>URL</span>
                            <span className="text-right">Total clicks</span>
                            <span className="text-right">Unique clicks</span>
                            <span className="text-right">% of clicks</span>
                          </div>
                          <div className="divide-y divide-zinc-100">
                            {campaign.clickDetail.map((click, index) => (
                              <div key={`${campaign.id}-${click.url}-${index}`} className="grid grid-cols-[minmax(18rem,1fr)_8rem_8rem_8rem] gap-3 px-3 py-2 text-xs text-zinc-600">
                                <a href={click.url} target="_blank" rel="noreferrer" className="break-all text-ipn hover:underline">{click.url}</a>
                                <span className="text-right tabular-nums">{formatNumber(click.clicks)}</span>
                                <span className="text-right tabular-nums">{click.uniqueClicks == null ? "-" : formatNumber(click.uniqueClicks)}</span>
                                <span className="text-right tabular-nums">{formatPercent(totalUniqueDetailClicks ? (click.uniqueClicks ?? click.clicks) / totalUniqueDetailClicks * 100 : click.percentOfClicks)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No click detail available for this campaign.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </>
  )
}

function MarketingPanel({ snapshot, analyticsRefresh }: { snapshot: LegacyAnalyticsSnapshot; analyticsRefresh: PortalAnalyticsRefreshRun | null }) {
  const marketing = snapshot.marketing
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const [listName, setListName] = useState("all")
  const mailchimpSource = snapshot.dataSources.find((source) => source.id === "mailchimp")
  const lists = marketing.lists.map((list) => list.name).filter(Boolean).sort()
  const filteredCampaigns = marketing.campaigns.filter((campaign) => (
    isWithinDateRange(campaign.date, fromDate, toDate) &&
    (listName === "all" || campaign.listName === listName)
  ))
  const monthly = aggregateByGranularity(filteredCampaigns.map((campaign) => ({
    date: campaign.date,
    values: {
      campaigns: 1,
      sent: campaign.sent,
      opens: campaign.opens,
      clicks: campaign.clicks,
      unsubscribes: campaign.unsubscribes,
    },
  })), granularity).map((row) => ({
    ...row,
    month: row.label,
    openRate: roundMetric(row.sent ? row.opens / row.sent * 100 : 0),
    clickRate: roundMetric(row.sent ? row.clicks / row.sent * 100 : 0),
  }))
  const sent = filteredCampaigns.reduce((sum, campaign) => sum + campaign.sent, 0)
  const opens = filteredCampaigns.reduce((sum, campaign) => sum + campaign.opens, 0)
  const clicks = filteredCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
  const unsubscribes = filteredCampaigns.reduce((sum, campaign) => sum + campaign.unsubscribes, 0)
  const listPerformance = marketing.lists.map((list) => {
    const listCampaigns = filteredCampaigns.filter((campaign) => campaign.listName === list.name)
    const listSent = listCampaigns.reduce((sum, campaign) => sum + campaign.sent, 0)
    const listOpens = listCampaigns.reduce((sum, campaign) => sum + campaign.opens, 0)
    const listClicks = listCampaigns.reduce((sum, campaign) => sum + campaign.clicks, 0)
    return {
      ...list,
      openRate: listSent ? listOpens / listSent * 100 : null,
      clickRate: listSent ? listClicks / listSent * 100 : null,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
        <FilterField label="Email list">
          <SelectInput value={listName} onChange={setListName} options={[{ value: "all", label: "All lists" }, ...lists.map((list) => ({ value: list, label: list }))]} />
        </FilterField>
      </FilterBar>
      <SourceFreshnessNote
        source={mailchimpSource}
        analyticsRefresh={analyticsRefresh}
        detail="Mailchimp analytics reflect the latest successful pull. The active audience list reflects the current Mailchimp setup; historical campaign rows may still retain deleted legacy audience names from their original sends."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Subscribers" value={formatNumber(marketing.summary.totalSubscribers)} helper={`${formatNumber(marketing.summary.totalLists)} lists`} />
        <StatCard label="Campaigns" value={formatNumber(filteredCampaigns.length)} helper={`${formatNumber(marketing.summary.totalCampaigns)} all pulled`} />
        <StatCard label="Open rate" value={formatPercent(sent ? opens / sent * 100 : 0)} helper={`${formatNumber(opens)} opens`} />
        <StatCard label="Click rate" value={formatPercent(sent ? clicks / sent * 100 : 0)} helper={`${formatNumber(unsubscribes)} unsubs`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Campaign performance over time" subtitle="Open and click rate by month" className="lg:col-span-2">
          <ResponsiveChart height={320}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line type="monotone" dataKey="openRate" name="Open rate" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="clickRate" name="Click rate" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Unsubscribes per month">
          <ResponsiveChart height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="unsubscribes" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Mailchimp lists">
          <SimpleTable
            columns={[
              { key: "name", label: "List" },
              { key: "members", label: "Members", align: "right" },
              { key: "openRate", label: "Open", align: "right" },
              { key: "clickRate", label: "Click", align: "right" },
            ]}
            rows={listPerformance.map((list) => ({
              name: list.name,
              members: formatNumber(list.members),
              openRate: formatPercent(list.openRate),
              clickRate: formatPercent(list.clickRate),
            }))}
          />
        </Panel>
      </div>

      <Panel title="Campaign detail" subtitle="Click a campaign to expand URL-level click details">
        <CampaignDetailTable campaigns={filteredCampaigns} />
      </Panel>
    </div>
  )
}

function SocialMediaPanel({ snapshot, analyticsRefresh }: { snapshot: LegacyAnalyticsSnapshot; analyticsRefresh: PortalAnalyticsRefreshRun | null }) {
  const social = snapshot.social
  const socialSource = snapshot.dataSources.find((source) => source.id === "instagram")
    ?? snapshot.dataSources.find((source) => source.id === "facebook")
  const historyDates = social.history.map((row) => toInputDate(row.date) || websiteDateToInput(row.month)).filter(Boolean).sort()
  const [fromDate, setFromDate] = useState(historyDates[0] ?? "")
  const [toDate, setToDate] = useState(historyDates.at(-1) ?? "")
  const [platform, setPlatform] = useState("all")
  const [metric, setMetric] = useState<SocialMetric>("followers")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const platformOptions = social.platforms
    .filter((item) => item.followers != null)
    .map((item) => ({ value: item.id, label: item.label }))
  const latestByPeriodChannel = new Map<string, LegacyAnalyticsSnapshot["social"]["history"][number] & { period: string; timestamp: number }>()
  social.history
    .filter((row) => {
      const dateValue = row.date || `${row.month}-01`
      return isWithinDateRange(dateValue, fromDate, toDate) && (platform === "all" || row.channel === platform)
    })
    .forEach((row) => {
      const date = parseDateValue(row.date || `${row.month}-01`)
      if (!date) return
      const period = granularityLabel(date, granularity)
      const key = `${period}:${row.channel}`
      const timestamp = date.getTime()
      const existing = latestByPeriodChannel.get(key)
      if (!existing || timestamp >= existing.timestamp) {
        latestByPeriodChannel.set(key, { ...row, period, timestamp })
      }
    })
  const trendByPeriod = Array.from(latestByPeriodChannel.values()).reduce<Record<string, {
    followers: number
    posts: number
    engagementTotal: number
    engagementRows: number
  }>>((acc, row) => {
    const current = acc[row.period] ?? { followers: 0, posts: 0, engagementTotal: 0, engagementRows: 0 }
    current.followers += row.followers
    current.posts += row.posts
    if (row.engagementRate > 0) {
      current.engagementTotal += row.engagementRate
      current.engagementRows += 1
    }
    acc[row.period] = current
    return acc
  }, {})
  const trend = Object.entries(trendByPeriod)
    .map(([period, row]) => ({
      month: period,
      followers: row.followers,
      posts: row.posts,
      engagementRate: row.engagementRows ? roundMetric(row.engagementTotal / row.engagementRows) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
  const metricLabel = metric === "followers" ? "Followers" : metric === "posts" ? "Posts" : "Engagement rate"

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Platform">
          <SelectInput value={platform} onChange={setPlatform} options={[{ value: "all", label: "All tracked platforms" }, ...platformOptions]} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
        <FilterField label="Trend metric">
          <SelectInput value={metric} onChange={(value) => setMetric(value as SocialMetric)} options={[
            { value: "followers", label: "Followers" },
            { value: "engagementRate", label: "Engagement rate" },
            { value: "posts", label: "Posts" },
          ]} />
        </FilterField>
      </FilterBar>
      <SourceFreshnessNote
        source={socialSource}
        analyticsRefresh={analyticsRefresh}
        detail="Social history uses the latest available platform pull in each selected day, week, or month. Any missing periods reflect gaps in the legacy social refresh history."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {social.platforms.map((platform) => (
          <StatCard
            key={platform.id}
            label={platform.label}
            value={platform.followers == null ? "Manual" : formatNumber(platform.followers)}
            helper={platform.engagementRate == null ? platform.status : `${formatPercent(platform.engagementRate)} engagement from legacy export`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Follower trend" subtitle={`Tracked Instagram and Facebook history, bucketed ${granularity.replace("ly", "")}`} className="lg:col-span-2">
          <ResponsiveChart height={320}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line type="monotone" dataKey={metric} name={metricLabel} stroke="#2563eb" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Platform status">
          <SimpleTable
            columns={[
              { key: "platform", label: "Platform" },
              { key: "status", label: "Status" },
              { key: "followers", label: "Followers", align: "right" },
              { key: "updated", label: "Updated" },
            ]}
            rows={social.platforms.map((platform) => ({
              platform: platform.label,
              status: <StatusBadge status={platform.status} />,
              followers: platform.followers == null ? "-" : formatNumber(platform.followers),
              updated: formatDate(platform.updatedAt),
            }))}
          />
        </Panel>
        <Panel title="Instagram post engagement" subtitle="Posts are ordered oldest to newest so recent dates appear on the right">
          <ResponsiveChart height={280}>
            <BarChart data={social.instagramPosts.slice().sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()).map((post) => ({ ...post, label: formatShortDate(post.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="likes" fill="#db2777" radius={[6, 6, 0, 0]} />
              <Bar dataKey="comments" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>
        </Panel>
      </div>

      <Panel title="Instagram post detail">
        <SimpleTable
          columns={[
            { key: "post", label: "Post" },
            { key: "date", label: "Date" },
            { key: "type", label: "Type" },
            { key: "likes", label: "Likes", align: "right" },
            { key: "comments", label: "Comments", align: "right" },
            { key: "engagement", label: "Engagement", align: "right" },
            { key: "link", label: "Link" },
          ]}
          rows={social.instagramPosts.map((post) => ({
            post: truncate(post.caption || "Untitled post", 72),
            date: formatShortDate(post.date),
            type: post.type,
            likes: formatNumber(post.likes),
            comments: formatNumber(post.comments),
            engagement: formatNumber(post.engagement),
            link: post.permalink ? <a className="text-ipn hover:underline" href={post.permalink} target="_blank" rel="noreferrer">Open</a> : "-",
          }))}
        />
      </Panel>
    </div>
  )
}

function WebsitePanel({ snapshot, analyticsRefresh }: { snapshot: LegacyAnalyticsSnapshot; analyticsRefresh: PortalAnalyticsRefreshRun | null }) {
  const website = snapshot.website
  const trendDateBounds = [
    ...website.trend.map((row) => websiteDateToInput(row.month)),
    ...(website.dailyTrend ?? []).map((row) => toInputDate(row.date)),
  ].filter(Boolean).sort()
  const [geoView, setGeoView] = useState<WebsiteGeoView>("countries")
  const [fromDate, setFromDate] = useState(trendDateBounds[0] ?? "")
  const [toDate, setToDate] = useState(trendDateBounds.at(-1) ?? "")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const [device, setDevice] = useState("all")
  const [channel, setChannel] = useState("all")
  const websiteSource = snapshot.dataSources.find((source) => source.id === "website")
  const overview = website.overview as Record<string, number | { new?: { sessions?: number }; returning?: { sessions?: number } } | undefined>
  const trendSourceRows = granularity === "monthly" || !(website.dailyTrend ?? []).length
    ? website.trend.map((row) => ({ date: `${row.month}-01`, ...row }))
    : (website.dailyTrend ?? [])
  const trendRows = trendSourceRows.filter((row) => isWithinDateRange(row.date, fromDate, toDate))
  const trend = fillMetricBuckets(aggregateByGranularity(trendRows.map((row) => ({
    date: row.date,
    values: {
      sessions: row.sessions,
      users: row.users,
      pageviews: row.pageviews,
      newUsers: row.newUsers,
      bounceTotal: row.bounceRate,
      durationTotal: row.avgDuration,
      rows: 1,
    },
  })), granularity).map((row) => ({
    ...row,
    month: row.label,
    bounceRate: row.rows ? row.bounceTotal / row.rows : 0,
    avgDuration: row.rows ? row.durationTotal / row.rows : 0,
  })), granularity, trendRows.map((row) => row.date), {
    sessions: 0,
    users: 0,
    pageviews: 0,
    newUsers: 0,
    bounceTotal: 0,
    durationTotal: 0,
    rows: 0,
    bounceRate: 0,
    avgDuration: 0,
  }).map((row) => ({ ...row, month: row.label }))
  const selectedChannels = channel === "all" ? website.channels : website.channels.filter((item) => item.label === channel)
  const selectedDevices = device === "all" ? website.devices : website.devices.filter((item) => item.label === device)
  const totalSessions = trend.reduce((sum, row) => sum + row.sessions, 0) || (overview.sessions_30d as number)
  const totalUsers = trend.reduce((sum, row) => sum + row.users, 0) || (overview.unique_visitors_30d as number)
  const totalPageviews = trend.reduce((sum, row) => sum + row.pageviews, 0) || (overview.pageviews_30d as number)
  const avgBounce = trend.length ? trend.reduce((sum, row) => sum + row.bounceRate, 0) / trend.length : (overview.bounce_rate as number) * 100
  const avgDuration = trend.length ? trend.reduce((sum, row) => sum + row.avgDuration, 0) / trend.length : (overview.avg_session_duration as number)
  const geoRows = geoView === "countries" ? website.countries : website.cities
  const hasWebsiteData = Boolean(website.trend.length || website.devices.length || website.channels.length)
  const websiteFreshnessDetail = hasWebsiteData
    ? "Server-only snapshot generated from the latest successful GA4 pull. Update the GA4 env var in Netlify before the scheduled refresh runs in production."
    : "The committed GA4 snapshot contains zero sessions and no trend/device/channel/page rows. This is a source refresh issue, not a Portal chart issue; the Website tab will populate after the GA4 refresh succeeds and the server snapshot is rebuilt."

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
        <FilterField label="Device">
          <SelectInput value={device} onChange={setDevice} options={[{ value: "all", label: "All devices" }, ...website.devices.map((item) => ({ value: item.label, label: item.label }))]} />
        </FilterField>
        <FilterField label="Channel">
          <SelectInput value={channel} onChange={setChannel} options={[{ value: "all", label: "All channels" }, ...website.channels.map((item) => ({ value: item.label, label: item.label }))]} />
        </FilterField>
      </FilterBar>
      <SourceFreshnessNote
        source={websiteSource}
        analyticsRefresh={analyticsRefresh}
        detail={websiteFreshnessDetail}
      />
      {!hasWebsiteData && (
        <EmptyState
          title="Website analytics are empty in the current snapshot"
          description={websiteFreshnessDetail}
        />
      )}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="Sessions" value={formatNumber(totalSessions)} helper={`${formatPercent(overview.sessions_mom_pct as number)} latest MoM`} />
        <StatCard label="Unique visitors" value={formatNumber(totalUsers)} helper={`${formatPercent(overview.visitors_mom_pct as number)} latest MoM`} />
        <StatCard label="Pageviews" value={formatNumber(totalPageviews)} />
        <StatCard label="Bounce rate" value={formatPercent(avgBounce)} />
        <StatCard label="Avg duration" value={formatDuration(avgDuration / 60)} />
      </div>

      <Panel title="Traffic trend" subtitle="Sessions, users, and pageviews for the selected date range">
        <ResponsiveChart height={320}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Line type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="users" stroke="#16a34a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pageviews" stroke="#d97706" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveChart>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Acquisition channels">
          <BarList items={selectedChannels.map((item) => ({ label: item.label, value: item.sessions }))} />
        </Panel>
        <Panel title="Device split">
          <BarList items={selectedDevices.map((item) => ({ label: item.label, value: item.sessions }))} />
        </Panel>
        <Panel title="Traffic by location">
          <SectionTabs
            active={geoView}
            onChange={setGeoView}
            items={[
              { id: "countries", label: "Countries" },
              { id: "cities", label: "Cities" },
            ]}
          />
          <div className="mt-4">
            <BarList items={geoRows.map((item) => ({ label: item.label, value: item.sessions }))} />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Traffic sources">
          <SimpleTable
            columns={[
              { key: "source", label: "Source" },
              { key: "medium", label: "Medium" },
              { key: "sessions", label: "Sessions", align: "right" },
              { key: "users", label: "Users", align: "right" },
            ]}
            rows={website.sources.map((source) => ({
              source: source.source,
              medium: source.medium,
              sessions: formatNumber(source.sessions),
              users: formatNumber(source.users),
            }))}
          />
        </Panel>
        <Panel
          title="Conversion pages"
          subtitle="GA4 page performance for key action paths tracked in the legacy dashboard, including membership, donation, PsychedelX, and contact pages."
        >
          <ResponsiveChart height={280}>
            <BarChart data={website.funnels}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="path" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="pageviews" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>
        </Panel>
      </div>

      <Panel title="Page performance">
        <SimpleTable
          columns={[
            { key: "page", label: "Page" },
            { key: "views", label: "Views", align: "right" },
            { key: "users", label: "Users", align: "right" },
            { key: "duration", label: "Duration", align: "right" },
            { key: "bounce", label: "Bounce", align: "right" },
          ]}
          rows={website.pages.map((page) => ({
            page: <span title={page.title}>{truncate(page.path || page.title, 64)}</span>,
            views: formatNumber(page.pageviews),
            users: formatNumber(page.users),
            duration: formatDuration(page.avgDuration / 60),
            bounce: formatPercent(page.bounceRate),
          }))}
        />
      </Panel>

      <Panel title="Blog performance">
        <SimpleTable
          columns={[
            { key: "post", label: "Post" },
            { key: "views", label: "Views", align: "right" },
            { key: "users", label: "Users", align: "right" },
            { key: "duration", label: "Duration", align: "right" },
            { key: "bounce", label: "Bounce", align: "right" },
          ]}
          rows={website.blog.map((post) => ({
            post: truncate(post.title || post.path, 72),
            views: formatNumber(post.pageviews),
            users: formatNumber(post.users),
            duration: formatDuration(post.avgDuration / 60),
            bounce: formatPercent(post.bounceRate),
          }))}
        />
      </Panel>

      <EmptyState title="Search Console pending" description="SEO query, impression, CTR, and average position reporting remains a future data source." />
    </div>
  )
}

type ZoomAnalyticsEvent = LegacyAnalyticsSnapshot["events"]["zoom"]["events"][number] & {
  includeInAnalytics?: boolean
  source?: "zoom" | "portal"
  registrationSource?: "portal" | "zoom-backfill" | "portal-zoom-transition" | string | null
  portalEventId?: string
  portalExternalEventId?: string | null
  zoomTransitionRegistrantCount?: number
  status?: string | null
}

type ZoomUpcomingRegistrationEvent = LegacyAnalyticsSnapshot["events"]["zoom"]["upcomingEvents"][number]

function portalEventProgram(eventType: string | null): AnalyticsEventProgram {
  const text = (eventType ?? "").toLowerCase()
  if (text.includes("psychedelx")) return "PsychedelX"
  if (text.includes("lab")) return "IPN Labs"
  return "Other"
}

function portalEventToAnalyticsEvent(event: PortalAnalyticsEvent): ZoomAnalyticsEvent {
  return {
    id: event.id,
    topic: event.title,
    date: event.startsAt,
    program: portalEventProgram(event.eventType),
    type: "public",
    attendees: 0,
    registrants: event.registrationCount,
    avgDuration: 0,
    retentionPct: 0,
    repeatPct: 0,
    participantEmails: [],
    participants: [],
    registrations: event.registrations.map((registration) => ({
      name: registration.memberName,
      email: registration.memberEmail,
      registeredAt: registration.registeredAt,
    })),
    includeInAnalytics: true,
    source: "portal",
    registrationSource: "portal",
    portalEventId: event.id,
    portalExternalEventId: event.externalEventId,
    status: event.status,
  }
}

function eventRegistrationSourceLabel(event: ZoomAnalyticsEvent) {
  if (event.registrationSource === "portal-zoom-transition") return "Portal RSVP + Zoom transition"
  if (event.source === "portal") return "Portal RSVP"
  if (event.registrationSource === "manual_zoom_registration_count_with_zoom_report_rows") return "Manual Zoom total + report rows"
  if (event.registrationSource === "manual_zoom_registration_count_with_csv_rows") return "Manual Zoom total + CSV rows"
  if (event.registrationSource === "manual_zoom_registration_count") return "Manual Zoom total"
  if (event.registrationSource === "zoom_registration_csv") return "Zoom CSV backfill"
  if (event.registrationSource === "zoom_report_participants_include_fields_registrant_id") return "Zoom report backfill"
  if (event.registrants != null || event.registrations.length > 0) return "Zoom backfill"
  return "-"
}

function eventAttendancePercent(event: ZoomAnalyticsEvent) {
  if (event.source === "portal") return "-"
  if (event.registrationSource === "zoom_report_participants_include_fields_registrant_id") return "-"
  return event.registrants ? formatPercent((event.attendees / event.registrants) * 100) : "-"
}

function normalizedEventWords(value: string) {
  const stopWords = new Set(["with", "seminar", "roundtable", "talk", "workshop", "event", "labs", "psychedelx", "consciousness"])
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word))
}

function sameEventDay(a: string | null, b: string | null) {
  return Boolean(a && b && a.slice(0, 10) === b.slice(0, 10))
}

function eventTitlesLikelyMatch(portalEvent: ZoomAnalyticsEvent, zoomEvent: ZoomUpcomingRegistrationEvent) {
  if (portalEvent.portalExternalEventId && portalEvent.portalExternalEventId === zoomEvent.id) return true
  if (!sameEventDay(portalEvent.date, zoomEvent.date)) return false
  const portalWords = new Set(normalizedEventWords(portalEvent.topic))
  const zoomWords = normalizedEventWords(zoomEvent.topic)
  const shared = zoomWords.filter((word) => portalWords.has(word))
  return shared.length >= 3
}

function mergeZoomTransitionRegistrants(
  portalEvents: ZoomAnalyticsEvent[],
  zoomUpcomingEvents: ZoomUpcomingRegistrationEvent[],
) {
  return portalEvents.map((event) => {
    const zoomEvent = zoomUpcomingEvents.find((candidate) => eventTitlesLikelyMatch(event, candidate))
    if (!zoomEvent) return event

    const registrations = [...event.registrations]
    const seenEmails = new Set(registrations.map((registration) => registration.email.toLowerCase()).filter(Boolean))
    let appendedCount = 0

    for (const registration of zoomEvent.registrations) {
      const email = registration.email.toLowerCase()
      if (!email || seenEmails.has(email)) continue
      seenEmails.add(email)
      appendedCount += 1
      registrations.push({
        name: registration.name || registration.email || "Unknown",
        email: registration.email,
        registeredAt: registration.registeredAt,
      })
    }

    if (!appendedCount) return event

    registrations.sort((a, b) => (a.registeredAt ?? "").localeCompare(b.registeredAt ?? ""))

    return {
      ...event,
      registrants: Math.max(event.registrants ?? 0, registrations.length),
      registrations,
      registrationSource: "portal-zoom-transition" as const,
      zoomTransitionRegistrantCount: appendedCount,
    }
  })
}

function applyEventLabelOverrides(
  events: ZoomAnalyticsEvent[],
  overrides: AnalyticsEventLabelOverride[],
): ZoomAnalyticsEvent[] {
  const byId = new Map(overrides.map((override) => [override.event_id, override]))
  return events.map((event) => {
    const override = byId.get(event.id)
    return override
      ? {
          ...event,
          program: override.program_label,
          type: override.event_type,
          includeInAnalytics: override.include_in_analytics,
        }
      : {
          ...event,
          includeInAnalytics: event.inclusionStatus !== "excluded",
        }
  })
}

function ZoomEventLabelControls({
  events,
  overrides,
  onSaved,
}: {
  events: ZoomAnalyticsEvent[]
  overrides: AnalyticsEventLabelOverride[]
  onSaved: (override: AnalyticsEventLabelOverride) => void
}) {
  const overrideById = new Map(overrides.map((override) => [override.event_id, override]))
  const sortedEvents = [...events].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())

  return (
    <Panel title="Event labeling controls" subtitle="Superadmin-only overrides used before Analytics filters, counts, and tables are calculated.">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200">
              {["Event", "Date", "Source", "Program", "Type", "Include", "Status"].map((label) => (
                <th key={label} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedEvents.map((event) => (
              <ZoomEventLabelControlRow
                key={event.id}
                event={event}
                override={overrideById.get(event.id)}
                onSaved={onSaved}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function ZoomEventLabelControlRow({
  event,
  override,
  onSaved,
}: {
  event: ZoomAnalyticsEvent
  override: AnalyticsEventLabelOverride | undefined
  onSaved: (override: AnalyticsEventLabelOverride) => void
}) {
  const [programLabel, setProgramLabel] = useState<AnalyticsEventProgram>((override?.program_label ?? event.program) as AnalyticsEventProgram)
  const [eventType, setEventType] = useState<AnalyticsEventType>((override?.event_type ?? event.type) as AnalyticsEventType)
  const [includeInAnalytics, setIncludeInAnalytics] = useState(override?.include_in_analytics ?? event.includeInAnalytics ?? true)
  const [status, setStatus] = useState<string | null>(override ? "Saved override" : null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setStatus(null)
    startTransition(async () => {
      const result = await saveAnalyticsEventLabelOverride({
        eventId: event.id,
        eventTopic: event.topic,
        eventDate: event.date,
        programLabel,
        eventType,
        includeInAnalytics,
      })
      if (result.error) {
        setStatus(result.error)
      } else if (result.override) {
        onSaved(result.override)
        setStatus("Saved")
      }
    })
  }

  return (
    <tr className="hover:bg-zinc-50">
      <td className="max-w-[28rem] px-3 py-3 align-top text-zinc-700">{truncate(event.topic, 90)}</td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-500">{formatShortDate(event.date)}</td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-500">{event.source === "portal" ? "Portal RSVP" : "Zoom"}</td>
      <td className="px-3 py-3 align-top">
        <SelectInput
          value={programLabel}
          onChange={(value) => setProgramLabel(value as AnalyticsEventProgram)}
          options={[
            { value: "IPN Labs", label: "IPN Labs" },
            { value: "PsychedelX", label: "PsychedelX" },
            { value: "Other", label: "Other" },
          ]}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <SelectInput
          value={eventType}
          onChange={(value) => setEventType(value as AnalyticsEventType)}
          options={[
            { value: "public", label: "Public" },
            { value: "internal", label: "Internal" },
          ]}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={includeInAnalytics}
            onChange={(event) => setIncludeInAnalytics(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-ipn focus:ring-ipn/20"
          />
          Count
        </label>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex min-w-32 flex-col gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="w-fit rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-ipn hover:text-ipn disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          {status && <span className="text-xs text-zinc-400">{status}</span>}
        </div>
      </td>
    </tr>
  )
}

function ZoomEventDetailTable({ events }: { events: ZoomAnalyticsEvent[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(events[0]?.id ?? null)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1320px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            {[
              "Event",
              "Date",
              "Program",
              "Registration source",
              "Registrants",
              "Attendees",
              "Attendance %",
              "Avg duration",
              "Repeat %",
              "First-time %",
            ].map((label, index) => (
              <th key={label} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${index >= 4 ? "text-right" : "text-left"}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {events.map((event) => {
            const expanded = expandedId === event.id
            return (
              <Fragment key={event.id}>
                <tr className="hover:bg-zinc-50">
                  <td className="max-w-[28rem] px-3 py-3 align-top text-zinc-800">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : event.id)}
                      className="flex cursor-pointer items-start gap-2 text-left"
                    >
                      <span className="mt-0.5 text-xs">{expanded ? "▼" : "▶"}</span>
                      <span>{truncate(event.topic, 86)}</span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-600">{formatShortDate(event.date)}</td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-600">{event.program}</td>
                  <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-600">{eventRegistrationSourceLabel(event)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.registrants == null ? "-" : formatNumber(event.registrants)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "Pending" : formatNumber(event.attendees)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{eventAttendancePercent(event)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : formatDuration(event.avgDuration)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : formatPercent(event.repeatPct)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : formatPercent(Math.max(0, 100 - event.repeatPct))}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={10} className="bg-zinc-50 px-3 py-4">
                      <ZoomEventExpandedDetail event={event} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ZoomEventExpandedDetail({ event }: { event: ZoomAnalyticsEvent }) {
  const participantsByEmail = new Map(event.participants.map((participant) => [participant.email.toLowerCase(), participant]))
  const registrationRows = event.registrations.length
    ? event.registrations.map((registration) => {
        const participant = participantsByEmail.get(registration.email.toLowerCase())
        return {
          name: registration.name || participant?.name || "Unknown",
          email: registration.email || participant?.email || "",
          registeredAt: registration.registeredAt,
          attended: event.source === "portal" ? null : Boolean(participant),
          durationMin: participant?.durationMin ?? null,
          eventsAttended: participant?.eventsAttended ?? 0,
          daysAttended: participant?.daysAttended ?? null,
          role: participant?.roles?.length ? participant.roles.join(", ") : "",
          country: participant?.countries?.length ? participant.countries.join(", ") : "",
        }
      })
    : event.participants.map((participant) => ({
        name: participant.name,
        email: participant.email,
        registeredAt: null,
        attended: true as boolean | null,
        durationMin: participant.durationMin,
        eventsAttended: participant.eventsAttended,
        daysAttended: participant.daysAttended ?? null,
        role: participant.roles?.length ? participant.roles.join(", ") : "",
        country: participant.countries?.length ? participant.countries.join(", ") : "",
      }))

  const emailRows = !registrationRows.length
    ? event.participantEmails.map((email) => ({
        name: "",
        email,
        registeredAt: null,
        attended: true as boolean | null,
        durationMin: null,
        eventsAttended: 0,
        daysAttended: null,
        role: "",
        country: "",
      }))
    : []
  const rows = registrationRows.length ? registrationRows : emailRows
  const registrationTrend = aggregateByGranularity(event.registrations.map((registration) => ({
    date: registration.registeredAt,
    values: { registrations: 1 },
  })), "daily").reduce<(ReturnType<typeof aggregateByGranularity<{ registrations: number }>>[number] & { cumulativeRegistrations: number })[]>((rows, row) => {
    const previous = rows.at(-1)?.cumulativeRegistrations ?? 0
    rows.push({ ...row, cumulativeRegistrations: previous + row.registrations })
    return rows
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {registrationTrend.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-800">Registrations over time</p>
          <ResponsiveChart height={220}>
            <ComposedChart data={registrationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="registrations" name="Daily registrations" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="cumulativeRegistrations" name="Cumulative registrations" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveChart>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[1180px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100">
              {["Name", "Email", "Registered", "Attended", "Duration", "Days", "Role", "Country", "Prior events"].map((label, index) => (
                <th key={label} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${index >= 3 ? "text-right" : "text-left"}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length > 0 ? rows.map((row, index) => (
              <tr key={`${event.id}-${row.email}-${index}`}>
                <td className="px-3 py-2 text-zinc-700">{row.name || "-"}</td>
                <td className="break-all px-3 py-2 text-zinc-600">{row.email || "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{formatDateTime(row.registeredAt)}</td>
                <td className="px-3 py-2 text-right text-zinc-600">{row.attended == null ? "Pending" : row.attended ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{row.durationMin == null ? "-" : formatDuration(row.durationMin)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{row.daysAttended == null ? "-" : formatNumber(row.daysAttended)}</td>
                <td className="px-3 py-2 text-right text-zinc-600">{row.role || "-"}</td>
                <td className="px-3 py-2 text-right text-zinc-600">{row.country || "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{formatNumber(row.eventsAttended)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-zinc-400">
                  No registrant or participant detail is available for this event in the current Zoom export.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EventsPanel({
  snapshot,
  analyticsRefresh,
  eventLabelOverrides,
  portalEvents,
  isSuperadmin,
}: {
  snapshot: LegacyAnalyticsSnapshot
  analyticsRefresh: PortalAnalyticsRefreshRun | null
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  portalEvents: PortalAnalyticsEvent[]
  isSuperadmin: boolean
}) {
  const [active, setActive] = useState<EventsView>("zoom")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [program, setProgram] = useState("all")
  const [type, setType] = useState("all")
  const [granularity, setGranularity] = useState<Granularity>("monthly")
  const [attendeesPage, setAttendeesPage] = useState(0)
  const [eventbriteMetric, setEventbriteMetric] = useState<EventbriteMetric>("tickets")
  const [overrides, setOverrides] = useState(eventLabelOverrides)
  const zoom = snapshot.events.zoom
  const eventbrite = snapshot.events.eventbrite
  const zoomSource = snapshot.dataSources.find((source) => source.id === "zoom")
  const eventbriteSource = snapshot.dataSources.find((source) => source.id === "eventbrite")
  const labeledZoomEvents = applyEventLabelOverrides(zoom.events, overrides)
  const transitionMergedPortalEvents = mergeZoomTransitionRegistrants(portalEvents.map(portalEventToAnalyticsEvent), zoom.upcomingEvents ?? [])
  const portalAnalyticsEvents = applyEventLabelOverrides(transitionMergedPortalEvents, overrides)
  const zoomIds = new Set(labeledZoomEvents.map((event) => event.id))
  const upcomingPortalEvents = portalAnalyticsEvents.filter((event) => !event.portalEventId || !zoomIds.has(event.portalEventId))
  const zoomEvents = labeledZoomEvents
    .filter((event) => (
      event.includeInAnalytics !== false &&
      isWithinDateRange(event.date, fromDate, toDate) &&
      (program === "all" || event.program === program) &&
      (type === "all" || event.type === type)
    ))
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
  const zoomDetailEvents = [...upcomingPortalEvents, ...zoomEvents]
    .filter((event) => (
      event.includeInAnalytics !== false &&
      isWithinDateRange(event.date, fromDate, toDate) &&
      (program === "all" || event.program === program) &&
      (type === "all" || event.type === type)
    ))
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
  const labelingEvents = [...upcomingPortalEvents, ...labeledZoomEvents]
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
  const zoomMonths = aggregateByGranularity(zoomEvents.map((event) => ({
    date: event.date,
    values: {
      events: 1,
      participants: event.attendees,
      retentionTotal: event.retentionPct,
    },
  })), granularity).map((row) => ({
    ...row,
    month: row.label,
    avgParticipants: row.events ? row.participants / row.events : 0,
    retentionPct: row.events ? row.retentionTotal / row.events : 0,
  }))
  const zoomTotalParticipants = zoomEvents.reduce((sum, event) => sum + event.attendees, 0)
  const filteredAttendees = new Map<string, { name: string; email: string; events: number; totalDurationMin: number; lastEventDate: string | null }>()
  for (const event of zoomEvents) {
    for (const participant of event.participants) {
      const key = participant.email || participant.name
      if (!key) continue
      const current = filteredAttendees.get(key) ?? { name: participant.name || participant.email || "Unknown", email: participant.email, events: 0, totalDurationMin: 0, lastEventDate: null }
      current.events += 1
      current.totalDurationMin += participant.durationMin || 0
      if (!current.lastEventDate || new Date(event.date ?? 0) > new Date(current.lastEventDate)) current.lastEventDate = event.date
      filteredAttendees.set(key, current)
    }
  }
  const topAttendees = Array.from(filteredAttendees.values()).sort((a, b) => b.events - a.events || b.totalDurationMin - a.totalDurationMin)
  const attendeePageSize = 10
  const attendeeTotalPages = Math.ceil(topAttendees.length / attendeePageSize)
  const attendeePageRows = topAttendees.slice(attendeesPage * attendeePageSize, (attendeesPage + 1) * attendeePageSize)
  const attendeeFrequency = [1, 2, 3, 4, 5].map((bucket) => ({
    label: bucket === 5 ? "5+ events" : `${bucket} event${bucket === 1 ? "" : "s"}`,
    value: topAttendees.filter((attendee) => bucket === 5 ? attendee.events >= 5 : attendee.events === bucket).length,
  }))
  const eventbriteEvents = eventbrite.events.filter((event) => isWithinDateRange(event.date, fromDate, toDate))
  const eventbriteChartRows = eventbriteEvents.map((event, index) => ({
    ...event,
    chartLabel: `${event.name} ${index + 1}`,
  }))
  const eventbriteTotalTickets = eventbriteEvents.reduce((sum, event) => sum + event.tickets, 0)
  const eventbriteRevenue = eventbriteEvents.reduce((sum, event) => sum + event.grossRevenue, 0)
  function handleOverrideSaved(override: AnalyticsEventLabelOverride) {
    setOverrides((current) => {
      const remaining = current.filter((item) => item.event_id !== override.event_id)
      return [override, ...remaining]
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionTabs
        active={active}
        onChange={setActive}
        items={[
          { id: "zoom", label: "Zoom" },
          { id: "eventbrite", label: "Eventbrite" },
          ...(isSuperadmin ? [{ id: "labeling" as const, label: "Event Labeling" }] : []),
        ]}
      />
      <FilterBar>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Program">
          <SelectInput value={program} onChange={setProgram} options={[
            { value: "all", label: "All programs" },
            { value: "IPN Labs", label: "IPN Labs" },
            { value: "PsychedelX", label: "PsychedelX" },
          ]} />
        </FilterField>
        <FilterField label="Type">
          <SelectInput value={type} onChange={setType} options={[
            { value: "all", label: "All types" },
            { value: "public", label: "Public" },
            { value: "internal", label: "Internal" },
          ]} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
      </FilterBar>
      {active === "labeling" ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          <span className="font-semibold">Event labeling controls:</span> overrides are saved in Supabase and applied before event filters, counts, and detail tables are rendered. Upcoming Portal events use Member Portal RSVPs as registration counts.
        </div>
      ) : (
        <SourceFreshnessNote
          source={active === "zoom" ? zoomSource : eventbriteSource}
          analyticsRefresh={analyticsRefresh}
          detail={active === "zoom"
            ? "Zoom analytics use a one-time historical Zoom backfill before July 1, 2026. IPN Labs historical rows can combine manual Zoom registration totals with recovered report-derived rows. If only report-derived rows are available, attendance percentage is not computed because those rows may exclude registered no-shows. The July transition event appends unique Zoom registrants to Portal RSVPs; after that, current and future registrant counts come from Member Portal RSVPs."
            : "Eventbrite analytics reflect the latest successful token-backed pull. Counts are filtered to the approved PsychedelX conferences and IPN student/professional mixers."
          }
        />
      )}

      {active === "zoom" ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Included events" value={formatNumber(zoomEvents.length)} helper="Curated public/event-facing list" />
            <StatCard label="Avg attendees" value={formatNumber(zoomTotalParticipants / Math.max(zoomEvents.length, 1), 1)} />
            <StatCard label="Avg retention" value={formatPercent(zoomEvents.reduce((sum, event) => sum + event.retentionPct, 0) / Math.max(zoomEvents.length, 1))} helper="Avg attended minutes / event duration" />
            <StatCard label="Repeat rate" value={formatPercent(topAttendees.filter((attendee) => attendee.events > 1).length / Math.max(topAttendees.length, 1) * 100)} helper={`${formatNumber(topAttendees.length)} unique attendees`} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Attendance over time">
              <ResponsiveChart height={300}>
                <ComposedChart data={zoomMonths}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey="participants" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Line type="monotone" dataKey="events" stroke="#16a34a" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveChart>
            </Panel>
            <Panel title="Retention by month">
              <ResponsiveChart height={300}>
                <LineChart data={zoomMonths}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Line type="monotone" dataKey="retentionPct" name="Retention" stroke="#7c3aed" strokeWidth={2} />
                </LineChart>
              </ResponsiveChart>
            </Panel>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Attendee frequency" subtitle="Unique attendees by number of included Zoom events attended">
              <ResponsiveChart height={280}>
                <PieChart>
                  <Pie data={attendeeFrequency} dataKey="value" nameKey="label" innerRadius={58} outerRadius={90} paddingAngle={2}>
                    {attendeeFrequency.map((row, index) => <Cell key={row.label} fill={["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#dc2626"][index]} />)}
                  </Pie>
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                </PieChart>
              </ResponsiveChart>
            </Panel>
            <Panel title="Attendee frequency counts">
              <BarList items={attendeeFrequency} />
            </Panel>
          </div>
          <Panel title="Top attendees">
            <SimpleTable
              columns={[
                { key: "name", label: "Name" },
                { key: "email", label: "Email" },
                { key: "events", label: "Events", align: "right" },
                { key: "time", label: "Total time", align: "right" },
                { key: "last", label: "Last event" },
              ]}
              rows={attendeePageRows.map((attendee) => ({
                name: attendee.name,
                email: attendee.email || "-",
                events: formatNumber(attendee.events),
                time: formatDuration(attendee.totalDurationMin),
                last: formatShortDate(attendee.lastEventDate),
              }))}
            />
            <PaginationControls page={attendeesPage} totalPages={attendeeTotalPages} onPageChange={setAttendeesPage} />
          </Panel>
          <Panel title="Zoom event detail" subtitle="Click an event to expand registrant trend, registrant timestamps, and available attendance detail. Registrants before July 2026 are historical Zoom backfill; the July transition event appends unique Zoom registrants; future registrants are Portal RSVPs.">
            <ZoomEventDetailTable events={zoomDetailEvents} />
          </Panel>
        </div>
      ) : active === "labeling" && isSuperadmin ? (
        <div className="flex flex-col gap-6">
          <ZoomEventLabelControls
            events={labelingEvents}
            overrides={overrides}
            onSaved={handleOverrideSaved}
          />
          <Panel title="Labeling preview" subtitle="Current event labels after overrides, including upcoming Portal events.">
            <ZoomEventDetailTable events={zoomDetailEvents} />
          </Panel>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <FilterBar>
            <FilterField label="Metric">
              <SelectInput value={eventbriteMetric} onChange={(value) => setEventbriteMetric(value as EventbriteMetric)} options={[
                { value: "tickets", label: "Tickets" },
                { value: "revenue", label: "Revenue" },
              ]} />
            </FilterField>
          </FilterBar>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Included events" value={formatNumber(eventbriteEvents.length)} helper="PsychedelX + IPN mixers" />
            <StatCard label="Tickets sold" value={formatNumber(eventbriteTotalTickets)} />
            <StatCard label="Gross revenue" value={formatCurrency(eventbriteRevenue)} />
            <StatCard label="Active events" value={formatNumber(eventbriteEvents.filter((event) => event.status === "live" || event.status === "started").length)} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="Performance by event">
              <ResponsiveChart height={300}>
                <BarChart data={eventbriteChartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="chartLabel" tick={false} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Bar dataKey={eventbriteMetric === "tickets" ? "tickets" : "grossRevenue"} name={eventbriteMetric === "tickets" ? "Tickets" : "Revenue"} fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveChart>
            </Panel>
            <Panel title={eventbriteMetric === "tickets" ? "Tickets by event" : "Revenue by event"}>
              <BarList
                items={eventbriteEvents.map((event) => ({
                  label: event.name,
                  value: eventbriteMetric === "tickets" ? event.tickets : event.grossRevenue,
                }))}
                valueLabel={eventbriteMetric === "tickets" ? formatNumber : formatCurrency}
              />
            </Panel>
          </div>
          <Panel title="Eventbrite event detail">
            <SimpleTable
              columns={[
                { key: "event", label: "Event" },
                { key: "date", label: "Date" },
                { key: "format", label: "Format" },
                { key: "tickets", label: "Tickets", align: "right" },
                { key: "revenue", label: "Revenue", align: "right" },
                { key: "checkins", label: "Check-ins", align: "right" },
                { key: "rate", label: "Rate", align: "right" },
              ]}
              rows={eventbriteEvents.map((event) => ({
                event: (
                  <details>
                    <summary className="cursor-pointer text-zinc-800">{truncate(event.name, 72)}</summary>
                    <div className="mt-2 space-y-1 text-xs text-zinc-500">
                      {event.ticketClasses.length > 0 ? event.ticketClasses.map((ticket, index) => (
                        <p key={`${event.id}-${ticket.name}-${index}`}>{ticket.name} - {formatNumber(ticket.sold)} sold of {formatNumber(ticket.capacity)}</p>
                      )) : <p>No ticket breakdown available.</p>}
                    </div>
                  </details>
                ),
                date: formatShortDate(event.date),
                format: event.format,
                tickets: formatNumber(event.tickets),
                revenue: formatCurrency(event.grossRevenue),
                checkins: formatNumber(event.checkIns),
                rate: formatPercent(event.attendanceRate),
              }))}
            />
          </Panel>
        </div>
      )}
    </div>
  )
}

function DataSourcesPanel() {
  const glossarySections: {
    tab: string
    description: string
    items: { term: string; definition: string; methodology?: string }[]
  }[] = [
    {
      tab: "Members",
      description: "Merged member directory, membership source mix, geography, and first-party Portal utilization.",
      items: [
        {
          term: "Directory members",
          definition: "Total merged people in the member directory after applying the active filters.",
          methodology: "The directory combines live Member Portal profiles with imported legacy member source-of-truth rows. Records are deduped by normalized email; Gmail and Googlemail addresses are additionally normalized by removing dots and plus aliases before matching. A person can have multiple source flags but appears once in the directory.",
        },
        {
          term: "Member Portal",
          definition: "Directory members with a live Supabase profile in the current Member Portal.",
          methodology: "Counts filtered directory rows where the merged row has a Portal profile. The percentage divides this count by filtered directory members.",
        },
        {
          term: "Mailchimp subscribers",
          definition: "Directory members connected to Mailchimp and currently marked as subscribed.",
          methodology: "Counts filtered directory rows where the Mailchimp source flag is present and the resolved Mailchimp status is subscribed. Mailchimp status can come from the Portal profile sync or the imported source-of-truth row.",
        },
        {
          term: "WhatsApp connected",
          definition: "Directory members with a WhatsApp URL or connection recorded in their Portal profile.",
          methodology: "Counts filtered merged rows where the live Portal profile has a non-empty WhatsApp URL. Legacy-only members without a Portal profile cannot count as WhatsApp connected.",
        },
        {
          term: "Member discoverable",
          definition: "Portal members who have opted into being discoverable in the member directory.",
          methodology: "Counts filtered rows with a Portal profile where is_discoverable is true. The percentage divides by filtered Portal members, not by all merged directory members.",
        },
        {
          term: "Members w/ interest tags",
          definition: "Portal members who selected at least one interest tag.",
          methodology: "Counts filtered Portal rows where interest_tags has one or more values. The percentage divides by filtered Portal members.",
        },
        {
          term: "Member growth",
          definition: "New and cumulative merged members over the selected daily, weekly, or monthly granularity.",
          methodology: "Uses each merged row's first seen date. First seen is the earliest usable date from old IPN app, Google Form or Mailchimp legacy data, and Portal registration. Low-confidence Mailchimp-only May 2026 first seen dates are flagged in the directory table.",
        },
        {
          term: "Source totals",
          definition: "How many filtered directory members appear in each membership source.",
          methodology: "Source flags are calculated independently, so a person can count in more than one source. Current source flags are Member Portal, Google Form, Mailchimp, and IPN App.",
        },
        {
          term: "Profile field charts",
          definition: "Breakdowns of member-provided fields such as interest tags, school, primary field, referral source, psychedelic field status, and barriers.",
          methodology: "Charts count non-empty values from filtered merged rows. Portal profile values are preferred when present; legacy source-of-truth values are used as fallback. Multi-select barriers and interest tags count each selected value.",
        },
        {
          term: "Membership geography",
          definition: "City and country distribution of members with usable location data.",
          methodology: "Uses filtered merged rows with city and country values. City coordinates come from stored Portal coordinates when available; country view aggregates city rows and uses a member-count-weighted center point.",
        },
        {
          term: "Registration conversion",
          definition: "Percent of tracked registration visits that completed registration.",
          methodology: "Calculated as registration_success events divided by registration_view events from retained first-party Portal analytics events.",
        },
        {
          term: "Sign-in conversion",
          definition: "Percent of tracked sign-in visits that completed sign-in.",
          methodology: "Calculated as sign_in_success events divided by sign_in_view events from retained first-party Portal analytics events.",
        },
        {
          term: "Portal RSVPs",
          definition: "Member Portal event registrations in the reporting window.",
          methodology: "Counts event_registrations rows from Supabase. The recent rows table shows the latest retained registration details.",
        },
        {
          term: "Raw retention",
          definition: "How long raw first-party Portal analytics events are retained before deletion.",
          methodology: "The daily maintenance job rolls raw events into daily rollups and deletes raw portal_analytics_events older than 90 days.",
        },
        {
          term: "Top Portal pages and clicks",
          definition: "Portal pages and named interactions with the most tracked usage.",
          methodology: "Top pages use retained page duration and session summary events. Top clicks count curated_click events with explicit labels; broad clicks per session include all tracked interactive elements on a page.",
        },
      ],
    },
    {
      tab: "Community",
      description: "Placeholder community-health model for future WhatsApp and Portal connection analytics.",
      items: [
        {
          term: "WhatsApp members",
          definition: "Planned count of members active or known in WhatsApp community spaces.",
          methodology: "Pending integration. Current Portal-only WhatsApp profile links are reported in the Members tab, but channel activity is not yet connected.",
        },
        {
          term: "Active conversations",
          definition: "Planned measure of current WhatsApp or community discussion activity.",
          methodology: "Pending data model. No Slack, WhatsApp, or community-message activity is currently counted in this tab.",
        },
        {
          term: "Event chat joins",
          definition: "Planned count of members joining event-specific community chats.",
          methodology: "Pending event workflow integration.",
        },
        {
          term: "Connection activity",
          definition: "Planned measure of member-to-member connection behavior across Portal and WhatsApp workflows.",
          methodology: "Pending combined Portal and WhatsApp model.",
        },
      ],
    },
    {
      tab: "Marketing",
      description: "Mailchimp audience, campaign, unsubscribe, and click performance.",
      items: [
        {
          term: "Subscribers",
          definition: "Current Mailchimp audience members across pulled lists.",
          methodology: "Uses the Mailchimp source snapshot summary totalSubscribers and totalLists values.",
        },
        {
          term: "Campaigns",
          definition: "Mailchimp campaigns included after the active date and list filters.",
          methodology: "Counts filtered campaign rows. The helper text shows total campaigns in the pulled Mailchimp snapshot.",
        },
        {
          term: "Open rate",
          definition: "Share of sent campaign emails that were opened.",
          methodology: "For the selected filters, total opens are divided by total sent. If no sent count is available, the rate is shown as 0.",
        },
        {
          term: "Click rate",
          definition: "Share of sent campaign emails that received clicks.",
          methodology: "For the selected filters, total clicks are divided by total sent. URL-level click detail preserves total clicks; unique clicks appear when present in the source export.",
        },
        {
          term: "Unsubscribes per month",
          definition: "Mailchimp unsubscribes grouped by month.",
          methodology: "Sums campaign unsubscribe counts within each selected monthly bucket.",
        },
        {
          term: "Mailchimp lists",
          definition: "Pulled Mailchimp audience/list-level membership and engagement rows.",
          methodology: "Displays list member counts, unsubscribes, open rate, and click rate from the Mailchimp list snapshot.",
        },
        {
          term: "Campaign detail",
          definition: "Campaign-level email performance and URL click breakdown.",
          methodology: "Rows come from pulled Mailchimp campaign data. Expanding a campaign shows click_detail URL rows when present.",
        },
      ],
    },
    {
      tab: "Social Media",
      description: "Instagram and Facebook audience size, posting, and engagement snapshots.",
      items: [
        {
          term: "Followers",
          definition: "Follower count for each tracked social platform.",
          methodology: "Uses the latest pulled platform row for Instagram and Facebook. Trend charts aggregate the latest available platform value in the selected day, week, or month.",
        },
        {
          term: "Engagement rate",
          definition: "Engagement percentage reported by the social snapshot for the selected platform and period.",
          methodology: "Uses engagementRate values from the social history snapshot. Missing periods reflect gaps in the historical social refresh data.",
        },
        {
          term: "Posts",
          definition: "Number of social posts recorded in the selected period.",
          methodology: "Uses the posts value from social history rows, bucketed by the selected daily, weekly, or monthly granularity.",
        },
        {
          term: "Platform status",
          definition: "Current source status for each social platform.",
          methodology: "Displays the pulled platform summary status and latest known followers, engagement rate, and monthly post counts.",
        },
        {
          term: "Instagram post engagement",
          definition: "Engagement for individual Instagram posts.",
          methodology: "Calculated from pulled Instagram media rows. The engagement value is preserved from the source snapshot and rows are ordered oldest to newest so recent dates appear on the right.",
        },
      ],
    },
    {
      tab: "Website",
      description: "GA4 site traffic, acquisition, device, geography, and page performance.",
      items: [
        {
          term: "Sessions",
          definition: "GA4 sessions for the selected reporting period.",
          methodology: "Sums visible website trend rows after filters. The MoM helper comes from the GA4 overview snapshot when present.",
        },
        {
          term: "Unique visitors",
          definition: "GA4 users or visitors for the selected reporting period.",
          methodology: "Sums visible users values from website trend rows after filters. The MoM helper comes from the GA4 overview snapshot when present.",
        },
        {
          term: "Pageviews",
          definition: "Total GA4 pageviews for the selected reporting period.",
          methodology: "Sums visible pageview values from website trend rows after filters.",
        },
        {
          term: "Bounce rate",
          definition: "Percent of sessions that GA4 classifies as bounced.",
          methodology: "Calculated as a weighted average across visible trend rows: each row bounce rate is weighted by its sessions.",
        },
        {
          term: "Avg duration",
          definition: "Average session duration for the selected website rows.",
          methodology: "Calculated as a sessions-weighted average duration across visible trend rows, then displayed in minutes or hours.",
        },
        {
          term: "Acquisition channels",
          definition: "GA4 session and user counts by channel.",
          methodology: "Uses channel rows from the GA4 source snapshot.",
        },
        {
          term: "Device split",
          definition: "GA4 sessions and users by device category.",
          methodology: "Uses device rows from the GA4 source snapshot and supports filtering the Website tab by device.",
        },
        {
          term: "Traffic by location",
          definition: "GA4 sessions and users by country or city.",
          methodology: "Uses country and city rows from the GA4 source snapshot.",
        },
        {
          term: "Page and blog performance",
          definition: "GA4 pageviews, users, average duration, and bounce rate for site pages and blog pages.",
          methodology: "Uses page and blog rows from the GA4 snapshot. Website cards aggregate visible trend rows, while page tables show source-provided rows.",
        },
      ],
    },
    {
      tab: "Events",
      description: "Zoom attendance, Portal RSVPs, Eventbrite tickets, and event labeling.",
      items: [
        {
          term: "Zoom included events",
          definition: "Curated external or participant-facing IPN Labs and PsychedelX Zoom events approved for leadership analytics.",
          methodology: "Events are filtered through the approved include list and labeling overrides. Zoom registrants are retained only as a one-time historical backfill for events before July 1, 2026.",
        },
        {
          term: "Avg attendees",
          definition: "Average number of attendees across included Zoom events.",
          methodology: "Total included Zoom attendees divided by included event count.",
        },
        {
          term: "Avg retention",
          definition: "Average attended-minutes retention for included Zoom events.",
          methodology: "For each event, retentionPct represents attended minutes relative to event duration when available. The card averages retentionPct across included events.",
        },
        {
          term: "Repeat rate",
          definition: "Share of unique Zoom attendees who attended more than one included event.",
          methodology: "Counts topAttendees with events greater than 1, divided by unique attendees in the curated Zoom attendee list.",
        },
        {
          term: "Portal RSVP registrants",
          definition: "Member Portal event registrations used as the forward source of truth for event registrant counts.",
          methodology: "Future registrants come from Supabase event_registrations. The July 2026 transition event appends unique Zoom registrants so early Zoom signups are not lost.",
        },
        {
          term: "Eventbrite included events",
          definition: "Eventbrite events included in Analytics, currently PsychedelX conferences plus IPN student and professional mixers.",
          methodology: "Unrelated one-off events are excluded from primary counts before tickets, revenue, active events, and event detail rows are calculated.",
        },
        {
          term: "Tickets sold",
          definition: "Eventbrite ticket quantity sold across included events.",
          methodology: "Sums tickets from included Eventbrite event rows after filters.",
        },
        {
          term: "Gross revenue",
          definition: "Gross Eventbrite revenue across included events.",
          methodology: "Sums grossRevenue from included Eventbrite event rows after filters.",
        },
        {
          term: "Active events",
          definition: "Included Eventbrite events currently marked live or started.",
          methodology: "Counts included Eventbrite events where status is live or started.",
        },
        {
          term: "Event labeling controls",
          definition: "Superadmin-only labels and overrides used to classify events before Analytics filters and tables are calculated.",
          methodology: "Overrides are saved in Supabase and applied before event filters, counts, and detail tables render.",
        },
      ],
    },
    {
      tab: "Data Sources & Glossary",
      description: "Global source freshness, refresh job behavior, and pending integrations.",
      items: [
        {
          term: "Live connection refresh strip",
          definition: "Top-of-Analytics source status row showing each connected source, last refresh timestamp, and green or red health dot.",
          methodology: "External source timestamps come from their source snapshot pull time. Supabase timestamps come from the latest successful GitHub-triggered Portal analytics refresh run.",
        },
        {
          term: "Green and red dots",
          definition: "Health indicator for whether the latest known refresh succeeded.",
          methodology: "A source is green when it has a refresh timestamp and a successful or warning status. A source is red when it has no usable refresh timestamp or an error status.",
        },
        {
          term: "Portal refresh job",
          definition: "Daily GitHub Actions job that calls the Member Portal Netlify maintenance function.",
          methodology: "The function rolls raw portal_analytics_events into daily rollups, deletes raw events older than 90 days, records a portal_analytics_refresh_runs row, and sends a Slack confirmation.",
        },
        {
          term: "Historical source snapshots",
          definition: "Static server-side snapshots for external analytics sources that are not yet fully refreshed inside first-party Portal tables.",
          methodology: "These snapshot dates do not change when the portal rollup job runs. They change only when that external source snapshot is rebuilt or ported into Portal-owned ingestion.",
        },
        {
          term: "Pending integrations",
          definition: "Known analytics sources or models not yet connected as live automated data feeds.",
          methodology: "Currently includes WhatsApp community analytics, Search Console SEO analytics, donations reconciliation, and future external source ingestion.",
        },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Refresh recovery notes">
          <div className="space-y-3 text-sm leading-6 text-zinc-600">
            <p>Connection refresh status is shown above the Analytics subsections. External source timestamps come from the source snapshot pull time; Supabase timestamps come from the GitHub-triggered portal refresh run.</p>
            <p>Historical snapshot panels are retained for analytics that have not yet been ported to first-party Portal tables. Current Events analytics applies the curated include/exclude list plus the historical Zoom attendance and registrant backfill policy.</p>
            <p>Event analytics now treats Zoom registrants as a one-time historical backfill, with a July 2026 transition merge that appends unique Zoom registrants to Portal RSVPs. Future registrants should come from Portal RSVPs, then actual Zoom attendance can attach after an event occurs.</p>
            <p>New source loaders should use the same admin verification pattern already used by admin server actions.</p>
          </div>
        </Panel>
        <Panel title="Pending integrations">
          <BarList
            items={[
              { label: "WhatsApp community analytics", value: 1 },
              { label: "Search Console SEO analytics", value: 1 },
              { label: "Donations source reconciliation", value: 1 },
              { label: "External source ingestion", value: 1 },
            ]}
            valueLabel={() => "Pending"}
          />
        </Panel>
      </div>

      <Panel title="Data glossary" subtitle="Metric definitions and calculation notes grouped by Analytics tab">
        <div className="flex flex-col gap-5">
          {glossarySections.map((section) => (
            <section key={section.tab} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{section.tab}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{section.description}</p>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {section.items.map((item) => (
                  <details key={`${section.tab}-${item.term}`} className="rounded-lg border border-zinc-200 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-zinc-800">{item.term}</summary>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{item.definition}</p>
                    {item.methodology && (
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        <span className="font-semibold text-zinc-600">Methodology: </span>
                        {item.methodology}
                      </p>
                    )}
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  )
}

export default function AnalyticsDashboardShell({ memberInsights, portalUtilization, analyticsSnapshot, analyticsRefresh, eventLabelOverrides, portalEvents, isSuperadmin }: Props) {
  const [activeSection, setActiveSection] = useState<AnalyticsSectionId>("members")
  const section = ANALYTICS_SECTIONS.find((item) => item.id === activeSection) ?? ANALYTICS_SECTIONS[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Analytics</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              Authenticated leadership dashboard powered by Member Portal data.
            </p>
          </div>
          <RefreshBadge refresh={analyticsRefresh} fallbackGeneratedAt={analyticsSnapshot.generatedAt} />
        </div>
      </div>

      <LiveConnectionsStrip snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} />

      <SectionTabs active={activeSection} onChange={setActiveSection} items={ANALYTICS_SECTIONS.map(({ id, label }) => ({ id, label }))} />

      <section className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{section.label}</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">{section.title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{section.description}</p>
        </div>

        {activeSection === "members" && (
          <MembersAnalyticsPanel
            memberInsights={memberInsights}
            portalUtilization={portalUtilization}
          />
        )}
        {activeSection === "community" && <CommunityPanel />}
        {activeSection === "marketing" && <MarketingPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} />}
        {activeSection === "social-media" && <SocialMediaPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} />}
        {activeSection === "website" && <WebsitePanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} />}
        {activeSection === "events" && <EventsPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} eventLabelOverrides={eventLabelOverrides} portalEvents={portalEvents} isSuperadmin={isSuperadmin} />}
        {activeSection === "data-sources" && <DataSourcesPanel />}
      </section>
    </div>
  )
}
