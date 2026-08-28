import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  isPermanentWhatsAppChannelSlug,
  normalizeWhatsAppAnalyticsSessionId,
  normalizeWhatsAppSource,
  normalizeWhatsAppSurface,
} from "@/lib/whatsapp/channels"
import {
  createWhatsAppHandoffToken,
  getEventWhatsAppInvite,
  hashWhatsAppHandoffToken,
  permanentTarget,
  type ResolvedWhatsAppTarget,
} from "@/lib/whatsapp/server"

export const runtime = "nodejs"

const HANDOFF_TTL_MS = 10 * 60 * 1000

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    const expectedHost =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      requestUrl.host
    const expectedProtocol =
      request.headers.get("x-forwarded-proto") ??
      requestUrl.protocol.replace(":", "")

    return (
      originUrl.host === expectedHost &&
      originUrl.protocol === `${expectedProtocol}:`
    )
  } catch {
    return false
  }
}

async function resolveTarget(
  kind: string,
  slug: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ target?: ResolvedWhatsAppTarget; error?: NextResponse }> {
  if (kind === "permanent") {
    if (!isPermanentWhatsAppChannelSlug(slug)) {
      return { error: errorResponse("Unknown WhatsApp channel", 404) }
    }
    const target = permanentTarget(slug)
    if (!target) return { error: errorResponse("WhatsApp channel is not configured", 503) }
    return { target }
  }

  if (kind !== "event" || !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(slug)) {
    return { error: errorResponse("Unknown WhatsApp channel", 404) }
  }

  const { event, access } = await getEventWhatsAppInvite(supabase, userId, slug)
  if (!access.allowed) {
    if (access.reason === "rsvp_required") {
      return { error: errorResponse("RSVP is required before opening this event chat", 403) }
    }
    if (access.reason === "inactive") {
      return { error: errorResponse("This event chat is not active", 404) }
    }
    if (access.reason === "invalid_invite") {
      return { error: errorResponse("This event chat is not configured safely", 503) }
    }
    return { error: errorResponse("Event chat not found", 404) }
  }

  return {
    target: {
      kind: "event",
      slug,
      label: event!.title,
      eventId: event!.id,
      inviteUrl: access.inviteUrl,
      featured: false,
    },
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string; slug: string }> },
) {
  if (!requestHasSameOrigin(request)) return errorResponse("Invalid request origin", 403)

  const requestUrl = new URL(request.url)
  const source = normalizeWhatsAppSource(requestUrl.searchParams.get("source"))
  const surface = normalizeWhatsAppSurface(requestUrl.searchParams.get("surface"))
  const analyticsSessionId = normalizeWhatsAppAnalyticsSessionId(
    requestUrl.searchParams.get("sessionId"),
  )
  const { kind, slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return errorResponse("Authentication required", 401)

  let resolved: Awaited<ReturnType<typeof resolveTarget>>
  try {
    resolved = await resolveTarget(kind, slug, user.id, supabase)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[whatsapp] handoff target resolution failed:", message)
    return errorResponse("Could not verify WhatsApp channel access", 503)
  }
  if (resolved.error || !resolved.target) return resolved.error!
  const target = resolved.target

  const token = createWhatsAppHandoffToken()
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString()
  const admin = createAdminClient()
  const { error } = await admin
    .from("member_whatsapp_handoffs")
    .insert({
      token_hash: hashWhatsAppHandoffToken(token),
      user_id: user.id,
      channel_kind: target.kind,
      channel_slug: target.slug,
      source,
      surface,
      analytics_session_id: analyticsSessionId,
      event_id: target.eventId,
      expires_at: expiresAt,
    })

  if (error) {
    if (
      target.kind === "permanent" &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message.includes("does not exist") ||
        error.message.includes("Could not find the table"))
    ) {
      const fallbackQuery = new URLSearchParams({ source, surface })
      return NextResponse.json(
        {
          handoffPath: `/go/whatsapp/${encodeURIComponent(target.slug)}?${fallbackQuery}`,
          expiresAt,
          channel: {
            kind: target.kind,
            slug: target.slug,
            label: target.label,
            featured: target.featured,
          },
        },
        { headers: { "Cache-Control": "no-store, private" } },
      )
    }
    console.error("[whatsapp] handoff insert failed:", error.message)
    return errorResponse("Could not prepare WhatsApp handoff", 503)
  }

  const handoffPath = `/go/whatsapp/${encodeURIComponent(target.slug)}?handoff=${encodeURIComponent(token)}`
  return NextResponse.json(
    {
      handoffPath,
      expiresAt,
      channel: {
        kind: target.kind,
        slug: target.slug,
        label: target.label,
        featured: target.featured,
      },
    },
    { headers: { "Cache-Control": "no-store, private" } },
  )
}
