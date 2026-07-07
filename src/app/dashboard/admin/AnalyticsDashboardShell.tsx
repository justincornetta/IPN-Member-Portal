"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import type { CSSProperties, ReactElement, ReactNode } from "react"
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
import { saveAnalyticsEventLabelOverride } from "@/lib/admin/actions"
import type { AdminMemberProfile, AnalyticsEventLabelOverride } from "@/lib/admin/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import type { AnalyticsPoint, LegacyAnalyticsSnapshot } from "@/lib/admin/analytics/types"

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
type MemberAnalyticsView = "portal" | "legacy" | "utilization"
type EventsView = "zoom" | "eventbrite" | "labeling"
type WebsiteGeoView = "countries" | "cities"
type Granularity = "daily" | "weekly" | "monthly"
type EventbriteMetric = "tickets" | "revenue"
type SocialMetric = "followers" | "engagementRate" | "posts"
type DeviceFilter = "all" | "desktop" | "mobile" | "tablet" | "unknown"
type AnalyticsEventProgram = "IPN Labs" | "PsychedelX" | "Other"
type AnalyticsEventType = "public" | "internal"

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
  eventLabelOverrides: AnalyticsEventLabelOverride[]
  portalEvents: PortalAnalyticsEvent[]
  isSuperadmin: boolean
  onSelectMember: (member: AdminMemberProfile) => void
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
}: {
  source: LegacyAnalyticsSnapshot["dataSources"][number] | undefined
  detail?: string
}) {
  if (!source) return null
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      <span className="font-semibold">{source.label} freshness:</span> last pulled {formatDate(source.lastPull)}. {detail ?? source.note}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const className =
    normalized === "live" || normalized === "active"
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

function PortalMembersPanel({
  memberInsights,
  onSelectMember,
}: {
  memberInsights: MemberInsightsData | null
  onSelectMember: (member: AdminMemberProfile) => void
}) {
  const [signupsPage, setSignupsPage] = useState(0)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [granularity, setGranularity] = useState<Granularity>("monthly")

  if (!memberInsights) {
    return <EmptyState title="Portal member data unavailable" description="The live Supabase member query did not return data for this admin request." />
  }

  const filteredProfiles = memberInsights.profiles.filter((profile) => isWithinDateRange(profile.created_at, fromDate, toDate))
  const filteredTotal = filteredProfiles.length
  const filteredDiscoverable = filteredProfiles.filter((profile) => profile.is_discoverable).length
  const filteredWithTags = filteredProfiles.filter((profile) => (profile.interest_tags?.length ?? 0) > 0).length
  const filteredHidden = filteredTotal - filteredDiscoverable
  const registrationTrend = aggregateByGranularity(filteredProfiles.map((profile) => ({
    date: profile.created_at,
    values: { registrations: 1 },
  })), granularity).reduce<{ label: string; registrations: number; cumulative: number }[]>((acc, row) => {
    const previous = acc.at(-1)?.cumulative ?? 0
    acc.push({ label: row.label, registrations: row.registrations, cumulative: previous + row.registrations })
    return acc
  }, [])
  const recentRows = memberInsights.recent?.filter((member) => isWithinDateRange(member.created_at, fromDate, toDate)) ?? null

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
      </FilterBar>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total members" value={formatNumber(filteredTotal)} helper={filteredTotal === memberInsights.total ? "All Portal members" : `${formatNumber(memberInsights.total)} all-time`} />
        <StatCard label="Discoverable" value={formatNumber(filteredDiscoverable)} helper={`${formatPercent(filteredTotal ? filteredDiscoverable / filteredTotal * 100 : 0)} of total`} />
        <StatCard label="Hidden" value={formatNumber(filteredHidden)} helper={`${formatPercent(filteredTotal ? filteredHidden / filteredTotal * 100 : 0)} of total`} />
        <StatCard label="With interest tags" value={formatNumber(filteredWithTags)} helper={`${formatPercent(filteredTotal ? filteredWithTags / filteredTotal * 100 : 0)} of total`} />
      </div>

      <Panel title="New registrations over time" subtitle={`Portal profile records by ${granularity.replace("ly", "")}`}>
        <ResponsiveChart height={320}>
          <ComposedChart data={registrationTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="registrations" name="New registrations" fill="#93c5fd" radius={[6, 6, 0, 0]} />
            <Line type="monotone" dataKey="cumulative" name="Cumulative members" stroke="#2563eb" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveChart>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Stage breakdown"><BarList items={memberInsights.personaItems.map(([label, value]) => ({ label, value }))} /></Panel>
        <Panel title="Field breakdown"><BarList items={memberInsights.fieldItems.map(([label, value]) => ({ label, value }))} /></Panel>
        <Panel title="Top interest tags"><BarList items={memberInsights.topTags.map(([label, value]) => ({ label, value }))} /></Panel>
        <Panel title="Top schools"><BarList items={memberInsights.topSchools.map(([label, value]) => ({ label, value }))} /></Panel>
        <Panel title="Top countries" className="lg:col-span-2"><BarList items={memberInsights.topCountries.map(([label, value]) => ({ label, value }))} /></Panel>
      </div>

      {recentRows && (() => {
        const pageSize = 5
        const totalPages = Math.ceil(recentRows.length / pageSize)
        const pageItems = recentRows.slice(signupsPage * pageSize, (signupsPage + 1) * pageSize)

        return (
          <Panel title="Recent signups" subtitle={`${recentRows.length} most recent Portal registrations`}>
            <div className="divide-y divide-zinc-100">
              {pageItems.map((member) => {
                const badge = mailchimpBadge(member.mailchimp_status)
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onSelectMember({
                      id: member.id,
                      first_name: member.first_name,
                      last_name: member.last_name,
                      email: member.email,
                      avatar_url: null,
                      role: null,
                      admin_role: null,
                      team: null,
                      persona: member.persona,
                      bio: null,
                    })}
                    className="flex w-full cursor-pointer flex-col gap-2 px-1 py-3 text-left transition hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">{member.first_name} {member.last_name}</p>
                      <p className="truncate text-xs text-zinc-400">{member.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {member.persona && <span className="text-xs text-zinc-500">{member.persona}</span>}
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                      <span className="text-xs text-zinc-400">{formatDate(member.created_at)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <PaginationControls page={signupsPage} totalPages={totalPages} onPageChange={setSignupsPage} />
          </Panel>
        )
      })()}
    </div>
  )
}

function LegacyMembershipPanel({ snapshot }: { snapshot: LegacyAnalyticsSnapshot }) {
  const members = snapshot.members
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [source, setSource] = useState("all")
  const [country, setCountry] = useState("all")
  const [field, setField] = useState("all")
  const gender = members.demographics.gender?.items ?? []
  const age = members.demographics.age_bucket?.items ?? []
  const race = members.demographics.race?.items ?? []
  const countries = Array.from(new Set(members.formRows.map((row) => row.country).filter(Boolean))).sort()
  const fields = Array.from(new Set(members.formRows.map((row) => row.field).filter(Boolean))).sort()
  const filteredRows = members.formRows.filter((row) => (
    (source === "all" || source === "form") &&
    isWithinDateRange(row.date, fromDate, toDate) &&
    (country === "all" || row.country === country) &&
    (field === "all" || row.field === field)
  ))
  const filteredCountries = Object.entries(filteredRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.country || "Unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const filteredFields = Object.entries(filteredRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.field || "Unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const filteredHeard = Object.entries(filteredRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.heard || "Unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  return (
    <div className="flex flex-col gap-6">
      <FilterBar>
        <FilterField label="From date">
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="To date">
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={inputClassName} />
        </FilterField>
        <FilterField label="Source">
          <SelectInput
            value={source}
            onChange={setSource}
            options={[
              { value: "all", label: "All sources" },
              { value: "form", label: "Form detail" },
              { value: "mailchimp", label: "Mailchimp" },
              { value: "oldapp", label: "Old App" },
            ]}
          />
        </FilterField>
        <FilterField label="Country">
          <SelectInput value={country} onChange={setCountry} options={[{ value: "all", label: "All countries" }, ...countries.map((item) => ({ value: item, label: item }))]} />
        </FilterField>
        <FilterField label="Field">
          <SelectInput value={field} onChange={setField} options={[{ value: "all", label: "All fields" }, ...fields.map((item) => ({ value: item, label: item }))]} />
        </FilterField>
      </FilterBar>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total footprint" value={formatNumber(members.totals.rowCount)} helper="Deduped legacy SoT records" />
        <StatCard label="Filtered form rows" value={formatNumber(filteredRows.length)} helper={`${formatNumber(members.totals.inForm)} total form rows`} />
        <StatCard label="Mailchimp records" value={formatNumber(members.totals.inMailchimp)} />
        <StatCard label="Legacy app records" value={formatNumber(members.totals.inOldApp)} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Cumulative member growth" subtitle={`Snapshot built ${formatDate(members.totals.builtAt)}. May 2026 includes a legacy app/Mailchimp import-date batch from first_seen_at, not confirmed real signup timing.`} className="lg:col-span-2">
          <ResponsiveChart height={320}>
            <ComposedChart data={members.growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="newMembers" name="New members" fill="#93c5fd" />
              <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke="#2563eb" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="People per source" subtitle="Source totals can overlap">
          <ResponsiveChart height={280}>
            <BarChart data={members.sourceTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>
        </Panel>
        <Panel title="Source combinations">
          <BarList items={members.sourceCombinations} />
        </Panel>
        <Panel title="Top countries">
          <BarList items={filteredCountries.length ? filteredCountries : members.countries} />
        </Panel>
        <Panel title="Top states">
          <BarList items={members.states} />
        </Panel>
        <Panel title="Primary field">
          <BarList items={filteredFields.length ? filteredFields : members.primaryField} />
        </Panel>
        <Panel title="Self description">
          <BarList items={members.selfDescription} />
        </Panel>
        <Panel title="Gender">
          <BarList items={gender} />
        </Panel>
        <Panel title="Age">
          <BarList items={age} />
        </Panel>
        <Panel title="Race / ethnicity">
          <BarList items={race} />
        </Panel>
        <Panel title="Referral source">
          <BarList items={filteredHeard.length ? filteredHeard : members.referralSource} />
        </Panel>
      </div>

      <Panel title="Legacy registration detail" subtitle="Recent historical form records from the legacy membership file">
        <SimpleTable
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "date", label: "Date" },
            { key: "country", label: "Country" },
            { key: "field", label: "Field" },
            { key: "heard", label: "Heard" },
          ]}
          rows={filteredRows.map((row) => ({
            name: `${row.firstName} ${row.lastName}`.trim() || "-",
            email: row.email || "-",
            date: formatDate(row.date),
            country: row.country || "-",
            field: truncate(row.field || "-", 48),
            heard: truncate(row.heard || "-", 48),
          }))}
        />
      </Panel>
    </div>
  )
}

function MembersAnalyticsPanel({
  memberInsights,
  portalUtilization,
  analyticsSnapshot,
  onSelectMember,
}: {
  memberInsights: MemberInsightsData | null
  portalUtilization: PortalUtilizationData
  analyticsSnapshot: LegacyAnalyticsSnapshot
  onSelectMember: (member: AdminMemberProfile) => void
}) {
  const [activeView, setActiveView] = useState<MemberAnalyticsView>("portal")

  return (
    <div className="flex flex-col gap-5">
      <SectionTabs
        active={activeView}
        onChange={setActiveView}
        items={[
          { id: "portal", label: "Portal Members" },
          { id: "legacy", label: "Legacy Membership" },
          { id: "utilization", label: "Member Portal Utilization" },
        ]}
      />
      {activeView === "portal" ? (
        <PortalMembersPanel memberInsights={memberInsights} onSelectMember={onSelectMember} />
      ) : activeView === "utilization" ? (
        <PortalUtilizationPanel data={portalUtilization} />
      ) : (
        <LegacyMembershipPanel snapshot={analyticsSnapshot} />
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

function MarketingPanel({ snapshot }: { snapshot: LegacyAnalyticsSnapshot }) {
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

function SocialMediaPanel({ snapshot }: { snapshot: LegacyAnalyticsSnapshot }) {
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

function WebsitePanel({ snapshot }: { snapshot: LegacyAnalyticsSnapshot }) {
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
  portalEventId?: string
  status?: string | null
}

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
    portalEventId: event.id,
    status: event.status,
  }
}

function applyEventLabelOverrides(
  events: LegacyAnalyticsSnapshot["events"]["zoom"]["events"],
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
      <table className="min-w-[1180px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            {[
              "Event",
              "Date",
              "Program",
              "Registrants",
              "Attendees",
              "Attendance %",
              "Avg duration",
              "Repeat %",
              "First-time %",
            ].map((label, index) => (
              <th key={label} className={`whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${index >= 3 ? "text-right" : "text-left"}`}>
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
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.registrants == null ? "-" : formatNumber(event.registrants)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "Pending" : formatNumber(event.attendees)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : event.registrants ? formatPercent(event.attendees / event.registrants * 100) : "-"}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : formatDuration(event.avgDuration)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : formatPercent(event.repeatPct)}</td>
                  <td className="px-3 py-3 text-right align-top tabular-nums text-zinc-600">{event.source === "portal" ? "-" : formatPercent(Math.max(0, 100 - event.repeatPct))}</td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={9} className="bg-zinc-50 px-3 py-4">
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
        }
      })
    : event.participants.map((participant) => ({
        name: participant.name,
        email: participant.email,
        registeredAt: null,
        attended: true as boolean | null,
        durationMin: participant.durationMin,
        eventsAttended: participant.eventsAttended,
      }))

  const emailRows = !registrationRows.length
    ? event.participantEmails.map((email) => ({
        name: "",
        email,
        registeredAt: null,
        attended: true as boolean | null,
        durationMin: null,
        eventsAttended: 0,
      }))
    : []
  const rows = registrationRows.length ? registrationRows : emailRows
  const registrationTrend = aggregateByGranularity(event.registrations.map((registration) => ({
    date: registration.registeredAt,
    values: { registrations: 1 },
  })), "daily")

  return (
    <div className="flex flex-col gap-4">
      {registrationTrend.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-800">Registrations over time</p>
          <ResponsiveChart height={220}>
            <BarChart data={registrationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="registrations" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveChart>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[920px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100">
              {["Name", "Email", "Registered", "Attended", "Duration", "Events attended"].map((label, index) => (
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
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{formatNumber(row.eventsAttended)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-400">
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
  eventLabelOverrides,
  portalEvents,
  isSuperadmin,
}: {
  snapshot: LegacyAnalyticsSnapshot
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
  const portalAnalyticsEvents = applyEventLabelOverrides(portalEvents.map(portalEventToAnalyticsEvent), overrides)
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
          detail={active === "zoom"
            ? "Zoom analytics combine curated Zoom attendance exports with upcoming Member Portal RSVP counts. June PsychedelX currently has registrants but no Zoom participant report rows; older IPN Labs events have attendance rows but no registrant export rows."
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
          <Panel title="Zoom event detail" subtitle="Click an event to expand registrant trend, registrant timestamps, and available attendance detail.">
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

function DataSourcesPanel({ snapshot }: { snapshot: LegacyAnalyticsSnapshot }) {
  const glossary = [
    { term: "Portal Members", definition: "Live Supabase member records shown from the authenticated Member Portal admin query." },
    { term: "Legacy Membership", definition: "Historical membership source-of-truth snapshot combining form records, Mailchimp, and old app records." },
    { term: "Subscribers", definition: "Current Mailchimp audience members across the pulled lists." },
    { term: "Open rate", definition: "Campaign opens divided by sent emails for the selected Mailchimp campaigns." },
    { term: "Click rate", definition: "Campaign clicks divided by sent emails for the selected Mailchimp campaigns." },
    { term: "Campaign click detail", definition: "URL-level click rows from Mailchimp. Total clicks are preserved; unique clicks appear when present in the source export." },
    { term: "Sessions", definition: "GA4 website sessions for the selected reporting period." },
    { term: "Unique visitors", definition: "GA4 users/visitors for the selected reporting period." },
    { term: "Bounce rate", definition: "GA4 bounce rate shown as a percent. Website cards aggregate visible trend rows when filters are active." },
    { term: "Zoom included events", definition: "Curated external/event-facing IPN Labs and PsychedelX events approved for leadership analytics." },
    { term: "Eventbrite included events", definition: "PsychedelX conferences plus IPN student/professional mixers. Unrelated one-off events are excluded from primary counts." },
    { term: "WhatsApp community metrics", definition: "Pending future source for current community activity, event chats, and connection workflows." },
    { term: "Source freshness", definition: "Last successful pull timestamp from the legacy refresh pipeline or manual snapshot." },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Source status" subtitle="No analytics JSON is exposed through public routes or public assets">
        <SimpleTable
          columns={[
            { key: "source", label: "Source" },
            { key: "status", label: "Status" },
            { key: "mode", label: "Mode" },
            { key: "lastPull", label: "Last pull" },
            { key: "note", label: "Note" },
          ]}
          rows={snapshot.dataSources.map((source) => ({
            source: source.label,
            status: <StatusBadge status={source.status} />,
            mode: source.mode,
            lastPull: formatDate(source.lastPull),
            note: source.note,
          }))}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Refresh recovery notes">
          <div className="space-y-3 text-sm leading-6 text-zinc-600">
            <p>All migrated analytics data is bundled under a server-only admin data layer and passed through the authenticated admin route.</p>
            <p>The legacy refresh is stale after May 31, 2026. Current Events analytics applies the curated include/exclude list and the approved May 30 Zoom backfill.</p>
            <p>Future event analytics should move to Portal RSVPs plus actual Zoom attendance so the Portal becomes the operational source of truth.</p>
            <p>New source loaders should use the same admin verification pattern already used by admin server actions.</p>
          </div>
        </Panel>
        <Panel title="Pending integrations">
          <BarList
            items={[
              { label: "WhatsApp community analytics", value: 1 },
              { label: "Search Console SEO analytics", value: 1 },
              { label: "Donations source reconciliation", value: 1 },
              { label: "Automated snapshot refresh", value: 1 },
            ]}
            valueLabel={() => "Pending"}
          />
        </Panel>
      </div>

      <Panel title="Data glossary" subtitle="Metric definitions used across Analytics">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {glossary.map((item) => (
            <details key={item.term} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">{item.term}</summary>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{item.definition}</p>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  )
}

export default function AnalyticsDashboardShell({ memberInsights, portalUtilization, analyticsSnapshot, eventLabelOverrides, portalEvents, isSuperadmin, onSelectMember }: Props) {
  const [activeSection, setActiveSection] = useState<AnalyticsSectionId>("members")
  const section = ANALYTICS_SECTIONS.find((item) => item.id === activeSection) ?? ANALYTICS_SECTIONS[0]
  const statusText = useMemo(() => `Snapshot generated ${formatDate(analyticsSnapshot.generatedAt)}`, [analyticsSnapshot.generatedAt])

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Analytics</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
              Authenticated leadership dashboard migrated from IPN operations reporting.
            </p>
          </div>
          <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {statusText}
          </span>
        </div>
      </div>

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
            analyticsSnapshot={analyticsSnapshot}
            onSelectMember={onSelectMember}
          />
        )}
        {activeSection === "community" && <CommunityPanel />}
        {activeSection === "marketing" && <MarketingPanel snapshot={analyticsSnapshot} />}
        {activeSection === "social-media" && <SocialMediaPanel snapshot={analyticsSnapshot} />}
        {activeSection === "website" && <WebsitePanel snapshot={analyticsSnapshot} />}
        {activeSection === "events" && <EventsPanel snapshot={analyticsSnapshot} eventLabelOverrides={eventLabelOverrides} portalEvents={portalEvents} isSuperadmin={isSuperadmin} />}
        {activeSection === "data-sources" && <DataSourcesPanel snapshot={analyticsSnapshot} />}
      </section>
    </div>
  )
}
