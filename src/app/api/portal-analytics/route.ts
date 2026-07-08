import { NextResponse } from "next/server"
import { sanitizePortalAnalyticsPayload } from "@/lib/portal-analytics/events"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const sanitized = sanitizePortalAnalyticsPayload(body)
  if (!sanitized) {
    return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { error } = await admin.from("portal_analytics_events").insert({
    ...sanitized,
    user_id: user?.id ?? null,
  })

  if (error) {
    console.error("[portal-analytics] insert failed:", error.message)
    return NextResponse.json({ error: "Could not record event" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
