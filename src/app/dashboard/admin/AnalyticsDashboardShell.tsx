"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
  type SankeyNodeProps,
} from "recharts"
import { getMemberDirectoryDetail, saveAnalyticsEventLabelOverride, saveLinkedInFollowerSnapshot } from "@/lib/admin/actions"
import type { AnalyticsEventLabelOverride } from "@/lib/admin/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import { buildMailchimpAudienceMetrics, type MailchimpContactAnalytics } from "@/lib/admin/analytics/mailchimp"
import type { AnalyticsPoint, LegacyAnalyticsSnapshot } from "@/lib/admin/analytics/types"
import type { PortalAnalyticsRefreshRun } from "@/lib/portal-analytics/types"
import { canonicalPsychedelicFieldBarrier } from "@/lib/constants/registration"
import type {
  MemberDirectoryData,
  MemberDirectoryDetail,
  MemberDirectoryRow,
  MemberDirectorySources,
} from "@/lib/admin/analytics/member-directory-types"
import { educationLevelLabel } from "@/lib/members/education"
import { buildCarriedSocialTrend } from "@/lib/admin/analytics/social-trend"
import { activeUserIds, type ActiveUserWindow } from "@/lib/admin/analytics/active-users"
import { ActiveUserDetailsModal } from "./ActiveUserDetailsModal"
import { inventoryRegistrationCount, isPublicInventoryZoomEvent, mergeInventoryRegistrations, type InventoryRegistration } from "@/lib/admin/analytics/event-inventory"
import { EventInventoryDetails } from "./EventInventoryDetails"
import { buildOtherVariantItems } from "@/lib/admin/analytics/other-variants"
import {
  analyticsGranularityBucket,
  analyticsSourceIsHealthy,
  resolveExternalSourceConnection,
  snapshotSupersedesRefresh,
  type AnalyticsGranularity,
} from "@/lib/admin/analytics/presentation"
import {
  buildFocusedPortalJourneyFlow,
  buildPortalJourneyFlow,
  buildRegistrationStepFlow,
  PORTAL_PAGE_CATEGORIES,
  type PortalJourneyFlowData,
  type PortalJourneyFlowNode,
  type PortalPageCategory,
  type PortalUtilizationData,
  type RegistrationFlowCounts,
  type UtilizationAudience,
} from "@/lib/admin/analytics/portal-utilization"
import {
  buildCountryMemberGeography,
  buildFilteredMemberGeography,
  cityMemberGeography,
  memberGeographyCoverage,
} from "@/lib/admin/analytics/membership-geography"
import {
  buildFirstParticipationAttribution,
  ONBOARDING_MILESTONES,
  participationLabel,
  type OnboardingAnalyticsData,
} from "@/lib/admin/analytics/onboarding"
import { eventLabels, eventLabelCatalog, inventoryProgramMatches, type AnalyticsEventProgram, type LabelableEvent } from "@/lib/admin/analytics/event-labels"
import type { CommunityAnalyticsEvent } from "@/lib/admin/analytics/community-events"

export type { PortalUtilizationData } from "@/lib/admin/analytics/portal-utilization"

const ANALYTICS_SECTIONS = [
  { id: "registration-membership", label: "Registration & Membership", title: "Registration & membership", description: "Membership growth, Portal acquisition, current member responses, geography, and directory detail." },
  { id: "onboarding", label: "Onboarding", title: "Onboarding", description: "Current four-milestone progress for eligible Portal members and the activity that proves participation." },
  { id: "engagement", label: "Engagement", title: "Engagement", description: "Qualifying member actions, attendance, events, and individual Portal journeys." },
  { id: "reach", label: "Reach & Acquisition", title: "Reach & acquisition", description: "Mailchimp audiences, social channels, and website acquisition performance." },
  { id: "data-definitions", label: "Data & Definitions", title: "Data & definitions", description: "Metric contracts, freshness and coverage, definition history, and restricted maintenance." },
] as const

const PORTAL_PAGE_COLORS: Record<PortalPageCategory, string> = {
  Dashboard: "#6f51aa",
  Community: "#8b5cf6",
  Events: "#2563eb",
  Conferences: "#0ea5e9",
  Profile: "#16a34a",
  Feedback: "#d97706",
}

const PARTICIPATION_LINE_COLORS: Record<PortalUtilizationData["qualifyingActions"][number]["category"], string> = {
  events: "#6f51aa",
  resources: "#2563eb",
  newsletters: "#0f766e",
  connections: "#d97706",
  attendance: "#db2777",
}

const EVENT_RSVP_LINE_COLORS = [
  "#6f51aa",
  "#2563eb",
  "#0f766e",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#7c3aed",
  "#65a30d",
] as const

const JOURNEY_FLOW_DEFAULT_STEPS = 5
const JOURNEY_FLOW_STEP_INCREMENT = 5
const JOURNEY_FLOW_MAX_STEPS = 15

type AnalyticsSectionId = (typeof ANALYTICS_SECTIONS)[number]["id"]
type EventsView = "zoom" | "eventbrite" | "labeling"
type EngagementView = "overview" | "zoom" | "eventbrite" | "portal-activity"
type ReachView = "overview" | "mailchimp" | "social-media" | "website"
type MemberUtilizationSortKey = "firstRegisteredAt" | "lastSignedInAt" | "signInsLast30Days" | "connectionCount" | "whatsappConnected" | "mailchimpStatus"
type SortDirection = "asc" | "desc"

const MEMBER_UTILIZATION_SORT_COLUMNS: Array<{
  key: MemberUtilizationSortKey
  label: string
  defaultDirection: SortDirection
}> = [
  { key: "firstRegisteredAt", label: "First registered", defaultDirection: "desc" },
  { key: "lastSignedInAt", label: "Last signed in", defaultDirection: "desc" },
  { key: "signInsLast30Days", label: "Sign-ins (30d)", defaultDirection: "desc" },
  { key: "connectionCount", label: "Connections", defaultDirection: "desc" },
  { key: "whatsappConnected", label: "WhatsApp", defaultDirection: "desc" },
  { key: "mailchimpStatus", label: "Mailchimp", defaultDirection: "asc" },
]
type WebsiteGeoView = "countries" | "cities"
type Granularity = AnalyticsGranularity
type EventbriteMetric = "tickets" | "revenue"
type SocialMetric = "followers" | "engagementRate" | "posts"
type DeviceFilter = "all" | "desktop" | "mobile" | "tablet" | "unknown"
type AudienceFilter = UtilizationAudience
type ParticipationFrequencyMode = "total" | "unique"
type AnalyticsEventType = "public" | "internal"
type LiveConnectionStatus = {
  label: string
  refreshedAt: string | null
  healthy: boolean
}

const urlStateListeners = new Set<() => void>()
let urlStateIsListening = false

function notifyUrlStateListeners() {
  for (const listener of urlStateListeners) listener()
}

function subscribeToUrlState(listener: () => void) {
  urlStateListeners.add(listener)
  if (!urlStateIsListening) {
    window.addEventListener("popstate", notifyUrlStateListeners)
    urlStateIsListening = true
  }
  return () => {
    urlStateListeners.delete(listener)
    if (urlStateIsListening && urlStateListeners.size === 0) {
      window.removeEventListener("popstate", notifyUrlStateListeners)
      urlStateIsListening = false
    }
  }
}

