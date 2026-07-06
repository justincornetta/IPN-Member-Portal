import { createAdminClient } from "@/lib/supabase/admin"

export const PORTAL_ANALYTICS_EVENTS = [
  "page_view",
  "page_duration",
  "session_summary",
  "curated_click",
  "registration_view",
  "registration_submit",
  "registration_success",
  "registration_error",
  "sign_in_view",
  "sign_in_submit",
  "sign_in_success",
  "sign_in_error",
  "event_rsvp_created",
  "event_rsvp_cancelled",
  "whatsapp_profile_linked",
  "whatsapp_cta_clicked",
] as const

export type PortalAnalyticsEventName = (typeof PORTAL_ANALYTICS_EVENTS)[number]

export const PORTAL_ANALYTICS_EVENT_SET = new Set<string>(PORTAL_ANALYTICS_EVENTS)

export type PortalAnalyticsPayload = {
  eventName: PortalAnalyticsEventName
  sessionId: string
  anonymousId?: string | null
  pagePath?: string | null
  pageTitle?: string | null
  referrer?: string | null
  targetId?: string | null
  targetLabel?: string | null
  errorCode?: string | null
  durationSeconds?: number | null
  clickCount?: number | null
  metadata?: Record<string, unknown> | null
}

const MAX_TEXT_LENGTH = 300
const MAX_LABEL_LENGTH = 500
const MAX_METADATA_LENGTH = 2000

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

function cleanInteger(value: unknown, max = 86400) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(max, Math.round(value)))
}

function cleanMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const safe: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (safeStringIncludesSecret(key)) continue
    if (typeof raw === "string") {
      if (safeStringIncludesSecret(raw)) continue
      safe[key.slice(0, 80)] = raw.slice(0, MAX_LABEL_LENGTH)
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      safe[key.slice(0, 80)] = raw
    } else if (typeof raw === "boolean" || raw === null) {
      safe[key.slice(0, 80)] = raw
    }
  }

  const serialized = JSON.stringify(safe)
  if (serialized.length <= MAX_METADATA_LENGTH) return safe
  return { truncated: true }
}

function safeStringIncludesSecret(value: string) {
  const lowered = value.toLowerCase()
  return lowered.includes("password") ||
    lowered.includes("token") ||
    lowered.includes("secret") ||
    lowered.includes("authorization")
}

export function sanitizePortalAnalyticsPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const body = payload as Record<string, unknown>
  const eventName = cleanText(body.eventName, 80)
  const sessionId = cleanText(body.sessionId, 120)
  if (!eventName || !PORTAL_ANALYTICS_EVENT_SET.has(eventName) || !sessionId) return null

  return {
    event_name: eventName as PortalAnalyticsEventName,
    session_id: sessionId,
    anonymous_id: cleanText(body.anonymousId, 120),
    page_path: cleanText(body.pagePath, MAX_LABEL_LENGTH),
    page_title: cleanText(body.pageTitle, MAX_LABEL_LENGTH),
    referrer: cleanText(body.referrer, MAX_LABEL_LENGTH),
    target_id: cleanText(body.targetId, 120),
    target_label: cleanText(body.targetLabel, MAX_LABEL_LENGTH),
    error_code: cleanText(body.errorCode, 120),
    duration_seconds: cleanInteger(body.durationSeconds),
    click_count: cleanInteger(body.clickCount, 10000),
    metadata: cleanMetadata(body.metadata),
  }
}

export async function recordPortalAnalyticsEvent(
  payload: PortalAnalyticsPayload & { userId?: string | null },
) {
  const sanitized = sanitizePortalAnalyticsPayload(payload)
  if (!sanitized) return

  try {
    const admin = createAdminClient()
    await admin.from("portal_analytics_events").insert({
      ...sanitized,
      user_id: payload.userId ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[portal-analytics] server event failed:", message)
  }
}
