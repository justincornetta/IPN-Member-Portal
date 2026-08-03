import { createAdminClient } from "@/lib/supabase/admin"
import { analyticsLocationKey } from "@/lib/admin/analytics/geography"
import type {
  PortalAnalyticsRefreshRun,
  PortalAnalyticsRefreshRunStatus,
  PortalAnalyticsRefreshSource,
} from "./types"

type RawAnalyticsEvent = {
  event_name: string
  user_id: string | null
  session_id: string
  page_path: string | null
  target_id: string | null
  error_code: string | null
  duration_seconds: number | null
  click_count: number | null
  occurred_at: string
}

type RollupAccumulator = {
  rollup_date: string
  event_name: string
  page_path: string
  dimension: string
  event_count: number
  users: Set<string>
  sessions: Set<string>
  total_duration_seconds: number
  total_clicks: number
}

type MaintenanceOptions = {
  trigger?: string
  externalSources?: PortalAnalyticsRefreshSource[]
  validationSummary?: Record<string, unknown>
}

type RefreshRunRow = {
  id: string
  started_at: string
  finished_at: string | null
  status: PortalAnalyticsRefreshRunStatus
  trigger: string
  sources: unknown
  summary: unknown
  error_message: string | null
  created_at: string
}

type AdminClient = ReturnType<typeof createAdminClient>

const RAW_RETENTION_DAYS = 90
const PAGE_SIZE = 1000

type GeocodeCoverageResult = {
  located: number
  mapped: number
  coveragePct: number
  error: string | null
}

function dateDaysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}