function useUrlFilterState<T extends string = string>(key: string, initialValue: string) {
  const [value, setValue] = useState<T>(initialValue as T)
  useEffect(() => {
    const restore = () => {
      const stored = new URL(window.location.href).searchParams.get(key)
      setValue((stored ?? initialValue) as T)
    }
    restore()
    return subscribeToUrlState(restore)
  }, [initialValue, key])
  const update = useCallback((next: T) => {
    setValue(next)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set(key, next)
    else url.searchParams.delete(key)
    window.history.pushState({}, "", url)
  }, [key])
  return [value, update] as const
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

export type PortalAnalyticsEvent = {
  id: string
  title: string
  slug: string | null
  startsAt: string | null
  eventType: string | null
  status: string | null
  externalEventId: string | null
  registrationCount: number
  totalRegistrationsEver: number
  cancellationCount: number
  lastRsvpAt: string | null
  registrations: {
    userId: string
    memberName: string
    memberEmail: string
    registeredAt: string
  }[]
}

type Props = {
  memberInsights: MemberInsightsData | null
  portalUtilization: PortalUtilizationData
  onboardingAnalytics: OnboardingAnalyticsData
  analyticsSnapshot: LegacyAnalyticsSnapshot
  mailchimpAnalytics: MailchimpContactAnalytics
  analyticsRefresh: PortalAnalyticsRefreshRun | null
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  portalEvents: PortalAnalyticsEvent[]
  communityEvents?: CommunityAnalyticsEvent[]
  communityEventsError?: string | null
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
    const bucket = analyticsGranularityBucket(date, granularity)
    const current = buckets.get(bucket.key) ?? { label: bucket.label, values: {} }
    for (const [key, value] of Object.entries(row.values)) {
      current.values[key] = (current.values[key] ?? 0) + value
    }
    buckets.set(bucket.key, current)
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => ({ label: bucket.label, ...bucket.values }) as T & { label: string })
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

function formatTrackedDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds)) return "-"
  const rounded = Math.max(0, Math.round(seconds))
  if (rounded < 60) return `${rounded}s`
  const minutes = Math.floor(rounded / 60)
  const remainingSeconds = rounded % 60
  if (minutes < 60) {
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
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

function DualMetricCard({
  label,
  total,
  unique,
  helper,
}: {
  label: string
  total: string | number
  unique: string | number
  helper?: string
}) {
  return (
    <div className="flex min-h-32 flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-4 grid grid-cols-2 divide-x divide-zinc-200">
        <div className="pr-4">
          <div className="text-2xl font-semibold tabular-nums text-zinc-900">{total}</div>
          <div className="mt-1 text-xs font-medium text-zinc-500">Total</div>
        </div>
        <div className="pl-4">
          <div className="text-2xl font-semibold tabular-nums text-zinc-900">{unique}</div>
          <div className="mt-1 text-xs font-medium text-zinc-500">Unique members</div>
        </div>
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-zinc-400">{helper}</p>}
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
  const refreshSource = analyticsRefresh?.sources.find((item) => item.id === source.id)
  const lastAttemptedAt = refreshSource?.lastAttemptedAt ?? refreshSource?.lastRefreshedAt ?? source.lastAttemptedAt ?? portalRefreshedAt
  const lastSuccessfulAt = refreshSource?.lastSuccessfulAt ??
    (refreshSource?.status === "success" ? refreshSource.lastRefreshedAt : null) ??
    source.lastSuccessfulAt ??
    source.lastPull
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      <span className="font-semibold">{source.label} source snapshot:</span> last successful {formatDateTime(lastSuccessfulAt)}.
      {lastAttemptedAt ? ` Last attempted ${formatDateTime(lastAttemptedAt)}.` : ""} {detail ?? source.note}
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
  const snapshotIsNewer = snapshotSupersedesRefresh(
    fallbackGeneratedAt,
    refresh?.finishedAt ?? refresh?.startedAt,
  )
  const refreshedAt = refresh?.finishedAt ?? refresh?.startedAt ?? fallbackGeneratedAt
  const label = !refresh || snapshotIsNewer
    ? `Snapshot generated ${formatDateTime(fallbackGeneratedAt)}`
    : refresh
    ? refresh.status === "success"
      ? `Last refreshed ${formatDateTime(refreshedAt)}`
      : `${refresh.status.replace("_", " ")} attempted ${formatDateTime(refreshedAt)} · last successful ${formatDateTime(refresh.lastSuccessfulAt)}`
    : `Snapshot generated ${formatDateTime(fallbackGeneratedAt)}`
  const status = !refresh || snapshotIsNewer ? "snapshot" : refresh.status
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
  ]
  const connections = externalSources.map(({ id, label }) => {
    const refreshSource = refreshById.get(id)
    const snapshotSource = byId.get(id)
    const effective = resolveExternalSourceConnection(
      snapshotSource,
      refreshSource,
      analyticsRefresh?.finishedAt ?? analyticsRefresh?.startedAt,
    )
    return {
      label: refreshSource?.label ?? label,
      refreshedAt: effective.refreshedAt,
      healthy: effective.healthy,
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
        healthy: analyticsSourceIsHealthy(source?.status, source?.lastRefreshedAt ?? analyticsRefresh.finishedAt ?? analyticsRefresh.startedAt),
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

const MEMBER_DISTRIBUTION_COLORS = [
  "#6f51aa",
  "#8b5cf6",
  "#2563eb",
  "#0ea5e9",
  "#16a34a",
  "#d97706",
  "#e11d48",
  "#64748b",
  "#a855f7",
  "#14b8a6",
  "#f59e0b",
  "#475569",
]

type DistributionChartItem = AnalyticsPoint & { color: string }

function OtherVariantsModal({
  chartTitle,
  items,
  onClose,
}: {
  chartTitle: string
  items: AnalyticsPoint[]
  onClose: () => void
}) {
  const total = sampleSize(items)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 sm:items-center sm:px-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="other-variants-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ipn">Other responses</p>
            <h2 id="other-variants-title" className="mt-1 text-lg font-semibold text-zinc-900">{chartTitle}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Original answers grouped by exact response. Counts reflect the current member filters.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex-shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Raw response</th>
                  <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Count</th>
                  <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">% of list</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <tr key={item.label}>
                    <td className="break-words px-4 py-3 text-zinc-700">{item.label}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-800">{formatNumber(item.value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                      {formatPercent(total ? item.value / total * 100 : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function DistributionTooltip({
  active,
  payload,
  total,
  percentageDenominator,
  hasOtherDrillDown,
}: {
  active?: boolean
  payload?: {
    value?: number
    name?: string
    payload?: Partial<DistributionChartItem>
  }[]
  total: number
  percentageDenominator?: number
  hasOtherDrillDown?: boolean
}) {
  const entry = payload?.[0]
  if (!active || !entry) return null
  const value = Number(entry.value ?? entry.payload?.value ?? 0)
  const label = String(entry.payload?.label ?? entry.name ?? "Responses")

  return (
    <div className="max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-zinc-800">{label}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {formatNumber(value)} responses · {formatPercent((percentageDenominator ?? total) ? value / (percentageDenominator ?? total) * 100 : 0)} of {percentageDenominator ? "applicable members" : "answered responses"}
      </p>
      {label === "Other" && hasOtherDrillDown && (
        <p className="mt-1 text-[11px] font-medium text-ipn">Click to view original responses</p>
      )}
    </div>
  )
}

function DistributionChartPair({
  title,
  items,
  otherVariants = [],
  coverageTotal,
  coverageAnswered,
  percentageDenominator,
}: {
  title: string
  items: AnalyticsPoint[]
  otherVariants?: AnalyticsPoint[]
  coverageTotal?: number
  coverageAnswered?: number
  percentageDenominator?: number
}) {
  const [showOtherVariants, setShowOtherVariants] = useState(false)
  const chartItems: DistributionChartItem[] = [...items]
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .map((item, index) => ({
      ...item,
      color: MEMBER_DISTRIBUTION_COLORS[index % MEMBER_DISTRIBUTION_COLORS.length],
    }))
  const total = sampleSize(chartItems)
  const answered = coverageAnswered ?? total
  const subtitle = coverageTotal == null
    ? sampleSubtitle(chartItems)
    : `n=${formatNumber(answered)} answered · ${formatPercent(coverageTotal ? answered / coverageTotal * 100 : 0)} coverage`
  const chartHeight = Math.max(300, Math.min(440, chartItems.length * 38))
  const hasOtherDrillDown = chartItems.some((item) => item.label === "Other") && otherVariants.length > 0

  function openOtherFromChart(data: { payload?: Partial<DistributionChartItem>; name?: string | number }) {
    const label = String(data.payload?.label ?? data.name ?? "")
    if (label === "Other" && hasOtherDrillDown) setShowOtherVariants(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:col-span-2 lg:grid-cols-2">
        <Panel title={title} subtitle={subtitle}>
          {chartItems.length ? (
            <div className="grid min-w-0 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
              <ResponsiveChart height={chartHeight}>
                <PieChart>
                  <Pie
                    data={chartItems}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="46%"
                    outerRadius="72%"
                    paddingAngle={1}
                    onClick={openOtherFromChart}
                  >
                    {chartItems.map((item) => (
                      <Cell
                        key={item.label}
                        fill={item.color}
                        cursor={item.label === "Other" && hasOtherDrillDown ? "pointer" : "default"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DistributionTooltip total={total} percentageDenominator={percentageDenominator} hasOtherDrillDown={hasOtherDrillDown} />} />
                </PieChart>
              </ResponsiveChart>
              <ol className="flex max-h-[var(--legend-height)] min-w-0 flex-col gap-2 overflow-y-auto pr-1" style={{ "--legend-height": `${chartHeight}px` } as CSSProperties}>
                {chartItems.map((item) => (
                  <li key={item.label} className="min-w-0 text-xs text-zinc-600">
                    {item.label === "Other" && hasOtherDrillDown ? (
                      <button
                        type="button"
                        onClick={() => setShowOtherVariants(true)}
                        className="flex w-full min-w-0 items-center gap-2 rounded-md text-left hover:text-ipn focus:outline-none focus:ring-2 focus:ring-ipn/30"
                        aria-label={`View raw Other responses for ${title}`}
                      >
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
                        <span className="truncate underline decoration-dotted underline-offset-2" title={item.label}>{item.label}</span>
                        <span className="flex-shrink-0 text-[10px] font-medium text-ipn">View</span>
                      </button>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
                        <span className="truncate" title={item.label}>{item.label}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <EmptyState title="No responses" description="No data matches the current member filters." />
          )}
        </Panel>
        <Panel title={title} subtitle={subtitle}>
          {chartItems.length ? (
            <ResponsiveChart height={chartHeight}>
              <BarChart data={chartItems} layout="vertical" margin={{ left: 8, right: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={150}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => truncate(String(value), 24)}
                />
                <Tooltip content={<DistributionTooltip total={total} hasOtherDrillDown={hasOtherDrillDown} />} />
                <Bar dataKey="value" name="Responses" radius={[0, 6, 6, 0]} onClick={openOtherFromChart}>
                  {chartItems.map((item) => (
                    <Cell
                      key={item.label}
                      fill={item.color}
                      cursor={item.label === "Other" && hasOtherDrillDown ? "pointer" : "default"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveChart>
          ) : (
            <EmptyState title="No responses" description="No data matches the current member filters." />
          )}
        </Panel>
      </div>
      {showOtherVariants && (
        <OtherVariantsModal chartTitle={title} items={otherVariants} onClose={() => setShowOtherVariants(false)} />
      )}
    </>
  )
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
  const barrierApplicableRows = rows.filter((row) => (
    row.psychedelicFieldStatus === "No — I don't plan to work in the field"
    || row.psychedelicFieldStatus === "I'm not sure"
  ))

  for (const row of rows) {
    incrementMemberCount(stage, row.persona)
    incrementMemberCount(field, row.primaryField)
    for (const tag of row.interestTags) incrementMemberCount(tags, tag)
    for (const school of row.schools) incrementMemberCount(schools, school)
    incrementMemberCount(describes, row.persona || row.selfDescription)
    incrementMemberCount(primary, row.primaryField)
    incrementMemberCount(referrals, row.referralSource)
    incrementMemberCount(psychedelic, row.psychedelicFieldStatus)
    if (row.psychedelicFieldStatus === "No — I don't plan to work in the field" || row.psychedelicFieldStatus === "I'm not sure") {
      const barrierLabels = new Set(
        row.psychedelicFieldBarriers
          .map(canonicalPsychedelicFieldBarrier)
          .filter(Boolean),
      )
      for (const barrier of barrierLabels) incrementMemberCount(barriers, barrier)
    }
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
    coverage: {
      role: rows.filter((row) => Boolean(row.persona || row.selfDescription)).length,
      primaryField: rows.filter((row) => Boolean(row.primaryField && row.primaryField !== "-")).length,
      referral: rows.filter((row) => Boolean(row.referralSource)).length,
      psychedelicStatus: rows.filter((row) => Boolean(row.psychedelicFieldStatus)).length,
      barrierApplicable: barrierApplicableRows.length,
      barrierAnswered: barrierApplicableRows.filter((row) => row.psychedelicFieldBarriers.length > 0).length,
    },
    otherVariants: {
      bestDescribes: buildOtherVariantItems(rows.map((row) => ({
        canonicalLabel: row.persona || row.selfDescription,
        rawValues: row.rawCategoryResponses.persona,
      }))),
      primaryField: buildOtherVariantItems(rows.map((row) => ({
        canonicalLabel: row.primaryField,
        rawValues: row.rawCategoryResponses.primaryField,
      }))),
      referralSources: buildOtherVariantItems(rows.map((row) => ({
        canonicalLabel: row.referralSource,
        rawValues: row.rawCategoryResponses.referralSource,
      }))),
      psychedelicFieldStatus: buildOtherVariantItems(rows.map((row) => ({
        canonicalLabel: row.psychedelicFieldStatus,
        rawValues: row.rawCategoryResponses.psychedelicFieldStatus,
      }))),
      psychedelicFieldBarriers: buildOtherVariantItems(barrierApplicableRows.flatMap((row) => {
        const rawValues = row.rawCategoryResponses.psychedelicFieldBarriers
        if (!rawValues.length) {
          return row.psychedelicFieldBarriers.map((value) => ({
            canonicalLabel: canonicalPsychedelicFieldBarrier(value),
            rawValues: [value],
          }))
        }
        return rawValues.map((value) => ({
          canonicalLabel: canonicalPsychedelicFieldBarrier(value),
          rawValues: [value],
        }))
      })),
    },
    gender: directory.chartData.gender,
    age: directory.chartData.age,
    raceEthnicity: directory.chartData.raceEthnicity,
  }
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

function MembershipGeographyPanel({ locations }: { locations: MemberDirectoryData["geography"] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [geoView, setGeoView] = useState<"city" | "country">("city")
  const [mapFocus, setMapFocus] = useState<"world" | "us">("world")
  const [selectedCityId, setSelectedCityId] = useState("")
  const [mapError, setMapError] = useState("")
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const cityLocations = useMemo(() => cityMemberGeography(locations), [locations])
  const activeLocations = useMemo(
    () => geoView === "country" ? buildCountryMemberGeography(locations) : cityLocations,
    [cityLocations, geoView, locations],
  )
  const coverage = useMemo(() => memberGeographyCoverage(activeLocations), [activeLocations])
  const geoJson = useMemo(() => buildMemberGeoJson(activeLocations), [activeLocations])
  const geoJsonRef = useRef(geoJson)
  const selectedLocation = selectedCityId
    ? activeLocations.find((city) => city.id === selectedCityId) ?? null
    : null
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
        center: [0, 20],
        zoom: 1.15,
        projection: "mercator",
        renderWorldCopies: false,
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
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["sqrt", ["get", "memberCountSum"]],
              1, 12,
              4, 18,
              10, 24,
              20, 32,
              32, 46,
            ],
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
            "circle-color": "#6f51aa",
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["sqrt", ["get", "memberCount"]],
              1, 10,
              4, 14,
              10, 20,
              20, 28,
              32, 40,
            ],
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

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({
      center: mapFocus === "us" ? [-98.5795, 39.8283] : [0, 20],
      zoom: mapFocus === "us" ? 3.15 : 1.15,
      duration: 500,
    })
  }, [mapFocus])

  function selectLocation(location: MemberDirectoryData["geography"][number]) {
    setSelectedCityId(location.id)
    if (location.lat != null && location.lng != null) {
      mapRef.current?.easeTo({
        center: [location.lng, location.lat],
        zoom: geoView === "country" ? 3.75 : 5.25,
        duration: 450,
      })
    }
  }

  return (
    <Panel title="Membership geography" subtitle={`n=${formatNumber(coverage.totalMembers)} located member records · ${formatPercent(coverage.percent)} mapped`} className="lg:col-span-2">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
            {[
              { id: "city", label: "Cities" },
              { id: "country", label: "Countries" },
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
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1">
            {[
              { id: "world", label: "World" },
              { id: "us", label: "US Focus" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMapFocus(item.id as "world" | "us")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${mapFocus === item.id ? "bg-ipn text-white" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(geoView === "city"
            ? [
                { label: "Mapped members", value: coverage.mappedMembers },
                { label: "Map markers", value: coverage.mappedLocations },
              ]
            : [
                { label: "Mapped members", value: coverage.mappedMembers },
                { label: "Listed countries", value: coverage.totalLocations },
              ]
          ).map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-lg font-semibold tabular-nums text-zinc-900">{formatNumber(metric.value)}</p>
              <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-zinc-400">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="directory-map-shell relative h-[420px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
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
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-zinc-900">{selectedLocationLabel}</h4>
                  <p className="mt-1 text-xs text-zinc-400">{formatNumber(selectedLocation.memberCount)} members</p>
                </div>
                <button type="button" onClick={() => setSelectedCityId("")} className="text-xs font-medium text-ipn hover:underline">
                  Back to locations
                </button>
              </div>
              <div className="mt-4 max-h-[340px] overflow-y-auto border-t border-zinc-100 pt-3 pr-2">
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
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-4 py-3">
                <h4 className="text-sm font-semibold text-zinc-900">{geoView === "country" ? "Countries" : "Cities"} by members</h4>
                <p className="mt-1 text-xs text-zinc-400">Select a location to view its members.</p>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {activeLocations.map((location, index) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => selectLocation(location)}
                    className="flex w-full items-center gap-3 border-b border-zinc-100 px-3 py-2.5 text-left text-xs text-zinc-600 last:border-b-0 hover:bg-zinc-50"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ipn-light font-semibold text-ipn">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-zinc-700">
                      {geoView === "country"
                        ? location.country
                        : [location.city, location.state, location.country].filter(Boolean).join(", ")}
                    </span>
                    {location.lat == null || location.lng == null ? (
                      <span className="flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">No marker</span>
                    ) : geoView === "city" && location.coordinatePrecision === "country" ? (
                      <span className="flex-shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">Country fallback</span>
                    ) : null}
                    <span className="flex-shrink-0 tabular-nums text-zinc-400">{formatNumber(location.memberCount)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
                  WhatsApp contact {detail.whatsappConnected ? "provided" : "not provided"}
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
                { label: "Heard about us — other details", value: detail.portal.referralSourceOther },
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

              {detail.portal.education.length > 0 && (
                <section className="border-t border-zinc-200 py-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Education</h3>
                  <div className="mt-4 flex flex-col gap-3">
                    {detail.portal.education.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                        <p className="text-sm font-medium text-zinc-800">{entry.institution}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {[
                            educationLevelLabel(entry.educationLevel),
                            entry.degreeCredential,
                            entry.areaOfStudy,
                            entry.status === "currently_enrolled" ? "Currently enrolled" : entry.status === "completed" ? "Completed / alumni" : entry.status,
                            entry.graduationYear ? `Class of ${entry.graduationYear}` : "",
                          ].filter(Boolean).join(" · ") || "Legacy education record"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

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

              {detail.canViewSensitive && <section className="border-t border-zinc-200 py-5">
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
              </section>}
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
  const [fromDate, setFromDate] = useUrlFilterState("rm_from", "")
  const [toDate, setToDate] = useUrlFilterState("rm_to", "")
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("rm_granularity", "monthly")
  const [whatsappFilter, setWhatsappFilter] = useState("all")
  const [mailchimpFilter, setMailchimpFilter] = useState("all")
  const [countryFilter, setCountryFilter] = useState("all")
  const [stateFilter, setStateFilter] = useState("all")
  const [fieldFilter, setFieldFilter] = useState("all")
  const [psychedelicFilter, setPsychedelicFilter] = useState("all")
  const [sortKey, setSortKey] = useState<"name" | "firstSeenAt" | "sourceCount" | "eventCount">("firstSeenAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [sourceFilter, setSourceFilter] = useUrlFilterState<keyof MemberDirectorySources | "all">("rm_source", "all")
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
        if (query && !`${row.name} ${row.email} ${row.location} ${row.primaryField} ${row.schools.join(" ")}`.toLowerCase().includes(query)) return false
        if (!isWithinDateRange(row.firstSeenAt, fromDate, toDate)) return false
        if (sourceFilter !== "all" && !row.sources[sourceFilter]) return false
        if (whatsappFilter === "connected" && !row.whatsappConnected) return false
        if (whatsappFilter === "not_connected" && row.whatsappConnected) return false
        if (mailchimpFilter !== "all" && row.mailchimpStatus !== mailchimpFilter) return false
        if (countryFilter !== "all" && row.country !== countryFilter) return false
        if (stateFilter !== "all" && row.state !== stateFilter) return false
        if (fieldFilter !== "all" && row.primaryField !== fieldFilter) return false
        if (psychedelicFilter !== "all" && row.psychedelicFieldStatus !== psychedelicFilter) return false
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
  }, [countryFilter, fieldFilter, fromDate, mailchimpFilter, psychedelicFilter, rows, search, sortDirection, sortKey, sourceFilter, stateFilter, toDate, whatsappFilter])

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
  const reportingEnd = toDate || new Date().toISOString().slice(0, 10)
  const rollingThirtyStart = rollingWindowStart(reportingEnd)
  const portalProfiles = memberInsights?.profiles ?? []
  const totalMembershipAsOfEnd = rows.filter((row) => {
    const query = search.trim().toLowerCase()
    if (query && !`${row.name} ${row.email} ${row.location} ${row.primaryField} ${row.schools.join(" ")}`.toLowerCase().includes(query)) return false
    if (row.firstSeenAt && row.firstSeenAt.slice(0, 10) > reportingEnd) return false
    if (sourceFilter !== "all" && !row.sources[sourceFilter]) return false
    if (whatsappFilter === "connected" && !row.whatsappConnected) return false
    if (whatsappFilter === "not_connected" && row.whatsappConnected) return false
    if (mailchimpFilter !== "all" && row.mailchimpStatus !== mailchimpFilter) return false
    if (countryFilter !== "all" && row.country !== countryFilter) return false
    if (stateFilter !== "all" && row.state !== stateFilter) return false
    if (fieldFilter !== "all" && row.primaryField !== fieldFilter) return false
    if (psychedelicFilter !== "all" && row.psychedelicFieldStatus !== psychedelicFilter) return false
    return true
  }).length
  const portalRegistrationsAsOfEnd = portalProfiles.filter((profile) => (
    !profile.created_at || profile.created_at.slice(0, 10) <= reportingEnd
  )).length
  const newPortalAccountsLast30Days = portalProfiles.filter((profile) => (
    Boolean(profile.created_at) && profile.created_at!.slice(0, 10) >= rollingThirtyStart && profile.created_at!.slice(0, 10) <= reportingEnd
  )).length
  const unfilteredSourceTotals = directory?.sourceTotals ?? []
  const filteredSourceTotals = MEMBER_SOURCE_LABELS.map((source) => ({
    label: source.label,
    value: filteredRows.filter((row) => row.sources[source.id]).length,
  }))
  const sourceTotals = filteredRows.length === rows.length ? unfilteredSourceTotals : filteredSourceTotals
  const filteredCharts = directory ? buildFilteredMemberCharts(filteredRows, directory) : null
  const filteredGeography = directory ? buildFilteredMemberGeography(filteredRows, directory) : []

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
        <FilterField label="WhatsApp contact">
          <SelectInput value={whatsappFilter} onChange={(value) => { setWhatsappFilter(value); setPage(0) }} options={[
            { value: "all", label: "All" },
            { value: "connected", label: "Contact provided" },
            { value: "not_connected", label: "No contact provided" },
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
      </FilterBar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total membership" value={formatNumber(totalMembershipAsOfEnd)} helper={`Cumulative through ${formatDate(reportingEnd)} · ${formatNumber(rows.length)} merged records`} />
        <StatCard label="Member Portal registrations" value={formatNumber(portalRegistrationsAsOfEnd)} helper="Portal-only; membership-source filters do not change this total" />
        <StatCard label="New accounts · last 30 days" value={formatNumber(newPortalAccountsLast30Days)} helper={`${formatDate(rollingThirtyStart)}–${formatDate(reportingEnd)}`} />
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
        {filteredCharts && <Panel title="Top schools" subtitle={sampleSubtitle(filteredCharts.topSchools)} className="lg:col-span-2"><BarList items={filteredCharts.topSchools} /></Panel>}
        {filteredCharts && <DistributionChartPair title="Current role" items={filteredCharts.bestDescribes} otherVariants={filteredCharts.otherVariants.bestDescribes} coverageTotal={filteredRows.length} coverageAnswered={filteredCharts.coverage.role} />}
        {filteredCharts && <DistributionChartPair title="Primary field" items={filteredCharts.primaryField} otherVariants={filteredCharts.otherVariants.primaryField} coverageTotal={filteredRows.length} coverageAnswered={filteredCharts.coverage.primaryField} />}
        {filteredCharts && <DistributionChartPair title="How members heard about IPN" items={filteredCharts.referralSources} otherVariants={filteredCharts.otherVariants.referralSources} coverageTotal={filteredRows.length} coverageAnswered={filteredCharts.coverage.referral} />}
        {filteredCharts && <DistributionChartPair title="Psychedelic-field involvement" items={filteredCharts.psychedelicFieldStatus} otherVariants={filteredCharts.otherVariants.psychedelicFieldStatus} coverageTotal={filteredRows.length} coverageAnswered={filteredCharts.coverage.psychedelicStatus} />}
        {filteredCharts && <DistributionChartPair title="Barriers" items={filteredCharts.psychedelicFieldBarriers} otherVariants={filteredCharts.otherVariants.psychedelicFieldBarriers} coverageTotal={filteredCharts.coverage.barrierApplicable} coverageAnswered={filteredCharts.coverage.barrierAnswered} percentageDenominator={filteredCharts.coverage.barrierApplicable} />}
        <MembershipGeographyPanel locations={filteredGeography} />
      </div>

      <Panel title="Member Directory" subtitle={`Showing ${formatNumber(filteredRows.length)} of ${formatNumber(rows.length)} merged members. Click a row to open full detail.`}>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {["Name", "Email", "Location", "Primary Field", "First Seen", "Sources", "WhatsApp contact", "Mailchimp"].map((label) => (
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
                        {row.whatsappConnected ? "Provided" : "Not provided"}
                      </span>
                    </td>
                    <td className="px-3 py-3"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span></td>
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

function RegistrationMembershipPanel({
  memberInsights,
  portalUtilization,
}: {
  memberInsights: MemberInsightsData | null
  portalUtilization: PortalUtilizationData
}) {
  const registrationRows = portalUtilization.funnel.filter((row) => row.device === "all" && row.audience === "all")
  const errorRows = portalUtilization.errors.filter((row) => row.device === "all" && row.audience === "all")
  const registrationTrend = registrationRows.map((row) => ({
    date: row.date,
    visits: row.registrationTraffic,
    registrations: row.registrationCompleted,
    conversion: row.registrationConversion,
  }))

  return (
    <div className="flex flex-col gap-6">
      <CombinedMembersPanel memberInsights={memberInsights} />
      <Panel title="Portal registration trend" subtitle="Portal-only acquisition; membership-source filters above do not change this funnel.">
        {registrationTrend.length ? (
          <ResponsiveChart height={300}>
            <ComposedChart data={registrationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar yAxisId="count" dataKey="registrations" name="Registrations" fill="#6f51aa" radius={[5, 5, 0, 0]} />
              <Line yAxisId="count" dataKey="visits" name="Registration visits" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line yAxisId="rate" dataKey="conversion" name="Conversion" stroke="#0f766e" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveChart>
        ) : <EmptyState title="No registration trend yet" description="Portal registration tracking will populate this report as events arrive." />}
      </Panel>
      <details className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
          Registration errors {errorRows.length ? `· ${formatNumber(errorRows.reduce((sum, row) => sum + row.count, 0))}` : "· none"}
        </summary>
        <div className="mt-4">
          {errorRows.length ? (
            <SimpleTable
              columns={[
                { key: "date", label: "Date" },
                { key: "error", label: "Error" },
                { key: "page", label: "Page" },
                { key: "count", label: "Count", align: "right" },
              ]}
              rows={errorRows.map((row) => ({ date: formatDate(row.date), error: row.errorCode, page: row.page, count: formatNumber(row.count) }))}
            />
          ) : <p className="text-sm text-emerald-700">No tracked registration or sign-in errors.</p>}
        </div>
      </details>
    </div>
  )
}

function rollingWindowStart(endDate: string, days = 30) {
  const end = new Date(`${endDate}T00:00:00.000Z`)
  return new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function ErrorDetailsModal({
  date,
  rows,
  onClose,
}: {
  date: string
  rows: PortalUtilizationData["errors"]
  onClose: () => void
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 sm:items-center sm:px-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="error-details-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ipn">Error detail</p>
            <h2 id="error-details-title" className="mt-1 text-lg font-semibold text-zinc-900">{formatDate(date)}</h2>
            <p className="mt-1 text-sm text-zinc-500">Frequency by error and page for the selected audience and device.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">
          {rows.length ? (
            <SimpleTable
              columns={[
                { key: "error", label: "Error" },
                { key: "page", label: "Page" },
                { key: "count", label: "Count", align: "right" },
              ]}
              rows={rows.map((row) => ({
                error: row.errorCode,
                page: row.page,
                count: formatNumber(row.count),
              }))}
            />
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-sm text-emerald-800">
              No registration or sign-in errors were recorded on this day.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function MauDetailsModal({
  row,
  onClose,
}: {
  row: PortalUtilizationData["monthlyActiveUsers"][number]
  onClose: () => void
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 sm:items-center sm:px-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mau-details-title"
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ipn">Monthly active users</p>
            <h2 id="mau-details-title" className="mt-1 text-lg font-semibold text-zinc-900">{formatDate(row.date)}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Members with a qualifying action from {formatDate(rollingWindowStart(row.date))} through {formatDate(row.date)}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">
          <SimpleTable
            columns={[
              { key: "name", label: "Full name" },
              { key: "email", label: "Email" },
              { key: "sessions", label: "Unique sessions", align: "right" },
            ]}
            rows={row.members.map((member) => ({
              name: member.fullName,
              email: member.email || "-",
              sessions: formatNumber(member.uniqueSessions),
            }))}
          />
        </div>
      </section>
    </div>
  )
}

function JourneyDetailsModal({
  journey,
  onClose,
}: {
  journey: PortalUtilizationData["journeys"][number]
  onClose: () => void
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 sm:items-center sm:px-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-details-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ipn">Session journey</p>
            <h2 id="journey-details-title" className="mt-1 truncate text-lg font-semibold text-zinc-900">
              {journey.memberName || journey.memberEmail || "Anonymous member"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {journey.startType === "registration" ? "Registered" : "Signed in"} {formatDateTime(journey.startedAt)} · {journey.device}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-700">
              {formatTrackedDuration(journey.durationSeconds)} overall tracked page time
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 sm:px-6">
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="hidden w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 sm:table-cell">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Step</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 md:table-cell">Page</th>
                  <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-400">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {journey.steps.map((step, index) => (
                  <tr key={`${step.occurredAt}-${step.eventName}-${index}`}>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-zinc-500 sm:table-cell">{formatDateTime(step.occurredAt)}</td>
                    <td className="px-4 py-3 font-medium text-zinc-700">{step.label}</td>
                    <td className="hidden break-all px-4 py-3 text-zinc-500 md:table-cell">{step.page}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-600">
                      {formatTrackedDuration(step.durationSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function JourneyFlowNodeShape({
  x,
  y,
  width,
  height,
  payload,
  onExplore,
}: SankeyNodeProps & { onExplore?: (node: PortalJourneyFlowNode) => void }) {
  const node = payload as typeof payload & PortalJourneyFlowNode
  const nodeHeight = Math.max(height, 8)
  const labelY = y + Math.max(height, 18) / 2
  const sessionLabel = `${formatNumber(node.sessions)} ${node.sessions === 1 ? "session" : "sessions"}`
  const isTerminal = node.label === "End session" || node.label.startsWith("Exited")
  const isSelectable = Boolean(onExplore && node.hasChildren)
  const fill = isTerminal
    ? "#a1a1aa"
    : node.selected === false
      ? "#c4b5fd"
      : node.step === 0 ? "#5b3f92" : "#6f51aa"

  function selectNode() {
    if (isSelectable) onExplore?.(node)
  }

  return (
    <g
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      aria-label={isSelectable ? `Explore next steps after ${node.label}` : undefined}
      className={isSelectable ? "cursor-pointer" : undefined}
      onClick={selectNode}
      onKeyDown={(event) => {
        if (isSelectable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          selectNode()
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={nodeHeight}
        rx={3}
        fill={fill}
      />
      <text x={x + width + 9} y={labelY - 5} fill="#27272a" fontSize={12} fontWeight={600}>
        {truncate(node.label, 25)}
      </text>
      <text x={x + width + 9} y={labelY + 12} fill="#71717a" fontSize={11}>
        {sessionLabel} · {formatPercent(node.percentOfPrior)} of prior step
      </text>
      <title>{node.label}: {sessionLabel}, {formatPercent(node.percentOfPrior)} of the prior step</title>
    </g>
  )
}

function PortalSankeyFlowChart({
  flow,
  onNodeSelect,
}: {
  flow: PortalJourneyFlowData
  onNodeSelect?: (node: PortalJourneyFlowNode) => void
}) {
  const height = Math.min(660, Math.max(380, flow.maxNodesInStep * 78))
  const stepCount = Math.max(flow.maxStep + 1, 1)
  const minWidth = Math.max(1100, stepCount * 220 + 210)
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50/50">
      <div className="px-3 py-4" style={{ minWidth: `${minWidth}px` }}>
        <div
          className="grid border-b border-zinc-200 pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
          style={{
            gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))`,
            paddingLeft: "20px",
            paddingRight: "210px",
          }}
        >
          {Array.from({ length: stepCount }, (_, index) => (
            <span key={index}>Step {index + 1}</span>
          ))}
        </div>
        <div style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <Sankey
              data={{ nodes: flow.nodes, links: flow.links }}
              node={(props: SankeyNodeProps) => (
                <JourneyFlowNodeShape {...props} onExplore={onNodeSelect} />
              )}
              nodeWidth={14}
              nodePadding={38}
              link={{ stroke: "#a78bfa", strokeOpacity: 0.28 }}
              linkCurvature={0.55}
              align="left"
              iterations={onNodeSelect ? 0 : undefined}
              sort={onNodeSelect ? false : undefined}
              margin={{ top: 14, right: 210, bottom: 14, left: 20 }}
            >
              <Tooltip formatter={(value) => {
                const sessions = Number(value)
                return [`${formatNumber(sessions)} ${sessions === 1 ? "session" : "sessions"}`, "Flow"]
              }} />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function JourneyFlowChart({ journeys }: { journeys: PortalUtilizationData["journeys"] }) {
  const [visibleSteps, setVisibleSteps] = useState(JOURNEY_FLOW_DEFAULT_STEPS)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Record<number, string>>({})
  const fullFlow = useMemo(() => buildPortalJourneyFlow(journeys, 6, visibleSteps), [journeys, visibleSteps])
  const flow = useMemo(
    () => buildFocusedPortalJourneyFlow(fullFlow, selectedNodeIds),
    [fullFlow, selectedNodeIds],
  )
  const cappedTotalSteps = Math.min(fullFlow.totalSteps, JOURNEY_FLOW_MAX_STEPS)
  const displayedSteps = Math.min(visibleSteps, cappedTotalSteps)
  const nextVisibleSteps = Math.min(visibleSteps + JOURNEY_FLOW_STEP_INCREMENT, cappedTotalSteps)
  const canShowMore = displayedSteps < cappedTotalSteps
  const isAtStepCap = visibleSteps >= JOURNEY_FLOW_MAX_STEPS && fullFlow.totalSteps > JOURNEY_FLOW_MAX_STEPS

  function selectJourneyNode(node: PortalJourneyFlowNode) {
    setSelectedNodeIds((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([step]) => Number(step) < node.step),
      ) as Record<number, string>
      next[node.step] = node.id
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-zinc-500">
          Showing steps 1–{displayedSteps} of {cappedTotalSteps}
          {fullFlow.totalSteps > JOURNEY_FLOW_MAX_STEPS ? " (15-step chart limit)" : ""}.
        </p>
        <div className="flex flex-wrap gap-2">
          {visibleSteps > JOURNEY_FLOW_DEFAULT_STEPS && (
            <button
              type="button"
              onClick={() => setVisibleSteps((current) => Math.max(JOURNEY_FLOW_DEFAULT_STEPS, current - JOURNEY_FLOW_STEP_INCREMENT))}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Show fewer steps
            </button>
          )}
          {canShowMore && (
            <button
              type="button"
              onClick={() => setVisibleSteps(nextVisibleSteps)}
              className="rounded-lg border border-ipn/20 bg-ipn/5 px-3 py-1.5 text-xs font-medium text-ipn hover:bg-ipn/10"
            >
              Show {nextVisibleSteps - displayedSteps} more {nextVisibleSteps - displayedSteps === 1 ? "step" : "steps"}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs leading-5 text-zinc-500">
        The most common continuing path is selected by default. Select another event to explore its next steps.
      </p>
      <PortalSankeyFlowChart flow={flow} onNodeSelect={selectJourneyNode} />
      {fullFlow.truncatedSessions > 0 && (
        <p className="text-xs leading-5 text-zinc-500">
          {formatNumber(fullFlow.truncatedSessions)} {fullFlow.truncatedSessions === 1 ? "session continues" : "sessions continue"} beyond step {displayedSteps}.
          {isAtStepCap
            ? " Complete paths remain available in the individual sessions table below."
            : " Select Show more steps to continue the aggregate path."}
        </p>
      )}
    </div>
  )
}

function RegistrationStepFlowChart({ counts }: { counts: RegistrationFlowCounts }) {
  const flow = useMemo(() => buildRegistrationStepFlow(counts), [counts])
  return <PortalSankeyFlowChart flow={flow} />
}

function MauChartDot({
  cx,
  cy,
  payload,
  onSelect,
  window = "monthly",
}: {
  cx?: number
  cy?: number
  payload?: { date?: string; users?: number }
  onSelect: (date: string) => void
  window?: ActiveUserWindow
}) {
  if (cx == null || cy == null || !payload?.date) return <g />
  function selectDate() {
    if (payload?.date) onSelect(payload.date)
  }
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`View ${formatNumber(payload.users ?? 0)} ${window} active users for ${formatDate(payload.date)}`}
      className="cursor-pointer"
      onClick={(event) => { event.currentTarget.focus(); selectDate() }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          event.currentTarget.focus()
          selectDate()
        }
      }}
    >
      <circle cx={cx} cy={cy} r={10} fill="transparent" />
      <circle cx={cx} cy={cy} r={3} fill="#fff" stroke="#6f51aa" strokeWidth={2.5} />
    </g>
  )
}

function PortalUtilizationPanel({ data, mode = "all" }: { data: PortalUtilizationData; mode?: "all" | "activity" }) {
  const [registrationFrom, setRegistrationFrom] = useUrlFilterState("pa_registration_from", "")
  const [registrationTo, setRegistrationTo] = useUrlFilterState("pa_registration_to", "")
  const [fromDate, setFromDate] = useUrlFilterState("pa_activity_from", mode === "activity" ? rollingWindowStart(data.dateRange.last ?? new Date().toISOString().slice(0, 10), 30) : "")
  const [toDate, setToDate] = useUrlFilterState("pa_activity_to", mode === "activity" ? data.dateRange.last ?? new Date().toISOString().slice(0, 10) : "")
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("pa_granularity", "daily")
  const [device, setDevice] = useState<DeviceFilter>("all")
  const [audience, setAudience] = useState<AudienceFilter>("all")
  const [selectedErrorDate, setSelectedErrorDate] = useState<string | null>(null)
  const [selectedMauDate, setSelectedMauDate] = useState<string | null>(null)
  const [journeyStart, setJourneyStart] = useState<"registration" | "sign_in">("sign_in")
  const [selectedJourney, setSelectedJourney] = useState<PortalUtilizationData["journeys"][number] | null>(null)
  const [visiblePages, setVisiblePages] = useState<PortalPageCategory[]>(() => [...PORTAL_PAGE_CATEGORIES])
  const [memberSearch, setMemberSearch] = useState("")
  const [memberPage, setMemberPage] = useState(0)
  const [memberSortKey, setMemberSortKey] = useState<MemberUtilizationSortKey>("lastSignedInAt")
  const [memberSortDirection, setMemberSortDirection] = useState<SortDirection>("desc")
  const dates = data.funnel.map((row) => row.date).sort()
  const filteredDates = dates.filter((date) => isWithinDateRange(date, fromDate, toDate))

  const filteredFunnelRows = data.funnel.filter((row) => (
    row.device === device &&
    row.audience === audience &&
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
  })), granularity), granularity, filteredDates, {
    registrationTraffic: 0,
    registrationCompleted: 0,
    signInTraffic: 0,
    signInCompleted: 0,
  })
  const funnel = funnelBuckets.map((row) => ({
    ...row,
    registrationConversion: row.registrationTraffic ? row.registrationCompleted / row.registrationTraffic * 100 : 0,
    signInConversion: row.signInTraffic ? row.signInCompleted / row.signInTraffic * 100 : 0,
  }))
  const registrationFlowCounts = data.registrationFlow.rows
    .filter((row) => (
      row.device === device &&
      row.audience === audience &&
      isWithinDateRange(row.date, fromDate, toDate)
    ))
    .reduce<RegistrationFlowCounts>((counts, row) => ({
      home: counts.home + row.home,
      account: counts.account + row.account,
      location: counts.location + row.location,
      background: counts.background + row.background,
      about: counts.about + row.about,
      completed: counts.completed + row.completed,
    }), {
      home: 0,
      account: 0,
      location: 0,
      background: 0,
      about: 0,
      completed: 0,
    })

  const windowEnd = data.dateRange.last
  const windowStart = windowEnd ? rollingWindowStart(windowEnd) : null
  const lastThirtyDays = data.funnel.filter((row) => (
    row.device === device &&
    row.audience === audience &&
    Boolean(windowStart && windowEnd && row.date >= windowStart && row.date <= windowEnd)
  ))
  const registrations30d = lastThirtyDays.reduce((sum, row) => sum + row.registrationCompleted, 0)
  const registrationTraffic30d = lastThirtyDays.reduce((sum, row) => sum + row.registrationTraffic, 0)
  const signIns30d = lastThirtyDays.reduce((sum, row) => sum + row.signInCompleted, 0)
  const signInTraffic30d = lastThirtyDays.reduce((sum, row) => sum + row.signInTraffic, 0)
  const latestMau = data.monthlyActiveUsers
    .filter((row) => row.device === device && row.audience === audience && (!windowEnd || row.date <= windowEnd))
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.users ?? 0

  const filteredMauRows = data.monthlyActiveUsers.filter((row) => (
    row.device === device &&
    row.audience === audience &&
    isWithinDateRange(row.date, fromDate, toDate)
  ))
  const mauByBucket = new Map<string, { label: string; date: string; users: number }>()
  for (const row of filteredMauRows) {
    const bucket = analyticsGranularityBucket(new Date(`${row.date}T00:00:00.000Z`), granularity)
    const current = mauByBucket.get(bucket.key)
    if (!current || row.date > current.date) {
      mauByBucket.set(bucket.key, { label: bucket.label, date: row.date, users: row.users })
    }
  }
  const mauTrend = Array.from(mauByBucket.values()).sort((a, b) => a.date.localeCompare(b.date))
  const selectedMauRow = selectedMauDate
    ? data.monthlyActiveUsers.find((row) => (
      row.date === selectedMauDate &&
      row.device === device &&
      row.audience === audience
    )) ?? null
    : null

  const filteredErrors = data.errors.filter((row) => (
    row.device === device &&
    row.audience === audience &&
    isWithinDateRange(row.date, fromDate, toDate)
  ))
  const errorTrend = fillMetricBuckets(
    aggregateByGranularity(filteredErrors.map((row) => ({
      date: row.date,
      values: { errors: row.count },
    })), "daily"),
    "daily",
    filteredDates,
    { errors: 0 },
  ).map((row) => ({ date: row.label, errors: row.errors }))
  const selectedErrors = selectedErrorDate
    ? filteredErrors.filter((row) => row.date === selectedErrorDate).sort((a, b) => b.count - a.count)
    : []

  const filteredPageViews = data.pageViews.filter((row) => (
    row.device === device &&
    row.audience === audience &&
    isWithinDateRange(row.date, fromDate, toDate)
  ))
  const emptyPageViews = Object.fromEntries(PORTAL_PAGE_CATEGORIES.map((page) => [page, 0])) as Record<string, number>
  const pageViewTrend = fillMetricBuckets(
    aggregateByGranularity(filteredPageViews.map((row) => ({
      date: row.date,
      values: { [row.page]: row.views },
    })), granularity),
    granularity,
    filteredDates,
    emptyPageViews,
  )

  const membersByEmail = useMemo(
    () => new Map(data.members.filter((member) => member.email).map((member) => [member.email, member])),
    [data.members],
  )
  const filteredJourneys = data.journeys.filter((journey) => (
    journey.startType === journeyStart &&
    (audience === "all" || journey.audience === audience) &&
    (device === "all" || journey.device === device) &&
    isWithinDateRange(journey.startedAt, fromDate, toDate) &&
    (mode !== "activity" || (() => {
      const member = membersByEmail.get(journey.memberEmail)
      return !member || isWithinDateRange(member.firstRegisteredAt, registrationFrom, registrationTo)
    })())
  ))

  const filteredMemberActivity = useMemo(() => {
    const memberQuery = memberSearch.trim().toLowerCase()

    function compareNullableDates(a: string | null, b: string | null) {
      if (!a && !b) return 0
      if (!a) return 1
      if (!b) return -1
      return memberSortDirection === "asc" ? a.localeCompare(b) : b.localeCompare(a)
    }

    function compareValues(a: number | string, b: number | string) {
      const comparison = typeof a === "number" && typeof b === "number"
        ? a - b
        : String(a).localeCompare(String(b))
      return memberSortDirection === "asc" ? comparison : -comparison
    }

    return data.members
      .filter((member) => (
        (audience === "all" || member.audience === audience) &&
        (mode !== "activity" || isWithinDateRange(member.firstRegisteredAt, registrationFrom, registrationTo)) &&
        (!memberQuery ||
          member.fullName.toLowerCase().includes(memberQuery) ||
          member.email.toLowerCase().includes(memberQuery))
      ))
      .sort((a, b) => {
        const aActivity = a.signInActivity[device]
        const bActivity = b.signInActivity[device]
        let comparison = 0

        switch (memberSortKey) {
          case "firstRegisteredAt":
            comparison = compareNullableDates(a.firstRegisteredAt, b.firstRegisteredAt)
            break
          case "lastSignedInAt":
            comparison = compareNullableDates(aActivity.lastSignedInAt, bActivity.lastSignedInAt)
            break
          case "signInsLast30Days":
            comparison = compareValues(aActivity.signInsLast30Days, bActivity.signInsLast30Days)
            break
          case "connectionCount":
            comparison = compareValues(a.connectionCount, b.connectionCount)
            break
          case "whatsappConnected":
            comparison = compareValues(Number(a.whatsappConnected), Number(b.whatsappConnected))
            break
          case "mailchimpStatus":
            comparison = compareValues(
              mailchimpBadge(a.mailchimpStatus as MailchimpStatus | null).label,
              mailchimpBadge(b.mailchimpStatus as MailchimpStatus | null).label,
            )
            break
        }

        return comparison || a.fullName.localeCompare(b.fullName) || a.email.localeCompare(b.email)
      })
  }, [audience, data.members, device, memberSearch, memberSortDirection, memberSortKey, mode, registrationFrom, registrationTo])
  const memberPageSize = 25
  const memberTotalPages = Math.max(1, Math.ceil(filteredMemberActivity.length / memberPageSize))
  const currentMemberPage = Math.min(memberPage, memberTotalPages - 1)
  const memberPageRows = filteredMemberActivity.slice(
    currentMemberPage * memberPageSize,
    (currentMemberPage + 1) * memberPageSize,
  )

  const deviceOptions = [
    { value: "all", label: "All devices" },
    ...data.trafficDevices.map((item) => ({
      value: item.label,
      label: item.label === "unknown" ? "Unknown" : item.label[0].toUpperCase() + item.label.slice(1),
    })),
  ]
  const allPagesVisible = visiblePages.length === PORTAL_PAGE_CATEGORIES.length

  function openErrorDay(point: unknown) {
    const payload = point as { date?: string; payload?: { date?: string } }
    const date = payload.date ?? payload.payload?.date
    if (date) setSelectedErrorDate(date)
  }

  function togglePage(page: PortalPageCategory) {
    setVisiblePages((current) => (
      current.includes(page)
        ? current.filter((item) => item !== page)
        : PORTAL_PAGE_CATEGORIES.filter((item) => item === page || current.includes(item))
    ))
  }

  function changeMemberSort(key: MemberUtilizationSortKey, defaultDirection: SortDirection) {
    setMemberSortDirection(
      memberSortKey === key
        ? memberSortDirection === "desc" ? "asc" : "desc"
        : defaultDirection,
    )
    setMemberSortKey(key)
    setMemberPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        {mode === "activity" && <FilterField label="Registration from">
          <input type="date" value={registrationFrom} onChange={(event) => setRegistrationFrom(event.target.value)} className={inputClassName} />
        </FilterField>}
        {mode === "activity" && <FilterField label="Registration to">
          <input type="date" value={registrationTo} onChange={(event) => setRegistrationTo(event.target.value)} className={inputClassName} />
        </FilterField>}
        <FilterField label={mode === "activity" ? "Activity from" : "From date"}>
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label={mode === "activity" ? "Activity to" : "To date"}>
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Granularity">
          <SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
          ]} />
        </FilterField>
        <FilterField label="Member type">
          <SelectInput value={audience} onChange={(value) => {
            setAudience(value as AudienceFilter)
            setMemberPage(0)
          }} options={[
            { value: "all", label: "All" },
            { value: "leadership", label: "IPN leadership" },
            { value: "member", label: "IPN members" },
          ]} />
        </FilterField>
        <FilterField label="Device">
          <SelectInput value={device} onChange={(value) => {
            setDevice(value as DeviceFilter)
            setMemberPage(0)
          }} options={deviceOptions} />
        </FilterField>
      </FilterBar>

      {!data.trackingAvailable && (
        <EmptyState
          title="Utilization tracking is unavailable"
          description={data.trackingError ?? "The first-party Portal analytics event stream could not be loaded."}
        />
      )}

      {data.trackingAvailable && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          Live Portal activity is available through <span className="font-semibold">{formatDate(data.dateRange.last)}</span>.
          Metrics use first-party events; session-level detail is retained for {data.rawRetentionDays} days.
        </div>
      )}

      {mode !== "activity" && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Portal registrations (30d)" value={formatNumber(registrations30d)} helper="Successful member registrations" />
        <StatCard label="Portal sign-ins (30d)" value={formatNumber(signIns30d)} helper="Successful member sign-ins" />
        <StatCard label="Monthly active users" value={formatNumber(latestMau)} helper="Qualifying action in the rolling 30 days" />
        <StatCard label="Registration conversion (30d)" value={formatPercent(registrationTraffic30d ? registrations30d / registrationTraffic30d * 100 : 0)} helper={`${formatNumber(registrations30d)} completed / ${formatNumber(registrationTraffic30d)} sessions`} />
        <StatCard label="Sign-in conversion (30d)" value={formatPercent(signInTraffic30d ? signIns30d / signInTraffic30d * 100 : 0)} helper={`${formatNumber(signIns30d)} completed / ${formatNumber(signInTraffic30d)} sessions`} />
      </div>

      <Panel title="Registration funnel over time" subtitle="Unique traffic sessions, completed registrations, and conversion rate">
        {funnel.length ? (
          <ResponsiveChart height={320}>
            <LineChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line yAxisId="count" type="monotone" dataKey="registrationTraffic" name="Registration traffic" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line yAxisId="count" type="monotone" dataKey="registrationCompleted" name="Completed registrations" stroke="#5b3f92" strokeWidth={2.5} dot={false} />
              <Line yAxisId="rate" type="monotone" dataKey="registrationConversion" name="Conversion rate" stroke="#a78bfa" strokeWidth={2.5} strokeDasharray="6 5" dot={false} />
            </LineChart>
          </ResponsiveChart>
        ) : (
          <EmptyState title="No registration funnel data" description="No tracked registration activity matches the current filters." />
        )}
      </Panel>

      <Panel
        title="Registration step drop-off"
        subtitle={data.registrationFlow.trackingStartedAt
          ? `Home-to-registration journeys tracked since ${formatDate(data.registrationFlow.trackingStartedAt)}`
          : "No registration step events have been recorded yet"}
      >
        {registrationFlowCounts.home ? (
          <div>
            <p className="mb-3 text-xs leading-5 text-zinc-500">
              Includes sessions that visit the Portal home page before entering registration. Gray branches show where a session exited; incomplete registrations can only be assigned a member type after account creation.
            </p>
            <RegistrationStepFlowChart counts={registrationFlowCounts} />
          </div>
        ) : (
          <EmptyState
            title="No tracked home-to-registration journeys yet"
            description="Steps are recorded as they are viewed; the session does not need to be closed. Only journeys that begin on the Portal home page and then continue through Account, Location, Background, About You, and account creation are included."
          />
        )}
      </Panel>

      <Panel title="Sign-in funnel over time" subtitle="Unique traffic sessions, completed sign-ins, and conversion rate">
        {funnel.length ? (
          <ResponsiveChart height={320}>
            <LineChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line yAxisId="count" type="monotone" dataKey="signInTraffic" name="Sign-in traffic" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line yAxisId="count" type="monotone" dataKey="signInCompleted" name="Completed sign-ins" stroke="#5b3f92" strokeWidth={2.5} dot={false} />
              <Line yAxisId="rate" type="monotone" dataKey="signInConversion" name="Conversion rate" stroke="#a78bfa" strokeWidth={2.5} strokeDasharray="6 5" dot={false} />
            </LineChart>
          </ResponsiveChart>
        ) : (
          <EmptyState title="No sign-in funnel data" description="No tracked sign-in activity matches the current filters." />
        )}
      </Panel>

      <Panel title="Monthly active users over time" subtitle="Rolling 30-day unique members with a qualifying action. Click a date to see members and action-bearing sessions.">
        {mauTrend.length ? (
          <ResponsiveChart height={300}>
            <LineChart data={mauTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Line
                type="monotone"
                dataKey="users"
                name="Monthly active users"
                stroke="#6f51aa"
                strokeWidth={2.5}
                dot={<MauChartDot onSelect={setSelectedMauDate} />}
                activeDot={{ r: 6, pointerEvents: "none" }}
              />
            </LineChart>
          </ResponsiveChart>
        ) : (
          <EmptyState title="No monthly active users yet" description="This metric populates when a member signs in and then interacts with the Portal." />
        )}
      </Panel>

      <Panel title="Errors over time" subtitle="Registration and sign-in errors. Click a day to see error frequency and page detail.">
        {errorTrend.length ? (
          <ResponsiveChart height={280}>
            <BarChart data={errorTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="errors" name="Errors" fill="#dc2626" radius={[6, 6, 0, 0]} cursor="pointer" onClick={openErrorDay} />
            </BarChart>
          </ResponsiveChart>
        ) : (
          <EmptyState title="No tracked errors" description="No registration or sign-in errors match the current filters." />
        )}
      </Panel>
      </>}

      <Panel title="Page views over time" subtitle="Unique route visits, counted once per session per day. Feedback represents modal opens; use Member type to separate leadership testing from member usage.">
        {pageViewTrend.length ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Pages shown in the chart">
              <button
                type="button"
                aria-pressed={allPagesVisible}
                onClick={() => setVisiblePages(allPagesVisible ? [] : [...PORTAL_PAGE_CATEGORIES])}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  allPagesVisible
                    ? "border-ipn bg-ipn text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                All pages
              </button>
              {PORTAL_PAGE_CATEGORIES.map((page) => {
                const isVisible = visiblePages.includes(page)
                return (
                  <button
                    key={page}
                    type="button"
                    aria-pressed={isVisible}
                    onClick={() => togglePage(page)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isVisible
                        ? "border-zinc-300 bg-white text-zinc-800 shadow-sm"
                        : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: isVisible ? PORTAL_PAGE_COLORS[page] : "#d4d4d8" }}
                    />
                    {page}
                  </button>
                )
              })}
            </div>
            {visiblePages.length ? (
              <ResponsiveChart height={340}>
                <LineChart data={pageViewTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  {PORTAL_PAGE_CATEGORIES.filter((page) => visiblePages.includes(page)).map((page) => (
                    <Line key={page} type="monotone" dataKey={page} name={page} stroke={PORTAL_PAGE_COLORS[page]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveChart>
            ) : (
              <EmptyState title="No pages selected" description="Choose one or more page buttons above to display their traffic." />
            )}
          </div>
        ) : (
          <EmptyState title="No page views" description="No tracked page views match the current filters." />
        )}
      </Panel>

      <Panel title="Member journeys" subtitle="Aggregate paths and session-level detail after a successful registration or sign-in">
        <div className="mb-5 max-w-xs">
          <FilterField label="Journey starts after">
            <SelectInput value={journeyStart} onChange={(value) => setJourneyStart(value as "registration" | "sign_in")} options={[
              { value: "sign_in", label: "Successful sign-in" },
              { value: "registration", label: "Successful registration" },
            ]} />
          </FilterField>
        </div>
        {filteredJourneys.length ? (
          <div className="space-y-6">
            <div>
              <p className="mb-1 text-sm font-semibold text-zinc-800">Aggregate journey flow</p>
              <p className="mb-3 text-xs leading-5 text-zinc-500">
                Each column is the next tracked page or action after {journeyStart === "registration" ? "registration" : "sign-in"}. Lane width represents sessions; each node shows its session count and share of the preceding step. Low-volume actions are grouped as Other.
              </p>
              <JourneyFlowChart key={journeyStart} journeys={filteredJourneys} />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-zinc-800">Individual sessions</p>
              <SimpleTable
                columns={[
                  { key: "member", label: "Member" },
                  { key: "started", label: "Started" },
                  { key: "duration", label: "Duration", align: "right" },
                  { key: "steps", label: "Steps", align: "right" },
                ]}
                rows={filteredJourneys.slice(0, 20).map((journey) => ({
                  member: (
                    <button type="button" onClick={() => setSelectedJourney(journey)} className="text-left font-medium text-ipn hover:underline">
                      {journey.memberName || journey.memberEmail || "Unknown member"}
                    </button>
                  ),
                  started: formatDateTime(journey.startedAt),
                  duration: formatTrackedDuration(journey.durationSeconds),
                  steps: formatNumber(journey.steps.length),
                }))}
              />
            </div>
          </div>
        ) : (
          <EmptyState title="No matching journeys" description="No successful registration or sign-in sessions match the current filters." />
        )}
      </Panel>

      <Panel
        title="Member utilization directory"
        subtitle={`${formatNumber(filteredMemberActivity.length)} Portal accounts. Member type and device filters apply; sign-in counts use a rolling 30-day window. Select a column header to sort.`}
      >
        <div className="mb-4 max-w-md">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Search members</span>
            <input
              type="search"
              value={memberSearch}
              onChange={(event) => {
                setMemberSearch(event.target.value)
                setMemberPage(0)
              }}
              placeholder="Name or email"
              className={inputClassName}
            />
          </label>
        </div>
        {memberPageRows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200">
                    {["Name", "Email"].map((label) => (
                      <th key={label} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        {label}
                      </th>
                    ))}
                    {MEMBER_UTILIZATION_SORT_COLUMNS.map((column) => {
                      const isActive = memberSortKey === column.key
                      const isNumeric = column.key === "signInsLast30Days" || column.key === "connectionCount"
                      return (
                        <th
                          key={column.key}
                          scope="col"
                          aria-sort={isActive ? memberSortDirection === "asc" ? "ascending" : "descending" : "none"}
                          className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${isNumeric ? "text-right" : "text-left"}`}
                        >
                          <button
                            type="button"
                            onClick={() => changeMemberSort(column.key, column.defaultDirection)}
                            className={`inline-flex items-center gap-1 rounded-sm hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ipn/30 ${isNumeric ? "justify-end" : "justify-start"}`}
                          >
                            <span>{column.label}</span>
                            <span aria-hidden="true" className={isActive ? "text-ipn" : "text-zinc-300"}>
                              {isActive ? memberSortDirection === "asc" ? "↑" : "↓" : "↕"}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {memberPageRows.map((member) => {
                    const signInActivity = member.signInActivity[device]
                    const badge = mailchimpBadge(member.mailchimpStatus as MailchimpStatus | null)
                    return (
                      <tr key={member.userId} className="hover:bg-zinc-50">
                        <td className="max-w-[14rem] px-3 py-3 font-medium text-zinc-800">{member.fullName}</td>
                        <td className="max-w-[17rem] truncate px-3 py-3 text-zinc-500">{member.email || "-"}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-500">{formatDate(member.firstRegisteredAt)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-zinc-500">{formatDateTime(signInActivity.lastSignedInAt)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(signInActivity.signInsLast30Days)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{formatNumber(member.connectionCount)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            member.whatsappConnected
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-zinc-200 bg-zinc-50 text-zinc-500"
                          }`}>
                            {member.whatsappConnected ? "Provided" : "Not provided"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PaginationControls
              page={currentMemberPage}
              totalPages={memberTotalPages}
              onPageChange={setMemberPage}
            />
          </>
        ) : (
          <EmptyState title="No matching members" description="Try a different member type, device, name, or email." />
        )}
      </Panel>

      {selectedErrorDate && (
        <ErrorDetailsModal date={selectedErrorDate} rows={selectedErrors} onClose={() => setSelectedErrorDate(null)} />
      )}
      {selectedMauRow && <MauDetailsModal row={selectedMauRow} onClose={() => setSelectedMauDate(null)} />}
      {selectedJourney && <JourneyDetailsModal journey={selectedJourney} onClose={() => setSelectedJourney(null)} />}
    </div>
  )
}

function OnboardingPanel({ data }: { data: OnboardingAnalyticsData }) {
  const defaultActivityEnd = data.generatedAt.slice(0, 10)
  const [registrationFrom, setRegistrationFrom] = useUrlFilterState("ob_registration_from", "")
  const [registrationTo, setRegistrationTo] = useUrlFilterState("ob_registration_to", "")
  const [activityFrom, setActivityFrom] = useUrlFilterState("ob_activity_from", rollingWindowStart(defaultActivityEnd, 90))
  const [activityTo, setActivityTo] = useUrlFilterState("ob_activity_to", defaultActivityEnd)
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("ob_granularity", "weekly")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const query = search.trim().toLowerCase()
  const cohort = data.members.filter((member) => (
    isWithinDateRange(member.registrationDate, registrationFrom, registrationTo)
    && (!query || `${member.name} ${member.email}`.toLowerCase().includes(query))
  ))
  const completed = cohort.filter((member) => member.completedAt).length
  const progressDistribution = Array.from({ length: 5 }, (_, completedCount) => ({
    label: `${completedCount}/4 complete`,
    value: cohort.filter((member) => member.completedCount === completedCount).length,
  }))
  const outstanding = ONBOARDING_MILESTONES.map((milestone) => ({
    label: milestone.label,
    value: cohort.filter((member) => !member.milestones[milestone.id]).length,
  }))
  // Select first participation across all history BEFORE applying activity dates.
  const attribution = buildFirstParticipationAttribution(cohort, activityFrom, activityTo).map((row) => ({
    label: row.label,
    value: row.members,
  }))
  const completionTrend = aggregateByGranularity(cohort
    .filter((member) => member.completedAt && isWithinDateRange(member.completedAt, activityFrom, activityTo))
    .map((member) => ({ date: member.completedAt, values: { completions: 1 } })), granularity)
  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(cohort.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pageRows = cohort.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="Registration from"><input type="date" value={registrationFrom} onChange={(event) => { setRegistrationFrom(event.target.value); setPage(0) }} className={inputClassName} /></FilterField>
        <FilterField label="Registration to"><input type="date" value={registrationTo} onChange={(event) => { setRegistrationTo(event.target.value); setPage(0) }} className={inputClassName} /></FilterField>
        <FilterField label="Activity from"><input type="date" value={activityFrom} onChange={(event) => setActivityFrom(event.target.value)} className={inputClassName} /></FilterField>
        <FilterField label="Activity to"><input type="date" value={activityTo} onChange={(event) => setActivityTo(event.target.value)} className={inputClassName} /></FilterField>
        <FilterField label="Granularity"><SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} /></FilterField>
      </FilterBar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Member Portal registrations" value={formatNumber(cohort.length)} helper={`${formatNumber(data.excludedMembers)} suspended or explicitly excluded`} />
        <StatCard label="Completed onboarding" value={formatNumber(completed)} helper="All four milestones complete" />
        <StatCard label="Completion rate" value={formatPercent(cohort.length ? completed / cohort.length * 100 : 0)} helper="Current status; activity filters do not change this card" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Progress distribution" subtitle="Current eligible cohort by completed milestones"><BarList items={progressDistribution} /></Panel>
        <Panel title="Outstanding milestones" subtitle="Members still missing each milestone"><BarList items={outstanding} /></Panel>
        <Panel title="Completion activity" subtitle={`New four-of-four completions, bucketed ${granularity}`}>
          {completionTrend.length ? (
            <ResponsiveChart height={260}>
              <BarChart data={completionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar dataKey="completions" name="Completions" fill="#6f51aa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveChart>
          ) : <EmptyState title="No completion activity" description="No members completed their fourth milestone in the selected activity range." />}
        </Panel>
        <Panel title="Participation attribution" subtitle="Each member is counted once, by the first action that completed their participation milestone. Activity dates apply to that first action, not later participation."><BarList items={attribution} /></Panel>
      </div>

      <Panel title="Member progress" subtitle="Current status is independent of the activity-date filter. Expand a member for every recorded participation fact.">
        <div className="mb-4 max-w-md">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} placeholder="Search member name or email" className={inputClassName} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] border-collapse text-sm">
            <thead><tr className="border-b border-zinc-200">
              {["Member name", "Onboarding completion", "Registration date", "Last onboarding step", "Last signed in", "Milestone 4 activity"].map((label) => <th key={label} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {pageRows.map((member) => (
                <tr key={member.userId} className="align-top hover:bg-zinc-50">
                  <td className="px-3 py-3"><details><summary className="cursor-pointer font-medium text-zinc-800">{member.name}</summary><div className="mt-3 w-[34rem] space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600"><p>{member.email}</p>{ONBOARDING_MILESTONES.map((milestone) => <p key={milestone.id}><span className="font-semibold text-zinc-700">{milestone.label}:</span> {member.milestones[milestone.id] ? formatDate(member.milestones[milestone.id]) : "Outstanding"}</p>)}<p><span className="font-semibold text-zinc-700">WhatsApp response:</span> {member.whatsappStatus === "already_in" ? "Already in" : member.whatsappStatus === "not_interested" ? "Not interested" : member.whatsappStatus === "completed" ? "Completed" : "No explicit response"}</p><p><span className="font-semibold text-zinc-700">WhatsApp contact provided:</span> {member.whatsappContactProvided ? "Yes" : "No"}</p>{member.participation.map((activity, index) => <p key={`${activity.occurred_at}-${index}`}>{formatDate(activity.occurred_at)} · {participationLabel(activity.activity_type)} · {activity.action}</p>)}</div></details></td>
                  <td className="px-3 py-3 tabular-nums text-zinc-600">{member.completedCount}/4</td>
                  <td className="px-3 py-3 text-zinc-600">{formatDate(member.registrationDate)}</td>
                  <td className="px-3 py-3 text-zinc-600">{formatDate(member.lastStepCompletedAt)}</td>
                  <td className="px-3 py-3 text-zinc-600">{formatDate(member.lastSignedInAt)}</td>
                  <td className="px-3 py-3 text-zinc-600"><span className="font-medium text-zinc-700">{member.milestone4Activity}</span>{member.milestone4OccurredAt && <span className="mt-1 block text-xs text-zinc-400">{formatDate(member.milestone4OccurredAt)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls page={currentPage} totalPages={totalPages} onPageChange={setPage} />
      </Panel>
    </div>
  )
}

type EventInventoryStatus = "live" | "upcoming" | "past"
type EventInventorySource = "portal" | "zoom" | "eventbrite"
type EventInventorySort = "recommended" | "date-desc" | "registrations"

type EventInventoryRow = {
  id: string
  title: string
  date: string | null
  status: EventInventoryStatus
  source: EventInventorySource
  sourceLabel: string
  program: string
  activeRsvps: number | null
  totalRegistrations: number | null
  cancellations: number | null
  lastRsvpAt: string | null
  registrations: InventoryRegistration[]
  dailySales?: { date: string; tickets: number }[]
  coverageNote: string
}

function eventInventoryStatus(date: string | null, rawStatus: string | null | undefined, endsAt?: string | null): EventInventoryStatus {
  const status = (rawStatus ?? "").toLowerCase()
  if (status === "live" || status === "started") return "live"
  if (status === "completed" || status === "ended" || status === "past") return "past"
  const parsed = parseDateValue(date)
  if (parsed && parsed.getTime() <= Date.now() && endsAt && Date.parse(endsAt) >= Date.now()) return "live"
  if (parsed && parsed.getTime() < Date.now()) return "past"
  return "upcoming"
}

function eventInventoryStatusClass(status: EventInventoryStatus) {
  if (status === "live") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "upcoming") return "border-violet-200 bg-violet-50 text-violet-700"
  return "border-zinc-200 bg-zinc-50 text-zinc-600"
}

function eventInventorySourceClass(source: EventInventorySource) {
  if (source === "portal") return "border-purple-200 bg-purple-50 text-purple-700"
  if (source === "eventbrite") return "border-orange-200 bg-orange-50 text-orange-700"
  return "border-blue-200 bg-blue-50 text-blue-700"
}

function EngagementOverviewPanel({
  data,
  events,
  snapshot,
  eventLabelOverrides,
  communityEvents,
  communityEventsError,
}: {
  data: PortalUtilizationData
  events: PortalAnalyticsEvent[]
  snapshot: LegacyAnalyticsSnapshot
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  communityEvents: CommunityAnalyticsEvent[]
  communityEventsError?: string | null
}) {
  const endDate = data.dateRange.last ?? new Date().toISOString().slice(0, 10)
  const [registrationFrom, setRegistrationFrom] = useUrlFilterState("en_registration_from", "")
  const [registrationTo, setRegistrationTo] = useUrlFilterState("en_registration_to", "")
  const [activityFrom, setActivityFrom] = useUrlFilterState("en_activity_from", rollingWindowStart(endDate, 30))
  const [activityTo, setActivityTo] = useUrlFilterState("en_activity_to", endDate)
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("en_granularity", "daily")
  const [participationMode, setParticipationMode] = useUrlFilterState<ParticipationFrequencyMode>("en_participation_mode", "total")
  const [activeWindowFilter, setActiveWindow] = useUrlFilterState<ActiveUserWindow>("en_active_window", "monthly")
  const activeWindow: ActiveUserWindow = activeWindowFilter === "weekly" ? "weekly" : "monthly"
  const [selectedActiveDate, setSelectedActiveDate] = useState<string | null>(null)
  const [activeTriggerLabel, setActiveTriggerLabel] = useState<string | null>(null)
  function selectActiveDate(date: string) {
    setActiveTriggerLabel(`View ${formatNumber(activeUserIds(cohortActions, date, activeWindow).size)} ${activeWindow} active users for ${formatDate(date)}`)
    setSelectedActiveDate(date)
  }
  const [detailDate, setDetailDate] = useState("")
  const closeActiveDetails = useCallback(() => setSelectedActiveDate(null), [])
  const [inventorySearch, setInventorySearch] = useUrlFilterState("en_event_search", "")
  const [inventoryProgram, setInventoryProgram] = useUrlFilterState("en_event_program", "all")
  const [inventoryStatus, setInventoryStatus] = useUrlFilterState("en_event_status", "all")
  const [inventorySort, setInventorySort] = useUrlFilterState<EventInventorySort>("en_event_sort", "recommended")
  const [inventoryPage, setInventoryPage] = useState(0)
  const [expandedInventoryEvent, setExpandedInventoryEvent] = useState<string | null>(null)
  const cohortIds = new Set(data.members
    .filter((member) => isWithinDateRange(member.firstRegisteredAt, registrationFrom, registrationTo))
    .map((member) => member.userId))
  const cohortActions = data.qualifyingActions.filter((action) => cohortIds.has(action.userId))
  const activeMembers = (days: number, through: string) => new Set(cohortActions
    .filter((action) => action.date >= rollingWindowStart(through, days) && action.date <= through)
    .map((action) => action.userId)).size
  const latestMau = activeMembers(30, activityTo)
  const latestWau = activeMembers(7, activityTo)
  const cohortSignIns = data.signInActions.filter((action) => cohortIds.has(action.userId))
  const signIns30Rows = cohortSignIns.filter((row) => row.date >= rollingWindowStart(activityTo, 30) && row.date <= activityTo)
  const signIns7Rows = cohortSignIns.filter((row) => row.date >= rollingWindowStart(activityTo, 7) && row.date <= activityTo)
  const uniqueSignIns30 = new Set(signIns30Rows.map((row) => row.userId)).size
  const uniqueSignIns7 = new Set(signIns7Rows.map((row) => row.userId)).size
  const trendDates = data.monthlyActiveUsers
    .filter((row) => row.device === "all" && row.audience === "all" && isWithinDateRange(row.date, activityFrom, activityTo))
    .map((row) => row.date)
  const trend = Array.from(trendDates.reduce((map, date) => {
    const bucket = analyticsGranularityBucket(new Date(`${date}T00:00:00.000Z`), granularity)
    const current = map.get(bucket.key)
    if (!current || date > current.date) map.set(bucket.key, { label: bucket.label, date, users: activeUserIds(cohortActions, date, activeWindow).size })
    return map
  }, new Map<string, { label: string; date: string; users: number }>()).values())
  const selectedActions = cohortActions.filter((action) => isWithinDateRange(action.date, activityFrom, activityTo))
  const participationCategories = data.participationCategories.map((category) => {
    const actions = selectedActions.filter((action) => action.category === category.id)
    return { ...category, members: new Set(actions.map((action) => action.userId)).size, actions: actions.length }
  })
  const selectedSignIns = cohortSignIns.filter((action) => isWithinDateRange(action.date, activityFrom, activityTo))
  const eventRsvpSeries = events
    .map((event, index) => ({
      key: `event${index + 1}`,
      title: event.title,
      color: EVENT_RSVP_LINE_COLORS[index % EVENT_RSVP_LINE_COLORS.length],
      registrations: event.registrations.filter((registration) => (
        cohortIds.has(registration.userId)
        && isWithinDateRange(registration.registeredAt, activityFrom, activityTo)
      )),
    }))
    .filter((event) => event.registrations.length > 0)
  const activityDates = Array.from(new Set([
    ...trendDates,
    ...selectedSignIns.map((action) => action.date),
    ...selectedActions.map((action) => action.date),
    ...eventRsvpSeries.flatMap((event) => event.registrations.map((registration) => registration.registeredAt.slice(0, 10))),
  ])).sort()
  const signInTrendMap = new Map<string, {
    label: string
    date: string
    total: number
    members: Set<string>
  }>()
  for (const date of activityDates) {
    const bucket = analyticsGranularityBucket(new Date(`${date}T00:00:00.000Z`), granularity)
    const current = signInTrendMap.get(bucket.key)
    if (!current) signInTrendMap.set(bucket.key, { label: bucket.label, date, total: 0, members: new Set() })
    else if (date > current.date) current.date = date
  }
  for (const signIn of selectedSignIns) {
    const bucket = analyticsGranularityBucket(new Date(`${signIn.date}T00:00:00.000Z`), granularity)
    const current = signInTrendMap.get(bucket.key)
    if (!current) continue
    current.total += 1
    current.members.add(signIn.userId)
  }
  const signInTrend = Array.from(signInTrendMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ label: row.label, total: row.total, unique: row.members.size }))

  type ParticipationCategory = PortalUtilizationData["qualifyingActions"][number]["category"]
  type ParticipationBucket = {
    label: string
    date: string
    totalActions: number
    totalMembers: Set<string>
    categoryActions: Record<ParticipationCategory, number>
    categoryMembers: Record<ParticipationCategory, Set<string>>
  }
  const newParticipationBucket = (label: string, date: string): ParticipationBucket => ({
    label,
    date,
    totalActions: 0,
    totalMembers: new Set(),
    categoryActions: { events: 0, resources: 0, newsletters: 0, connections: 0, attendance: 0 },
    categoryMembers: { events: new Set(), resources: new Set(), newsletters: new Set(), connections: new Set(), attendance: new Set() },
  })
  const participationTrendMap = new Map<string, ParticipationBucket>()
  for (const date of activityDates) {
    const bucket = analyticsGranularityBucket(new Date(`${date}T00:00:00.000Z`), granularity)
    const current = participationTrendMap.get(bucket.key)
    if (!current) participationTrendMap.set(bucket.key, newParticipationBucket(bucket.label, date))
    else if (date > current.date) current.date = date
  }
  for (const action of selectedActions) {
    const bucket = analyticsGranularityBucket(new Date(`${action.date}T00:00:00.000Z`), granularity)
    const current = participationTrendMap.get(bucket.key)
    if (!current) continue
    current.totalActions += 1
    current.totalMembers.add(action.userId)
    current.categoryActions[action.category] += 1
    current.categoryMembers[action.category].add(action.userId)
  }
  const participationTrend = Array.from(participationTrendMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const chartRow: Record<string, string | number> = {
        label: row.label,
        total: participationMode === "total" ? row.totalActions : row.totalMembers.size,
      }
      for (const category of data.participationCategories) {
        chartRow[category.id] = participationMode === "total"
          ? row.categoryActions[category.id]
          : row.categoryMembers[category.id].size
      }
      return chartRow
    })
  const hasSignInActivity = signInTrend.some((row) => row.total > 0)
  const hasParticipationActivity = participationTrend.some((row) => Number(row.total) > 0)
  const eventRsvpTrend = activityDates.map((date) => {
    const row: Record<string, string | number> = { label: date, total: 0 }
    for (const event of eventRsvpSeries) {
      const count = event.registrations.filter((registration) => registration.registeredAt.slice(0, 10) === date).length
      row[event.key] = count
      row.total = Number(row.total) + count
    }
    return row
  })
  const hasEventRsvpActivity = eventRsvpTrend.some((row) => Number(row.total) > 0)
  const portalEventsById = new Map(events.map((event) => [event.id, event]))
  const representedZoomIds = new Set<string>()
  const representedPortalEventIds = new Set<string>()
  const zoomInventoryRows = (snapshot.events.zoom.events as ZoomAnalyticsEvent[])
    .filter((event) => isPublicInventoryZoomEvent(event, eventLabelOverrides))
    .flatMap<EventInventoryRow>((event) => {
      if (event.portalExternalEventId) representedZoomIds.add(event.portalExternalEventId)
      representedZoomIds.add(event.id)
      const portalEvent = event.portalEventId
        ? portalEventsById.get(event.portalEventId)
        : portalEventsById.get(event.id)
      if (portalEvent) representedPortalEventIds.add(portalEvent.id)
      const hasRegistrationCoverage = Boolean(portalEvent || event.registrants != null || event.registrations.length)
      if (!hasRegistrationCoverage || portalEvent?.status === "draft") return []
      const status = eventInventoryStatus(event.date, portalEvent?.status ?? event.status)
      const lastRegistration = [...event.registrations]
        .map((registration) => registration.registeredAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null
      const isPortalAndZoom = Boolean(portalEvent && (event.source === "zoom" || event.registrationSource === "portal-zoom-transition"))
      return [{
        id: `zoom:${event.id}`,
        title: event.topic,
        date: event.date,
        status,
        source: portalEvent ? "portal" : "zoom",
        sourceLabel: isPortalAndZoom ? "Portal + Zoom" : portalEvent ? "Member Portal" : "Zoom",
        program: eventLabels(event, eventLabelOverrides).program,
        activeRsvps: portalEvent
          ? portalEvent.registrations.length
          : status === "past" ? null : event.registrants,
        totalRegistrations: portalEvent
          ? Math.max(portalEvent.totalRegistrationsEver, event.registrants ?? 0)
          : event.registrants,
        cancellations: portalEvent ? portalEvent.cancellationCount : null,
        lastRsvpAt: portalEvent?.lastRsvpAt ?? lastRegistration,
        registrations: mergeInventoryRegistrations(portalEvent?.registrations.map((row) => ({ name: row.memberName, email: row.memberEmail, registeredAt: row.registeredAt })) ?? [], event.registrations),
        coverageNote: portalEvent ? "Known Portal and linked Zoom registration records, deduplicated by email. Historical counts may exceed available detail." : "Recorded Zoom registrations; historical detail may be incomplete.",
      }]
    })
  const portalInventoryRows = events
    .filter((event) => event.status !== "draft" && !representedPortalEventIds.has(event.id)
      && isPublicInventoryZoomEvent(portalEventToAnalyticsEvent(event), eventLabelOverrides))
    .map<EventInventoryRow>((event) => ({
      id: `portal:${event.id}`,
      title: event.title,
      date: event.startsAt,
      status: eventInventoryStatus(event.startsAt, event.status),
      source: "portal",
      sourceLabel: "Member Portal",
      program: eventLabels(portalEventToAnalyticsEvent(event), eventLabelOverrides).program,
      activeRsvps: event.registrations.length,
      totalRegistrations: event.totalRegistrationsEver,
      cancellations: event.cancellationCount,
      lastRsvpAt: event.lastRsvpAt,
      registrations: mergeInventoryRegistrations(event.registrations.map((row) => ({ name: row.memberName, email: row.memberEmail, registeredAt: row.registeredAt }))),
      coverageNote: "Current active Portal RSVPs. Historical reported totals may include registrations no longer active.",
    }))
  const zoomUpcomingInventoryRows = snapshot.events.zoom.upcomingEvents
    .filter((event) => !representedZoomIds.has(event.id) && isPublicInventoryZoomEvent(event, eventLabelOverrides))
    .map<EventInventoryRow>((event) => ({
      id: `zoom-upcoming:${event.id}`,
      title: event.topic,
      date: event.date,
      status: eventInventoryStatus(event.date, "upcoming"),
      source: "zoom",
      sourceLabel: "Zoom",
      program: eventLabels(event, eventLabelOverrides).program,
      activeRsvps: event.registrants,
      totalRegistrations: event.registrants,
      cancellations: null,
      lastRsvpAt: [...event.registrations]
        .map((registration) => registration.registeredAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null,
      registrations: mergeInventoryRegistrations(event.registrations),
      coverageNote: "Current Zoom registration records.",
    }))
  const eventbriteInventoryRows = snapshot.events.eventbrite.events
    .filter((event) => event.status.toLowerCase() !== "cancelled")
    .map<EventInventoryRow>((event) => ({
      id: `eventbrite:${event.id}`,
      title: event.name,
      date: event.date,
      status: eventInventoryStatus(event.date, event.status),
      source: "eventbrite",
      sourceLabel: "Eventbrite",
      program: eventLabels({ id: `eventbrite:${event.id}`, program: portalEventProgram(event.name) === "Other" ? "Community" : portalEventProgram(event.name), type: "public" }, eventLabelOverrides).program,
      activeRsvps: null,
      totalRegistrations: event.tickets,
      cancellations: null,
      lastRsvpAt: event.dailySales.map((sale) => sale.date).filter(Boolean).sort().at(-1) ?? null,
      registrations: [],
      dailySales: event.dailySales,
      coverageNote: "Eventbrite ticket counts and daily sales. This export does not include named registrant records; tickets are not necessarily unique people.",
    }))
  const communityInventoryRows = communityEvents
    .filter((event) => isPublicInventoryZoomEvent(portalEventToAnalyticsEvent(event), eventLabelOverrides))
    .map<EventInventoryRow>((event) => ({
      id: event.id, title: event.title, date: event.startsAt,
      status: eventInventoryStatus(event.startsAt, event.status === "archived" ? "past" : event.status, event.endsAt),
      source: "portal", sourceLabel: event.kind === "meetup" ? "Conference meetup" : "Conference",
      program: eventLabels(portalEventToAnalyticsEvent(event), eventLabelOverrides).program,
      activeRsvps: event.registrationCoverage === "portal" ? event.registrationCount : null,
      totalRegistrations: event.registrationCoverage === "portal" ? event.totalRegistrationsEver : null,
      cancellations: event.registrationCoverage === "portal" ? event.cancellationCount : null,
      lastRsvpAt: event.lastRsvpAt,
      registrations: event.registrations.map((row) => ({ name: row.memberName, email: row.memberEmail, registeredAt: row.registeredAt })),
      coverageNote: event.registrationCoverage === "portal"
        ? "Eligible members’ Portal attendance RSVPs, not official conference ticket registrations. The timeline includes retained RSVP history; current counts exclude withdrawn RSVPs."
        : "Historical conference directory entry. Registration counts and registrant history were not collected in this source.",
    }))
  const allInventoryRows = [...portalInventoryRows, ...zoomUpcomingInventoryRows, ...zoomInventoryRows, ...eventbriteInventoryRows, ...communityInventoryRows]
  const normalizedInventorySearch = inventorySearch.trim().toLowerCase()
  const filteredInventoryRows = allInventoryRows
    .filter((event) => (
      (!normalizedInventorySearch || event.title.toLowerCase().includes(normalizedInventorySearch))
      && inventoryProgramMatches(event.program, inventoryProgram)
      && (inventoryStatus === "all" || event.status === inventoryStatus)
    ))
    .sort((a, b) => {
      if (inventorySort === "date-desc") return (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title)
      if (inventorySort === "registrations") return (inventoryRegistrationCount(b) ?? -1) - (inventoryRegistrationCount(a) ?? -1) || a.title.localeCompare(b.title)
      const rank = (status: EventInventoryStatus) => status === "live" ? 0 : status === "upcoming" ? 1 : 2
      const rankDifference = rank(a.status) - rank(b.status)
      if (rankDifference) return rankDifference
      if (a.status === "past") return (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title)
      return (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.title.localeCompare(b.title)
    })
  const inventoryPageSize = 10
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredInventoryRows.length / inventoryPageSize))
  const currentInventoryPage = Math.min(inventoryPage, inventoryTotalPages - 1)
  const inventoryPageRows = filteredInventoryRows.slice(currentInventoryPage * inventoryPageSize, (currentInventoryPage + 1) * inventoryPageSize)
  const upcomingInventoryCount = allInventoryRows.filter((event) => event.status === "upcoming" || event.status === "live").length
  const activeInventoryRsvps = allInventoryRows.reduce((sum, event) => sum + (event.activeRsvps ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="Registration from"><input type="date" value={registrationFrom} onChange={(event) => setRegistrationFrom(event.target.value)} className={inputClassName} /></FilterField>
        <FilterField label="Registration to"><input type="date" value={registrationTo} onChange={(event) => setRegistrationTo(event.target.value)} className={inputClassName} /></FilterField>
        <FilterField label="Activity from"><input type="date" value={activityFrom} onChange={(event) => setActivityFrom(event.target.value)} className={inputClassName} /></FilterField>
        <FilterField label="Activity to"><input type="date" value={activityTo} onChange={(event) => setActivityTo(event.target.value)} className={inputClassName} /></FilterField>
        <FilterField label="Granularity"><SelectInput value={granularity} onChange={(value) => setGranularity(value as Granularity)} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} /></FilterField>
      </FilterBar>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="MAU" value={formatNumber(latestMau)} helper="Unique members with a qualifying action in rolling 30 days" />
        <StatCard label="WAU" value={formatNumber(latestWau)} helper="Unique members with a qualifying action in rolling 7 days" />
        <DualMetricCard label="Successful sign-ins · 30d" total={formatNumber(signIns30Rows.length)} unique={formatNumber(uniqueSignIns30)} helper="Rolling 30 days through the activity end date" />
        <DualMetricCard label="Successful sign-ins · 7d" total={formatNumber(signIns7Rows.length)} unique={formatNumber(uniqueSignIns7)} helper="Rolling 7 days through the activity end date" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Panel title="Active Users" subtitle={`Rolling ${activeWindow === "monthly" ? "30" : "7"}-day unique members. Click a plotted day to see who is included. Weekly/monthly granularity uses the last plotted day of each period.`}>
          <div className="mb-3 flex justify-end"><div role="group" aria-label="Active user window" className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
            {(["monthly", "weekly"] as const).map((window) => <button key={window} type="button" aria-pressed={activeWindow === window} onClick={() => setActiveWindow(window)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${activeWindow === window ? "bg-ipn text-white" : "text-zinc-600 hover:bg-white"}`}>{window === "monthly" ? "Monthly" : "Weekly"}</button>)}
          </div></div>
          {trend.length ? <>
            <ResponsiveChart height={300}><LineChart data={trend} onClick={(state) => {
              if (state.activeTooltipIndex == null) return
              const point = trend[Number(state.activeTooltipIndex)]
              if (point) selectActiveDate(point.date)
            }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} labelFormatter={(_, payload) => payload[0]?.payload.date ?? ""} />
              <Line type="monotone" dataKey="users" name={activeWindow === "monthly" ? "MAU" : "WAU"} stroke="#6f51aa" strokeWidth={2.5} dot={<MauChartDot window={activeWindow} onSelect={selectActiveDate} />} activeDot={{ r: 6, pointerEvents: "none" }} />
            </LineChart></ResponsiveChart>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2"><select aria-label="Active users plotted day" value={trend.some((row) => row.date === detailDate) ? detailDate : trend[trend.length - 1].date} onChange={(event) => setDetailDate(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">{trend.map((row) => <option key={row.date} value={row.date}>{row.date} · {row.users} members</option>)}</select><button type="button" onClick={() => setSelectedActiveDate(trend.some((row) => row.date === detailDate) ? detailDate : trend[trend.length - 1].date)} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-ipn hover:bg-purple-50">View members</button></div>
          </> : <EmptyState title="No qualifying activity" description="No qualifying member actions match this range." />}
        </Panel>
        <Panel title="Ways members participate" subtitle="Unique members per category; categories are nonexclusive."><BarList items={participationCategories.map((row) => ({ label: row.label, value: row.members }))} /></Panel>
      </div>
      <Panel title="Successful sign-ins over time" subtitle="Total successful sign-ins and the distinct members who signed in during each period.">
        {hasSignInActivity ? (
          <ResponsiveChart height={300}>
            <LineChart data={signInTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line type="monotone" dataKey="total" name="Total successful sign-ins" stroke="#6f51aa" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="unique" name="Unique members" stroke="#0f766e" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveChart>
        ) : <EmptyState title="No sign-in activity" description="No successful sign-ins match this cohort and activity range." />}
      </Panel>
      <Panel
        title="Participation frequency over time"
        subtitle={participationMode === "total"
          ? "Action volume per period. The black line is all qualifying actions; category lines show each participation type."
          : "Distinct members per period. The black line is anyone who participated; categories are nonexclusive."}
      >
        <div className="mb-5 flex justify-end">
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1" role="group" aria-label="Participation counting method">
            {([
              { value: "total", label: "Total actions" },
              { value: "unique", label: "Unique members" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={participationMode === option.value}
                onClick={() => setParticipationMode(option.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${participationMode === option.value ? "bg-ipn text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {hasParticipationActivity ? (
          <ResponsiveChart height={340}>
            <LineChart data={participationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line type="monotone" dataKey="total" name={participationMode === "total" ? "All participation actions" : "All participating members"} stroke="#18181b" strokeWidth={3} dot={false} />
              {data.participationCategories.map((category) => (
                <Line key={category.id} type="monotone" dataKey={category.id} name={category.label} stroke={PARTICIPATION_LINE_COLORS[category.id]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveChart>
        ) : <EmptyState title="No participation activity" description="No qualifying participation actions match this cohort and activity range." />}
      </Panel>
      <Panel title="Active event RSVPs over time" subtitle="New RSVPs by day that remain active today. The black line is the daily total; colored lines separate events.">
        {hasEventRsvpActivity ? (
          <ResponsiveChart height={340}>
            <LineChart data={eventRsvpTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              {eventRsvpSeries.map((event) => (
                <Line key={event.key} type="monotone" dataKey={event.key} name={event.title} stroke={event.color} strokeWidth={2} dot={false} />
              ))}
              <Line type="monotone" dataKey="total" name="All active event RSVPs" stroke="#18181b" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveChart>
        ) : <EmptyState title="No active event RSVPs" description="No currently active Portal event RSVPs were created in this cohort and activity range." />}
      </Panel>
      <Panel title="Event inventory" subtitle="Public events only. Registrations shows active RSVPs for live/upcoming events and reported registrations or tickets for past events. Click an event for daily/cumulative registrations and its registrant list.">
        {communityEventsError && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{communityEventsError}</p>}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.5fr)_minmax(10rem,0.7fr)_minmax(10rem,0.7fr)_minmax(12rem,0.8fr)]">
          <FilterField label="Search events">
            <input
              value={inventorySearch}
              onChange={(event) => { setInventorySearch(event.target.value); setInventoryPage(0) }}
              placeholder="Search by event name"
              className={inputClassName}
            />
          </FilterField>
          <FilterField label="Event type">
            <SelectInput value={inventoryProgram} onChange={(value) => { setInventoryProgram(value); setInventoryPage(0) }} options={[
              { value: "all", label: "All event types" },
              { value: "IPN Labs", label: "IPN Labs" },
              { value: "PsychedelX", label: "PsychedelX" },
              { value: "Community", label: "Community" },
            ]} />
          </FilterField>
          <FilterField label="Status">
            <SelectInput value={inventoryStatus} onChange={(value) => { setInventoryStatus(value); setInventoryPage(0) }} options={[
              { value: "all", label: "All statuses" },
              { value: "live", label: "Live" },
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
            ]} />
          </FilterField>
          <FilterField label="Sort">
            <SelectInput value={inventorySort} onChange={(value) => { setInventorySort(value as EventInventorySort); setInventoryPage(0) }} options={[
              { value: "recommended", label: "Upcoming, then recent" },
              { value: "date-desc", label: "Newest date" },
              { value: "registrations", label: "Most registrations" },
            ]} />
          </FilterField>
        </div>
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-zinc-600">
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5"><strong className="font-semibold text-zinc-800">{formatNumber(allInventoryRows.length)}</strong> covered events</span>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5"><strong className="font-semibold text-violet-800">{formatNumber(upcomingInventoryCount)}</strong> live or upcoming</span>
          <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5"><strong className="font-semibold text-purple-800">{formatNumber(activeInventoryRsvps)}</strong> current active RSVPs</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[850px] table-fixed border-collapse text-sm">
            <thead className="bg-zinc-50/80">
              <tr className="border-b border-zinc-200">
                {[
                  ["Event", "text-left"],
                  ["Date", "text-left"],
                  ["Status", "text-left"],
                  ["Source", "text-left"],
                  ["Registrations", "text-right"],
                  ["Cancellations", "text-right"],
                  ["Last RSVP", "text-left"],
                ].map(([label, align]) => <th key={label} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${align} ${label === "Event" ? "w-[30%]" : ""}`}>{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {inventoryPageRows.length ? inventoryPageRows.map((event) => {
                const registrationCount = inventoryRegistrationCount(event)
                const expanded = expandedInventoryEvent === event.id
                return (
                  <Fragment key={event.id}>
                  <tr className="align-middle transition-colors hover:bg-purple-50/30">
                    <td className="max-w-[24rem] px-3 py-3 font-medium leading-5 text-zinc-800"><button type="button" aria-expanded={expanded} aria-controls={`inventory-detail-${event.id}`} onClick={() => setExpandedInventoryEvent(expanded ? null : event.id)} className="flex items-start gap-2 text-left hover:text-ipn"><span aria-hidden="true">{expanded ? "▾" : "▸"}</span>{event.title}</button><span className="mt-1 block text-xs font-normal text-zinc-400">{event.program}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{formatDate(event.date)}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${eventInventoryStatusClass(event.status)}`}>{event.status}</span></td>
                    <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${eventInventorySourceClass(event.source)}`}>{event.sourceLabel}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums"><span className="font-semibold text-zinc-800">{registrationCount == null ? "—" : formatNumber(registrationCount)}</span><span className="mt-1 block text-[10px] text-zinc-400">{event.source === "eventbrite" ? "tickets" : event.status === "past" ? "recorded registrations" : "active RSVPs"}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums text-zinc-600">{event.cancellations == null ? "—" : formatNumber(event.cancellations)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">{event.lastRsvpAt ? formatShortDate(event.lastRsvpAt) : "—"}</td>
                  </tr>
                  {expanded && <tr id={`inventory-detail-${event.id}`} className="bg-zinc-50/70"><td colSpan={7}><EventInventoryDetails title={event.title} registrations={event.registrations} dailySales={event.dailySales} count={registrationCount} coverageNote={event.coverageNote} /></td></tr>}
                  </Fragment>
                )
              }) : (
                <tr><td colSpan={7} className="px-4 py-8"><EmptyState title="No matching events" description="Change the event search, source, or status filters to see more of the inventory." /></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-400">Showing {formatNumber(filteredInventoryRows.length)} of {formatNumber(allInventoryRows.length)} events. Dashes mark fields the source cannot verify.</p>
          <PaginationControls page={currentInventoryPage} totalPages={inventoryTotalPages} onPageChange={setInventoryPage} />
        </div>
      </Panel>
      {selectedActiveDate && <ActiveUserDetailsModal data={data} cohortIds={cohortIds} date={selectedActiveDate} window={activeWindow} focusReturnLabel={activeTriggerLabel} onClose={closeActiveDetails} />}
    </div>
  )
}

function ReachOverviewPanel({ snapshot }: { snapshot: LegacyAnalyticsSnapshot }) {
  const follower = (id: string) => snapshot.social.platforms.find((platform) => platform.id === id)?.followers ?? null
  const followerLabel = (id: string) => {
    const value = follower(id)
    return value == null ? "Unavailable" : formatNumber(value)
  }
  const websiteVisitors = Number(snapshot.website.overview.users_30d ?? snapshot.website.overview.sessions_30d ?? 0)
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mailchimp subscribers" value={formatNumber(snapshot.marketing.summary.totalSubscribers)} helper="Current Intercollegiate Psychedelics Network audience snapshot" />
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:col-span-1 xl:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Social followers</p><div className="mt-4 grid grid-cols-3 gap-3"><div><p className="text-xs text-zinc-500">Instagram</p><p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{followerLabel("instagram")}</p></div><div><p className="text-xs text-zinc-500">Facebook</p><p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{followerLabel("facebook")}</p></div><div><p className="text-xs text-zinc-500">LinkedIn</p><p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{followerLabel("linkedin")}</p></div></div><p className="mt-3 text-xs text-zinc-400">Reported separately; no combined follower total.</p></div>
        <StatCard label="Website visitors · 30d" value={formatNumber(websiteVisitors)} helper="GA4 users when available; sessions otherwise" />
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><span className="font-semibold">Mailchimp identity note:</span> this dashboard uses the current list count. The historical source note reports 1,895 and is not explainable from the contact-level data currently available; see Data &amp; Definitions.</div>
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

function MarketingPanel({ snapshot, mailchimpAnalytics }: { snapshot: LegacyAnalyticsSnapshot; mailchimpAnalytics: MailchimpContactAnalytics }) {
  const marketing = snapshot.marketing
  const [fromDate, setFromDate] = useUrlFilterState("mc_from", "")
  const [toDate, setToDate] = useUrlFilterState("mc_to", "")
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("mc_granularity", "monthly")
  const [listName, setListName] = useUrlFilterState("mc_audience", "all")
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
  const through = (mailchimpAnalytics.lastSyncedAt ?? new Date().toISOString()).slice(0, 10)
  const audienceMetrics = buildMailchimpAudienceMetrics(mailchimpAnalytics, listName, through)
  const statusHistoryHelper = mailchimpAnalytics.available
    ? `${audienceMetrics.includesBackfill ? "Includes Mailchimp's original contact timestamps; " : ""}daily status ledger through ${through}`
    : "Available after the first complete contact-status sync"
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
        <FilterField label="Audience">
          <SelectInput value={listName} onChange={setListName} options={[{ value: "all", label: "All current audiences" }, ...lists.map((list) => ({ value: list, label: list }))]} />
        </FilterField>
      </FilterBar>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Subscribers" value={formatNumber(audienceMetrics.subscribers ?? marketing.summary.totalSubscribers)} helper="Distinct currently subscribed contacts in the selected audience" />
        <StatCard label="New subs · 30d" value={audienceMetrics.newSubscribers30d == null ? "Unavailable" : formatNumber(audienceMetrics.newSubscribers30d)} helper={statusHistoryHelper} />
        <StatCard label="Unsubs · 30d" value={audienceMetrics.unsubscribes30d == null ? "Unavailable" : formatNumber(audienceMetrics.unsubscribes30d)} helper={statusHistoryHelper} />
        <StatCard label="Open / click rate" value={`${formatPercent(sent ? opens / sent * 100 : 0)} / ${formatPercent(sent ? clicks / sent * 100 : 0)}`} helper="Weighted by recipients across selected campaigns" />
        <StatCard label="Unsubscribe rate" value={formatPercent(sent ? unsubscribes / sent * 100 : 0)} helper={`${formatNumber(unsubscribes)} campaign unsubscribes / ${formatNumber(sent)} sent`} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Current coverage includes one live audience. Historical campaign labels remain as reported; when another audience is added, all-audience subscriber and 30-day counts deduplicate contacts using Mailchimp&apos;s privacy-safe subscriber hash.
      </div>

      <div className="grid grid-cols-1 gap-5">
        <Panel title="Campaign performance over time" subtitle="Open and click rate by month">
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
      </div>

      <Panel title="Campaign detail" subtitle="Click a campaign to expand URL-level click details">
        <CampaignDetailTable campaigns={filteredCampaigns} />
      </Panel>
    </div>
  )
}

function LinkedInFollowerEntry() {
  const router = useRouter()
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().slice(0, 10))
  const [followerCount, setFollowerCount] = useState("")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <Panel title="LinkedIn followers" subtitle="Superadmin manual daily snapshot">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FilterField label="Date">
          <input type="date" value={snapshotDate} max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setSnapshotDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Followers">
          <input type="number" min={0} step={1} value={followerCount}
            onChange={(event) => setFollowerCount(event.target.value)} className={inputClassName} />
        </FilterField>
        <button type="button" disabled={isPending || !snapshotDate || followerCount === ""}
          onClick={() => startTransition(async () => {
            const result = await saveLinkedInFollowerSnapshot({ snapshotDate, followerCount: Number(followerCount) })
            if (result.error) setMessage(result.error)
            else {
              setMessage("LinkedIn snapshot saved.")
              setFollowerCount("")
              router.refresh()
            }
          })}
          className="min-h-10 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {message && <p className="mt-3 text-xs text-zinc-500">{message}</p>}
    </Panel>
  )
}

function SocialMediaPanel({ snapshot, analyticsRefresh, isSuperadmin }: { snapshot: LegacyAnalyticsSnapshot; analyticsRefresh: PortalAnalyticsRefreshRun | null; isSuperadmin: boolean }) {
  const social = snapshot.social
  const socialSource = snapshot.dataSources.find((source) => source.id === "instagram")
    ?? snapshot.dataSources.find((source) => source.id === "facebook")
  const historyDates = [...social.history.map((row) => toInputDate(row.date) || websiteDateToInput(row.month)),
    ...social.instagramPosts.map((post) => toInputDate(post.date))].filter(Boolean).sort()
  const [fromDate, setFromDate] = useUrlFilterState("sm_from", historyDates[0] ?? "")
  const [toDate, setToDate] = useUrlFilterState("sm_to", historyDates.at(-1) ?? "")
  const [platform, setPlatform] = useUrlFilterState("sm_platform", "all")
  const [metric, setMetric] = useUrlFilterState<SocialMetric>("sm_metric", "followers")
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("sm_granularity", "monthly")
  const postFilterKey = `${fromDate}:${toDate}`
  const [postPagination, setPostPagination] = useState({ filterKey: postFilterKey, page: 0 })
  const filteredPosts = social.instagramPosts.filter((post) => isWithinDateRange(post.date, fromDate, toDate))
    .slice().sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""))
  const postTotalPages = Math.max(1, Math.ceil(filteredPosts.length / 25))
  const currentPostPage = postPagination.filterKey === postFilterKey ? Math.min(postPagination.page, postTotalPages - 1) : 0
  const platformOptions = social.platforms.map((item) => ({ value: item.id, label: item.label }))
  const trendPoints = social.history
    .filter((row) => {
      const dateValue = row.date || `${row.month}-01`
      return isWithinDateRange(dateValue, fromDate, toDate) && (platform === "all" || row.channel === platform)
    })
    .flatMap((row) => {
      const date = parseDateValue(row.date || `${row.month}-01`)
      if (!date) return []
      const period = analyticsGranularityBucket(date, granularity).label
      return [{ ...row, period, timestamp: date.getTime() }]
    })
  const displayedChannels = platform === "all"
    ? social.platforms.map((item) => item.id)
    : [platform]
  const trend = buildCarriedSocialTrend({
    points: trendPoints,
    channels: displayedChannels,
    metric,
    includeTotal: platform === "all",
  })
  const metricLabel = metric === "followers" ? "Followers" : metric === "posts" ? "Posts" : "Engagement rate"
  const platformColors: Record<string, string> = {
    instagram: "#db2777",
    facebook: "#2563eb",
    linkedin: "#0a66c2",
  }

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
        detail="Instagram and Facebook are persisted daily from the Meta API. LinkedIn is entered manually. Missing days carry the latest platform value forward."
      />
      {isSuperadmin && <LinkedInFollowerEntry />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <Panel title="Follower trend" subtitle={`Instagram, Facebook, LinkedIn, and total, bucketed ${granularity.replace("ly", "")}`} className="lg:col-span-2">
          <ResponsiveChart height={320}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              {displayedChannels.map((channel) => (
                <Line key={channel} type="monotone" connectNulls dataKey={channel}
                  name={`${social.platforms.find((item) => item.id === channel)?.label ?? channel} ${metricLabel}`}
                  stroke={platformColors[channel] ?? "#7c3aed"} strokeWidth={2} dot={granularity === "daily"} />
              ))}
              {platform === "all" && metric === "followers" && (
                <Line type="monotone" connectNulls dataKey="total" name={`Total ${metricLabel}`}
                  stroke="#111111" strokeWidth={3} dot={false} />
              )}
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
        <Panel title="Instagram post engagement" subtitle="Posts published in the selected date range, oldest to newest. Likes/comments are latest observed totals, not historical daily activity.">
          {filteredPosts.length === 0 ? <p className="py-10 text-center text-sm text-zinc-500">No archived Instagram posts in the selected date range.</p> : <ResponsiveChart height={280}>
            <BarChart data={filteredPosts.slice().reverse().map((post) => ({ ...post, label: formatShortDate(post.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="likes" fill="#db2777" radius={[6, 6, 0, 0]} />
              <Bar dataKey="comments" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>}
        </Panel>
      </div>

      <Panel title="Instagram post detail" subtitle="Publication-date filters apply to this table and the post engagement chart. Headline engagement metrics remain based on posts published in the last 30 days.">
        <p className="mb-4 text-xs text-zinc-500">
          {social.instagramArchive?.backfillComplete ? "Backfill reached the end of the accessible Instagram feed." : "Historical backfill is incomplete; this is not an all-time post count."}
          {" "}{social.instagramPosts.length} archived posts; {filteredPosts.length} in the selected range.
          {social.instagramArchive?.oldestPostAt ? ` Oldest archived post: ${formatDate(social.instagramArchive.oldestPostAt)}.` : ""}
          {" "}Likes/comments are latest observed totals and older posts may not refresh daily. No images or videos are stored.
        </p>
        {filteredPosts.length === 0 && <p className="mb-4 text-sm text-zinc-500">No archived Instagram posts in the selected date range.</p>}
        <SimpleTable
          columns={[
            { key: "post", label: "Post" },
            { key: "date", label: "Date" },
            { key: "type", label: "Type" },
            { key: "likes", label: "Likes", align: "right" },
            { key: "comments", label: "Comments", align: "right" },
            { key: "engagement", label: "Engagement", align: "right" },
            { key: "link", label: "Link" },
            { key: "observed", label: "Counts checked" },
          ]}
          rows={filteredPosts.slice(currentPostPage * 25, (currentPostPage + 1) * 25).map((post) => ({
            post: truncate(post.caption || "Untitled post", 72),
            date: formatShortDate(post.date),
            type: post.type,
            likes: formatNumber(post.likes),
            comments: formatNumber(post.comments),
            engagement: formatNumber(post.engagement),
            link: post.permalink ? <a className="text-ipn hover:underline" href={post.permalink} target="_blank" rel="noreferrer">Open</a> : "-",
            observed: post.lastObservedAt ? formatDate(post.lastObservedAt) : "Unknown",
          }))}
        />
        <PaginationControls page={currentPostPage} totalPages={postTotalPages} onPageChange={(page) => setPostPagination({ filterKey: postFilterKey, page })} />
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
  const [fromDate, setFromDate] = useUrlFilterState("web_from", trendDateBounds[0] ?? "")
  const [toDate, setToDate] = useUrlFilterState("web_to", trendDateBounds.at(-1) ?? "")
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
  const websiteFreshnessDetail = websiteSource?.status === "error"
    ? `The latest GA4 attempt failed validation (${websiteSource.note}). Displaying the last known good Website snapshot instead.`
    : hasWebsiteData
      ? "Server-only snapshot generated from the latest successful GA4 pull."
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
          subtitle="GA4 page performance for key action paths, including membership, PsychedelX, and contact pages."
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
  if (text.includes("community")) return "Community"
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
  return events.map((event) => ({ ...event, ...eventLabels(event, overrides) }))
}

function ZoomEventLabelControls({
  events,
  overrides,
  onSaved,
}: {
  events: LabelableEvent[]
  overrides: AnalyticsEventLabelOverride[]
  onSaved: (override: AnalyticsEventLabelOverride) => void
}) {
  const overrideById = new Map(overrides.map((override) => [override.event_id, override]))
  const [search, setSearch] = useState("")
  const sortedEvents = [...events].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
    .filter((event) => event.topic.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <Panel title="Event labeling controls" subtitle="Superadmin-only overrides used before Analytics filters, counts, and tables are calculated.">
      <input aria-label="Search events to label" placeholder="Search all imported events and meetings" value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClassName} mb-4 max-w-md`} />
      <p className="mb-3 text-xs text-zinc-500">Showing {sortedEvents.length} of {events.length} imported events. Internal and excluded records remain editable. Community is a program; Public/Internal separately controls public inventory inclusion.</p>
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
  event: LabelableEvent
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
      <td className="whitespace-nowrap px-3 py-3 align-top text-zinc-500">{event.sourceLabel ?? (event.source === "portal" ? "Portal RSVP" : "Zoom")}</td>
      <td className="px-3 py-3 align-top">
        <SelectInput
          value={programLabel}
          onChange={(value) => setProgramLabel(value as AnalyticsEventProgram)}
          options={[
            { value: "IPN Labs", label: "IPN Labs" },
            { value: "PsychedelX", label: "PsychedelX" },
            { value: "Community", label: "Community" },
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
  communityEvents,
  onOverrideSaved,
  isSuperadmin,
  forcedView,
  hideViewTabs = false,
}: {
  snapshot: LegacyAnalyticsSnapshot
  analyticsRefresh: PortalAnalyticsRefreshRun | null
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  portalEvents: PortalAnalyticsEvent[]
  communityEvents: CommunityAnalyticsEvent[]
  onOverrideSaved: (override: AnalyticsEventLabelOverride) => void
  isSuperadmin: boolean
  forcedView?: EventsView
  hideViewTabs?: boolean
}) {
  const [internalActive, setInternalActive] = useState<EventsView>("zoom")
  const active = forcedView ?? internalActive
  const [fromDate, setFromDate] = useUrlFilterState("ev_from", "")
  const [toDate, setToDate] = useUrlFilterState("ev_to", "")
  const [program, setProgram] = useUrlFilterState("ev_program", "all")
  const [type, setType] = useUrlFilterState("ev_type", "all")
  const [granularity, setGranularity] = useUrlFilterState<Granularity>("ev_granularity", "monthly")
  const [attendeesPage, setAttendeesPage] = useState(0)
  const [eventbriteMetric, setEventbriteMetric] = useState<EventbriteMetric>("tickets")
  const overrides = eventLabelOverrides
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
  const labelingEvents = eventLabelCatalog(
    upcomingPortalEvents,
    labeledZoomEvents,
    zoom.upcomingEvents.map((event) => ({ ...event, ...eventLabels(event, overrides), sourceLabel: "Zoom scheduled" })),
    communityEvents.map((event) => ({ ...portalEventToAnalyticsEvent(event), ...eventLabels(portalEventToAnalyticsEvent(event), overrides), sourceLabel: event.kind === "meetup" ? "Conference meetup" : "Conference" })),
  )
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
    onOverrideSaved(override)
  }

  return (
    <div className="flex flex-col gap-5">
      {!hideViewTabs && (
        <SectionTabs
          active={active}
          onChange={setInternalActive}
          items={[
            { id: "zoom", label: "Zoom" },
            { id: "eventbrite", label: "Eventbrite" },
            ...(isSuperadmin ? [{ id: "labeling" as const, label: "Event Labeling" }] : []),
          ]}
        />
      )}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Included events" value={formatNumber(zoomEvents.length)} helper="Curated public/event-facing list" />
            <StatCard label="Avg attendees" value={formatNumber(zoomTotalParticipants / Math.max(zoomEvents.length, 1), 1)} />
            <StatCard label="Avg retention" value={formatPercent(zoomEvents.reduce((sum, event) => sum + event.retentionPct, 0) / Math.max(zoomEvents.length, 1))} helper="Avg attended minutes / event duration" />
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
          term: "WhatsApp contact provided",
          definition: "Directory members with a WhatsApp contact link in their Portal profile.",
          methodology: "This is contact availability only. It is not evidence that a member joined an IPN group; onboarding completion and explicit Already in / Not interested responses are reported separately.",
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
          methodology: "Uses filtered merged rows with country values. City view includes records with a city, while country view also includes country-only members. Stored Portal or cached city coordinates are preferred; explicit country centroids provide labeled fallbacks. Country markers use a stored country centroid when available, otherwise a member-count-weighted center of mapped cities. Bubble area scales with member count. City view reports mapped members and marker count; country view reports mapped members and listed countries.",
        },
        {
          term: "Registration conversion",
          definition: "Percent of unique tracked registration sessions that completed registration.",
          methodology: "Calculated over the rolling 30-day window as unique sessions with registration_success divided by unique sessions that viewed /register.",
        },
        {
          term: "Sign-in conversion",
          definition: "Percent of unique tracked sign-in sessions that completed sign-in.",
          methodology: "Calculated over the rolling 30-day window as unique sessions with sign_in_success divided by unique sessions that viewed /login.",
        },
        {
          term: "Monthly active users",
          definition: "Unique eligible members with a qualifying action in the rolling 30-day window.",
          methodology: "Qualifying actions are Portal event RSVPs, deliberate resource/blog/newsletter opens, connection requests sent or accepted, and deterministically email-matched actual attendance. A new sign-in is not required and external email opens are excluded.",
        },
        {
          term: "Utilization member type",
          definition: "Current IPN leadership versus regular IPN members.",
          methodology: "Leadership is defined by live Portal profiles with an admin or superadmin role. Sessions are attributed after an authenticated event identifies the member; unresolved anonymous sessions appear only in All.",
        },
        {
          term: "Page views and member journeys",
          definition: "Portal page traffic plus aggregate and session-level paths after registration or sign-in.",
          methodology: "Page views use retained first-party page_view events for Dashboard, Community, Events, Conferences, and Profile. Feedback counts tracked modal opens. Journey detail follows the session identifier for the 90-day raw-event retention window.",
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
          methodology: "Currently includes WhatsApp community analytics, Search Console SEO analytics, and future external source ingestion.",
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

function ReviewBadge({ status }: { status: "Production" | "Enhanced" | "New" }) {
  if (process.env.NODE_ENV === "production") return null
  const tone = status === "Production"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Enhanced"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-violet-200 bg-violet-50 text-violet-700"
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>{status}</span>
}

function DataDefinitionsPanel({
  snapshot,
  analyticsRefresh,
  eventLabelOverrides,
  portalEvents,
  communityEvents,
  onOverrideSaved,
  isSuperadmin,
}: {
  snapshot: LegacyAnalyticsSnapshot
  analyticsRefresh: PortalAnalyticsRefreshRun | null
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  portalEvents: PortalAnalyticsEvent[]
  communityEvents: CommunityAnalyticsEvent[]
  onOverrideSaved: (override: AnalyticsEventLabelOverride) => void
  isSuperadmin: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      {process.env.NODE_ENV !== "production" && (
        <Panel title="Review consolidation matrix" subtitle="Local-review aid only; this matrix and status badges are omitted from production builds.">
          <SimpleTable
            columns={[{ key: "production", label: "Production report" }, { key: "destination", label: "Five-tab destination" }, { key: "status", label: "Review status" }]}
            rows={[
              ["Members + Member Directory", "Registration & Membership", "Enhanced"],
              ["Portal registration funnel", "Registration & Membership", "Enhanced"],
              ["Onboarding progress", "Onboarding", "New"],
              ["Portal utilization + journeys", "Engagement › Member Portal Activity", "Enhanced"],
              ["Zoom", "Engagement › Zoom", "Production"],
              ["Eventbrite", "Engagement › Eventbrite", "Production"],
              ["Mailchimp Marketing", "Reach & Acquisition › Mailchimp", "Enhanced"],
              ["Social Media", "Reach & Acquisition › Social Media", "Production"],
              ["Website", "Reach & Acquisition › Website", "Production"],
              ["Data Sources & Glossary", "Data & Definitions", "Enhanced"],
            ].map(([production, destination, status]) => ({ production, destination, status: <ReviewBadge status={status as "Production" | "Enhanced" | "New"} /> }))}
          />
        </Panel>
      )}

      <section aria-labelledby="definitions-by-report" className="flex flex-col gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ipn">Definitions by report</p><h3 id="definitions-by-report" className="mt-1 text-lg font-semibold text-zinc-900">What each metric means</h3></div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Member identity"><p className="text-sm leading-6 text-zinc-600">One merged record per normalized email. The latest nonblank Member Portal response is definitive; the latest legacy response fills only fields the Portal has not answered.</p></Panel>
          <Panel title="MAU and WAU"><p className="text-sm leading-6 text-zinc-600">Unique eligible Portal members with at least one qualifying action in the rolling 30- or 7-day window. A qualifying action is a Portal event RSVP, resource or deliberate blog/newsletter open, connection request sent or accepted, or deterministically matched attendance. External email opens and passive sign-ins are excluded.</p></Panel>
          <Panel title="Onboarding completion"><p className="text-sm leading-6 text-zinc-600">Four milestones: choose a WhatsApp preference, complete the profile, take the Portal tour, and participate in IPN. Participation uses the earliest proved activity and remains complete after a later cancellation.</p></Panel>
          <Panel title="Current response coverage"><p className="text-sm leading-6 text-zinc-600">Single-select percentages use members who answered the field as the denominator and show coverage. Barriers are multi-select and can exceed 100% in total; they apply only when the member’s latest status makes the question relevant.</p></Panel>
        </div>
      </section>

      <section aria-labelledby="freshness-coverage" className="flex flex-col gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ipn">Freshness &amp; coverage</p><h3 id="freshness-coverage" className="mt-1 text-lg font-semibold text-zinc-900">Reliability boundaries</h3></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <p><span className="font-semibold">Mailchimp:</span> the current audience snapshot contains {formatNumber(snapshot.marketing.summary.totalSubscribers)} subscribers. A historical source note reports 1,895; the current data cannot explain the difference, so the dashboard does not reconcile or combine those figures.</p>
          <p className="mt-2"><span className="font-semibold">Identity matching:</span> Zoom and Eventbrite attendance attaches to a Portal member only through deterministic normalized-email matching. Unmatched attendees remain in factual event totals but do not enter MAU, WAU, or individual member activity.</p>
          <p className="mt-2"><span className="font-semibold">Reliable ranges:</span> raw Portal journey detail is retained for {90} days. Revised MAU/WAU history starts with the earliest reliable qualifying-action record and does not splice in the retired sign-in-plus-click definition.</p>
        </div>
        <LiveConnectionsStrip snapshot={snapshot} analyticsRefresh={analyticsRefresh} />
      </section>

      <section aria-labelledby="technical-maintenance" className="flex flex-col gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-ipn">Technical &amp; maintenance</p><h3 id="technical-maintenance" className="mt-1 text-lg font-semibold text-zinc-900">Refresh recovery and restricted controls</h3></div>
        <DataSourcesPanel />
        {isSuperadmin && (
          <EventsPanel snapshot={snapshot} analyticsRefresh={analyticsRefresh} eventLabelOverrides={eventLabelOverrides} portalEvents={portalEvents} communityEvents={communityEvents} onOverrideSaved={onOverrideSaved} isSuperadmin={isSuperadmin} forcedView="labeling" hideViewTabs />
        )}
      </section>
    </div>
  )
}

export default function AnalyticsDashboardShell({ memberInsights, portalUtilization, onboardingAnalytics, analyticsSnapshot, mailchimpAnalytics, analyticsRefresh, eventLabelOverrides, portalEvents, communityEvents = [], communityEventsError, isSuperadmin }: Props) {
  const [savedOverrides, setSavedOverrides] = useState<AnalyticsEventLabelOverride[]>([])
  const sharedOverrides = [...eventLabelOverrides.filter((row) => !savedOverrides.some((saved) => saved.event_id === row.event_id)), ...savedOverrides]
  const handleOverrideSaved = (override: AnalyticsEventLabelOverride) => setSavedOverrides((current) => [...current.filter((row) => row.event_id !== override.event_id), override])
  const [activeSection, setActiveSection] = useState<AnalyticsSectionId>("registration-membership")
  const [engagementView, setEngagementView] = useState<EngagementView>("overview")
  const [reachView, setReachView] = useState<ReachView>("overview")
  const section = ANALYTICS_SECTIONS.find((item) => item.id === activeSection) ?? ANALYTICS_SECTIONS[0]

  useEffect(() => {
    const restoreFromUrl = () => {
      const url = new URL(window.location.href)
      const report = url.searchParams.get("report")
      const view = url.searchParams.get("view")
      if (ANALYTICS_SECTIONS.some((item) => item.id === report)) setActiveSection(report as AnalyticsSectionId)
      if (report === "engagement") setEngagementView(["overview", "zoom", "eventbrite", "portal-activity"].includes(view ?? "") ? view as EngagementView : "overview")
      if (report === "reach") setReachView(["overview", "mailchimp", "social-media", "website"].includes(view ?? "") ? view as ReachView : "overview")
    }
    restoreFromUrl()
    return subscribeToUrlState(restoreFromUrl)
  }, [])

  function pushReport(report: AnalyticsSectionId, view?: EngagementView | ReachView) {
    setActiveSection(report)
    const url = new URL(window.location.href)
    url.searchParams.set("report", report)
    if (view) url.searchParams.set("view", view)
    else url.searchParams.delete("view")
    window.history.pushState({}, "", url)
  }

  function changeEngagementView(view: EngagementView) {
    setEngagementView(view)
    pushReport("engagement", view)
  }

  function changeReachView(view: ReachView) {
    setReachView(view)
    pushReport("reach", view)
  }

  function changeSection(report: AnalyticsSectionId) {
    if (report === "engagement") {
      setEngagementView("overview")
      pushReport(report, "overview")
      return
    }
    if (report === "reach") {
      setReachView("overview")
      pushReport(report, "overview")
      return
    }
    pushReport(report)
  }

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

      <div className="rounded-2xl border border-zinc-200 bg-white px-2 shadow-sm">
        <SectionTabs active={activeSection} onChange={changeSection} items={ANALYTICS_SECTIONS.map(({ id, label }) => ({ id, label }))} />
      </div>

      <section className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{section.label}</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">{section.title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{section.description}</p>
        </div>

        {activeSection === "registration-membership" && (
          <RegistrationMembershipPanel
            memberInsights={memberInsights}
            portalUtilization={portalUtilization}
          />
        )}
        {activeSection === "onboarding" && <OnboardingPanel data={onboardingAnalytics} />}
        {activeSection === "engagement" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3"><SectionTabs active={engagementView} onChange={changeEngagementView} items={[{ id: "overview", label: "Overview" }, { id: "zoom", label: "Zoom" }, { id: "eventbrite", label: "Eventbrite" }, { id: "portal-activity", label: "Member Portal Activity" }]} />{engagementView === "overview" ? <ReviewBadge status="New" /> : engagementView === "portal-activity" ? <ReviewBadge status="Enhanced" /> : <ReviewBadge status="Production" />}</div>
            {engagementView === "overview" && <EngagementOverviewPanel data={portalUtilization} events={portalEvents} communityEvents={communityEvents} communityEventsError={communityEventsError} snapshot={analyticsSnapshot} eventLabelOverrides={sharedOverrides} />}
            {engagementView === "zoom" && <EventsPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} eventLabelOverrides={sharedOverrides} portalEvents={portalEvents} communityEvents={communityEvents} onOverrideSaved={handleOverrideSaved} isSuperadmin={isSuperadmin} forcedView="zoom" hideViewTabs />}
            {engagementView === "eventbrite" && <EventsPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} eventLabelOverrides={sharedOverrides} portalEvents={portalEvents} communityEvents={communityEvents} onOverrideSaved={handleOverrideSaved} isSuperadmin={isSuperadmin} forcedView="eventbrite" hideViewTabs />}
            {engagementView === "portal-activity" && <PortalUtilizationPanel data={portalUtilization} mode="activity" />}
          </div>
        )}
        {activeSection === "reach" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3"><SectionTabs active={reachView} onChange={changeReachView} items={[{ id: "overview", label: "Overview" }, { id: "mailchimp", label: "Mailchimp" }, { id: "social-media", label: "Social Media" }, { id: "website", label: "Website" }]} />{reachView === "overview" ? <ReviewBadge status="New" /> : reachView === "mailchimp" ? <ReviewBadge status="Enhanced" /> : <ReviewBadge status="Production" />}</div>
            {reachView === "overview" && <ReachOverviewPanel snapshot={analyticsSnapshot} />}
            {reachView === "mailchimp" && <MarketingPanel snapshot={analyticsSnapshot} mailchimpAnalytics={mailchimpAnalytics} />}
            {reachView === "social-media" && <SocialMediaPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} isSuperadmin={isSuperadmin} />}
            {reachView === "website" && <WebsitePanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} />}
          </div>
        )}
        {activeSection === "data-definitions" && <DataDefinitionsPanel snapshot={analyticsSnapshot} analyticsRefresh={analyticsRefresh} eventLabelOverrides={sharedOverrides} portalEvents={portalEvents} communityEvents={communityEvents} onOverrideSaved={handleOverrideSaved} isSuperadmin={isSuperadmin} />}
      </section>
    </div>
  )
}
