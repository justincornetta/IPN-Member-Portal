import type { SupabaseClient } from "@supabase/supabase-js"

// Explicit pagination avoids Supabase's per-response row cap. All reads run
// server-side after the dashboard's leadership authorization check.
export async function fetchCommunityInventoryRows(admin: SupabaseClient) {
  async function all(table: string, columns: string, orderColumns: string[]) {
    const rows: Record<string, unknown>[] = []
    for (let offset = 0; ; offset += 1000) {
      let query = admin.from(table).select(columns)
      for (const column of orderColumns) query = query.order(column, { ascending: true })
      const { data, error } = await query.range(offset, offset + 999)
      if (error) return { rows: [], error: `${table}: ${error.message}` }
      rows.push(...(data ?? []) as unknown as Record<string, unknown>[])
      if (!data || data.length < 1000) return { rows, error: null }
    }
  }
  const [conferences, historical, conferenceRsvps, meetupRsvps] = await Promise.all([
    all("conferences", "id, name, starts_at, ends_at, status, meetups", ["id"]),
    all("past_conferences", "id, name, starts_at, ends_at", ["id"]),
    all("conference_rsvps", "conference_id, user_id, created_at", ["conference_id", "user_id"]),
    all("conference_meetup_rsvps", "conference_id, meetup_id, user_id, created_at", ["conference_id", "meetup_id", "user_id"]),
  ])
  return { conferences, historical, conferenceRsvps, meetupRsvps, error: [conferences, historical, conferenceRsvps, meetupRsvps].map((result) => result.error).filter(Boolean).join("; ") || null }
}