function rollupKey(event: RawAnalyticsEvent) {
  const rollupDate = event.occurred_at.slice(0, 10)
  const pagePath = event.page_path ?? ""
  const dimension = event.error_code ?? event.target_id ?? ""
  return `${rollupDate}|${event.event_name}|${pagePath}|${dimension}`
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function normalizeSources(value: unknown): PortalAnalyticsRefreshSource[] {
  if (!Array.isArray(value)) return []
  return value.filter((source): source is PortalAnalyticsRefreshSource => {
    return Boolean(
      source
      && typeof source === "object"
      && typeof (source as PortalAnalyticsRefreshSource).id === "string"
      && typeof (source as PortalAnalyticsRefreshSource).label === "string",
    )
  })
}

function normalizeInputSources(value: unknown): PortalAnalyticsRefreshSource[] {
  if (!Array.isArray(value)) return []
  const sources: PortalAnalyticsRefreshSource[] = []
  for (const source of value) {
    const record = toRecord(source)
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const label = typeof record.label === "string" ? record.label.trim() : ""
    const status = record.status === "success" || record.status === "warning" || record.status === "error"
      ? record.status
      : "error"
    if (!id || !label) continue
    sources.push({
      id,
      label,
      status,
      lastRefreshedAt: typeof record.lastRefreshedAt === "string" ? record.lastRefreshedAt : null,
      lastAttemptedAt: typeof record.lastAttemptedAt === "string" ? record.lastAttemptedAt : null,
      lastSuccessfulAt: typeof record.lastSuccessfulAt === "string" ? record.lastSuccessfulAt : null,
      records: typeof record.records === "number" ? record.records : null,
      note: typeof record.note === "string" ? record.note : null,
    })
  }
  return sources
}

function mapRefreshRun(row: RefreshRunRow): PortalAnalyticsRefreshRun {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    trigger: row.trigger,
    sources: normalizeSources(row.sources),
    summary: toRecord(row.summary),
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}

async function startRefreshRun(admin: AdminClient, trigger: string) {
  const { data, error } = await admin
    .from("portal_analytics_refresh_runs")
    .insert({ trigger, status: "running" })
    .select("id")
    .single()

  if (error) throw new Error(`Unable to start analytics refresh run: ${error.message}`)
  return data.id as string
}

async function updateRefreshRun(
  admin: AdminClient,
  id: string,
  values: {
    status: PortalAnalyticsRefreshRunStatus
    finished_at?: string
    sources?: PortalAnalyticsRefreshSource[]
    summary?: Record<string, unknown>
    error_message?: string
  },
) {
  const { error } = await admin
    .from("portal_analytics_refresh_runs")
    .update(values)
    .eq("id", id)

  if (error) throw new Error(`Unable to update analytics refresh run: ${error.message}`)
}

async function countRows(admin: AdminClient, table: string, selectColumn: string) {
  const { count, error } = await admin
    .from(table)
    .select(selectColumn, { count: "exact", head: true })

  if (error) return { count: null, error: error.message }
  return { count: count ?? 0, error: null }
}

async function latestTimestamp(admin: AdminClient, table: string, column: string) {
  const { data, error } = await admin
    .from(table)
    .select(column)
    .not(column, "is", null)
    .order(column, { ascending: false })
    .limit(1)

  if (error) return { value: null, error: error.message }
  const row = (data?.[0] ?? null) as unknown as Record<string, unknown> | null
  const value = row?.[column]
  return { value: typeof value === "string" ? value : null, error: null }
}

async function sourceStatus(
  admin: AdminClient,
  {
    id,
    label,
    table,
    countColumn,
    latestColumn,
    note,
  }: {
    id: string
    label: string
    table: string
    countColumn: string
    latestColumn: string
    note: string
  },
): Promise<PortalAnalyticsRefreshSource> {
  const [countResult, latestResult] = await Promise.all([
    countRows(admin, table, countColumn),
    latestTimestamp(admin, table, latestColumn),
  ])
  const error = countResult.error ?? latestResult.error

  return {
    id,
    label,
    status: error ? "error" : "success",
    lastRefreshedAt: latestResult.value,
    records: countResult.count,
    note: error ?? note,
  }
}

async function getPortalAnalyticsSourceStatuses(admin: AdminClient) {
  return Promise.all([
    sourceStatus(admin, {
      id: "member_profiles",
      label: "Member profiles",
      table: "profiles",
      countColumn: "id",
      latestColumn: "created_at",
      note: "Live Member Portal profiles queried from Supabase.",
    }),
    sourceStatus(admin, {
      id: "member_source_of_truth",
      label: "Member source-of-truth",
      table: "legacy_member_sot_rows",
      countColumn: "id",
      latestColumn: "imported_at",
      note: "Imported member source-of-truth rows stored in the Member Portal database.",
    }),
    sourceStatus(admin, {
      id: "portal_usage_events",
      label: "Portal usage events",
      table: "portal_analytics_events",
      countColumn: "event_name",
      latestColumn: "occurred_at",
      note: "Raw first-party portal events retained for 90 days.",
    }),
    sourceStatus(admin, {
      id: "portal_usage_rollups",
      label: "Portal usage rollups",
      table: "portal_analytics_daily_rollups",
      countColumn: "rollup_date",
      latestColumn: "updated_at",
      note: "Daily portal event rollups used for longer-term trend reporting.",
    }),
    sourceStatus(admin, {
      id: "portal_event_registrations",
      label: "Portal event registrations",
      table: "event_registrations",
      countColumn: "event_id",
      latestColumn: "created_at",
      note: "Member Portal RSVP rows are the forward registrant source of truth.",
    }),
    sourceStatus(admin, {
      id: "member_onboarding",
      label: "Member onboarding",
      table: "member_onboarding_progress",
      countColumn: "user_id",
      latestColumn: "updated_at",
      note: "Member onboarding completion state stored in Supabase.",
    }),
    (async (): Promise<PortalAnalyticsRefreshSource> => {
      const [{ count }, { data, error }] = await Promise.all([
        admin.from("social_metric_snapshots").select("platform", { count: "exact", head: true }).eq("platform", "linkedin"),
        admin
          .from("social_metric_snapshots")
          .select("snapshot_date, captured_at")
          .eq("platform", "linkedin")
          .order("snapshot_date", { ascending: false })
          .limit(1),
      ])
      if (error) return {
        id: "linkedin",
        label: "LinkedIn",
        status: "error",
        lastRefreshedAt: null,
        records: count ?? 0,
        note: error.message,
      }
      const latest = data?.[0] ?? null
      const latestAt = latest?.captured_at ?? (latest?.snapshot_date ? `${latest.snapshot_date}T00:00:00Z` : null)
      const stale = !latestAt || Date.now() - new Date(latestAt).getTime() > 30 * 24 * 60 * 60 * 1000
      return {
        id: "linkedin",
        label: "LinkedIn",
        status: stale ? "warning" : "success",
        lastRefreshedAt: latestAt,
        records: count ?? 0,
        note: stale ? "LinkedIn follower data is missing or more than 30 days old." : "Manual LinkedIn follower snapshots are current.",
      }
    })(),
  ])
}

async function fetchCoverageRows(admin: AdminClient, table: string, columns: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { rows, error: error.message }
    const page = (data ?? []) as unknown as Record<string, unknown>[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { rows, error: null }
  }
}

function cleanLocationPart(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

async function getMembershipGeocodeCoverage(admin: AdminClient): Promise<GeocodeCoverageResult> {
  const [profilesResult, legacyResult, geocodesResult] = await Promise.all([
    fetchCoverageRows(admin, "profiles", "id,email,city,state,country,city_lat,city_lng"),
    fetchCoverageRows(admin, "legacy_member_sot_rows", "id,normalized_email,city,state,country"),
    fetchCoverageRows(admin, "analytics_location_geocodes", "city,state,country,latitude,longitude,precision"),
  ])
  const error = profilesResult.error ?? legacyResult.error ?? geocodesResult.error
  if (error) return { located: 0, mapped: 0, coveragePct: 0, error }

  const exact = new Set<string>()
  const countries = new Set<string>()
  for (const row of geocodesResult.rows) {
    const country = cleanLocationPart(row.country)
    const city = cleanLocationPart(row.city)
    if (!country) continue
    if (row.precision === "country" || !city) countries.add(country.toLowerCase())
    else exact.add(analyticsLocationKey(city, cleanLocationPart(row.state), country))
  }

  const memberLocations = new Map<string, Record<string, unknown>>()
  for (const row of profilesResult.rows) {
    const email = cleanLocationPart(row.email).toLowerCase()
    memberLocations.set(email || `portal:${String(row.id)}`, row)
  }
  for (const row of legacyResult.rows) {
    const email = cleanLocationPart(row.normalized_email).toLowerCase()
    const key = email || `legacy:${String(row.id)}`
    if (!memberLocations.has(key)) memberLocations.set(key, row)
  }

  let located = 0
  let mapped = 0
  for (const row of memberLocations.values()) {
    const city = cleanLocationPart(row.city)
    const state = cleanLocationPart(row.state)
    const country = cleanLocationPart(row.country)
    if (!city && !country) continue
    located += 1
    const hasProfileCoordinates = Number.isFinite(Number(row.city_lat)) && Number.isFinite(Number(row.city_lng))
      && row.city_lat != null && row.city_lng != null
    if (
      hasProfileCoordinates
      || (country && exact.has(analyticsLocationKey(city, state, country)))
      || (country && countries.has(country.toLowerCase()))
    ) mapped += 1
  }

  return {
    located,
    mapped,
    coveragePct: located ? Math.round(mapped / located * 1000) / 10 : 0,
    error: null,
  }
}

async function getPreviousGeocodeCoverage(admin: AdminClient) {
  const { data } = await admin
    .from("portal_analytics_refresh_runs")
    .select("summary")
    .in("status", ["success", "partial_failure"])
    .order("started_at", { ascending: false })
    .limit(1)
  const summary = toRecord(data?.[0]?.summary)
  const coverage = toRecord(summary.geocodeCoverage)
  const value = Number(coverage.coveragePct)
  return Number.isFinite(value) ? value : null
}

async function rollupPortalAnalyticsEvents(admin: AdminClient) {
  const since = dateDaysAgo(RAW_RETENTION_DAYS + 1).toISOString()
  const cutoff = dateDaysAgo(RAW_RETENTION_DAYS).toISOString()
  const rollups = new Map<string, RollupAccumulator>()

  let from = 0
  while (true) {
    const { data, error } = await admin
      .from("portal_analytics_events")
      .select("event_name,user_id,session_id,page_path,target_id,error_code,duration_seconds,click_count,occurred_at")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as RawAnalyticsEvent[]
    if (rows.length === 0) break

    for (const event of rows) {
      const key = rollupKey(event)
      const current = rollups.get(key) ?? {
        rollup_date: event.occurred_at.slice(0, 10),
        event_name: event.event_name,
        page_path: event.page_path ?? "",
        dimension: event.error_code ?? event.target_id ?? "",
        event_count: 0,
        users: new Set<string>(),
        sessions: new Set<string>(),
        total_duration_seconds: 0,
        total_clicks: 0,
      }

      current.event_count += 1
      if (event.user_id) current.users.add(event.user_id)
      current.sessions.add(event.session_id)
      current.total_duration_seconds += event.duration_seconds ?? 0
      current.total_clicks += event.click_count ?? 0
      rollups.set(key, current)
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const rollupRows = Array.from(rollups.values()).map((rollup) => ({
    rollup_date: rollup.rollup_date,
    event_name: rollup.event_name,
    page_path: rollup.page_path,
    dimension: rollup.dimension,
    event_count: rollup.event_count,
    unique_users: rollup.users.size,
    unique_sessions: rollup.sessions.size,
    total_duration_seconds: rollup.total_duration_seconds,
    total_clicks: rollup.total_clicks,
    updated_at: new Date().toISOString(),
  }))

  for (let index = 0; index < rollupRows.length; index += PAGE_SIZE) {
    const chunk = rollupRows.slice(index, index + PAGE_SIZE)
    const { error } = await admin
      .from("portal_analytics_daily_rollups")
      .upsert(chunk, {
        onConflict: "rollup_date,event_name,page_path,dimension",
      })
    if (error) throw new Error(error.message)
  }

  const { error: deleteError, count: deletedRawEvents } = await admin
    .from("portal_analytics_events")
    .delete({ count: "exact" })
    .lt("occurred_at", cutoff)

  if (deleteError) throw new Error(deleteError.message)

  return {
    rollups: rollupRows.length,
    deletedRawEvents: deletedRawEvents ?? 0,
    rawRetentionDays: RAW_RETENTION_DAYS,
  }
}

export async function runPortalAnalyticsMaintenance(options: MaintenanceOptions = {}) {
  const admin = createAdminClient()
  const trigger = options.trigger || "manual"
  const externalSources = normalizeInputSources(options.externalSources)
  const previousGeocodeCoverage = await getPreviousGeocodeCoverage(admin)
  const runId = await startRefreshRun(admin, trigger)

  try {
    const [rollupResult, portalSources, geocodeCoverage] = await Promise.all([
      rollupPortalAnalyticsEvents(admin),
      getPortalAnalyticsSourceStatuses(admin),
      getMembershipGeocodeCoverage(admin),
    ])
    const finishedAt = new Date().toISOString()
    const coverageFell = previousGeocodeCoverage != null
      && geocodeCoverage.coveragePct < previousGeocodeCoverage
    portalSources.push({
      id: "membership_geography",
      label: "Membership geography",
      status: geocodeCoverage.error ? "error" : coverageFell ? "warning" : "success",
      lastRefreshedAt: geocodeCoverage.error ? null : finishedAt,
      lastAttemptedAt: finishedAt,
      lastSuccessfulAt: geocodeCoverage.error ? null : finishedAt,
      records: geocodeCoverage.located,
      note: geocodeCoverage.error
        ?? (coverageFell
          ? `Geocode coverage fell from ${previousGeocodeCoverage}% to ${geocodeCoverage.coveragePct}%.`
          : `${geocodeCoverage.mapped} of ${geocodeCoverage.located} located member records are mapped (${geocodeCoverage.coveragePct}%).`),
    })
    const sources = [...externalSources, ...portalSources]
    const hasSourceErrors = sources.some((source) => source.status === "error")
    const summary = {
      ...rollupResult,
      validation: options.validationSummary ?? {},
      geocodeCoverage: {
        ...geocodeCoverage,
        previousCoveragePct: previousGeocodeCoverage,
      },
      externalSourceCount: externalSources.length,
      portalSourceCount: portalSources.length,
      sourceCount: sources.length,
    }

    await updateRefreshRun(admin, runId, {
      status: hasSourceErrors ? "partial_failure" : "success",
      finished_at: finishedAt,
      sources,
      summary,
    })

    return {
      refreshRunId: runId,
      finishedAt,
      sources,
      status: hasSourceErrors ? "partial_failure" : "success",
      ...rollupResult,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics refresh error"
    try {
      await updateRefreshRun(admin, runId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
    } catch (updateError) {
      console.error(updateError)
    }
    throw error
  }
}

export async function getLatestPortalAnalyticsRefresh(): Promise<PortalAnalyticsRefreshRun | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("portal_analytics_refresh_runs")
    .select("id, started_at, finished_at, status, trigger, sources, summary, error_message, created_at")
    .order("started_at", { ascending: false })
    .limit(1)

  if (error) {
    console.warn(`Unable to fetch latest analytics refresh run: ${error.message}`)
    return null
  }

  const row = (data?.[0] ?? null) as RefreshRunRow | null
  if (!row) return null
  const refresh = mapRefreshRun(row)
  if (row.status === "success") {
    refresh.lastSuccessfulAt = row.finished_at ?? row.started_at
    return refresh
  }
  const { data: previousSuccess } = await admin
    .from("portal_analytics_refresh_runs")
    .select("finished_at, started_at")
    .eq("status", "success")
    .order("started_at", { ascending: false })
    .limit(1)
  refresh.lastSuccessfulAt = previousSuccess?.[0]?.finished_at ?? previousSuccess?.[0]?.started_at ?? null
  return refresh
}
