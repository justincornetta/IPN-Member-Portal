import { createAdminClient } from "@/lib/supabase/admin"
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
  ])
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
  const runId = await startRefreshRun(admin, trigger)

  try {
    const rollupResult = await rollupPortalAnalyticsEvents(admin)
    const sources = await getPortalAnalyticsSourceStatuses(admin)
    const finishedAt = new Date().toISOString()
    const summary = {
      ...rollupResult,
      sourceCount: sources.length,
    }

    await updateRefreshRun(admin, runId, {
      status: "success",
      finished_at: finishedAt,
      sources,
      summary,
    })

    return {
      refreshRunId: runId,
      finishedAt,
      sources,
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
  return row ? mapRefreshRun(row) : null
}
