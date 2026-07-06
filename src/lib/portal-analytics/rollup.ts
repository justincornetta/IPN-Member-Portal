import { createAdminClient } from "@/lib/supabase/admin"

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

export async function runPortalAnalyticsMaintenance() {
  const admin = createAdminClient()
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
