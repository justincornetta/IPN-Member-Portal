import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { recordPortalAnalyticsEvent } from "@/lib/portal-analytics/events"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  isPermanentWhatsAppChannelSlug,
  normalizeWhatsAppAnalyticsSessionId,
  normalizeWhatsAppSource,
  type WhatsAppDeliveryMode,
} from "@/lib/whatsapp/channels"
import {
  getEventWhatsAppInvite,
  permanentTarget,
  type ResolvedWhatsAppTarget,
} from "@/lib/whatsapp/server"

export const runtime = "nodejs"

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  return !origin || origin === new URL(request.url).origin
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
  const mode = (requestUrl.searchParams.get("mode") ?? "redirect") as WhatsAppDeliveryMode
  if (mode !== "redirect" && mode !== "qr") return errorResponse("Invalid delivery mode", 400)

  const source = normalizeWhatsAppSource(requestUrl.searchParams.get("source"))
  const analyticsSessionId =
    normalizeWhatsAppAnalyticsSessionId(requestUrl.searchParams.get("sessionId"))
    ?? `server_${randomUUID()}`
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
    console.error("[whatsapp] target resolution failed:", message)
    return errorResponse("Could not verify WhatsApp channel access", 503)
  }
  if (resolved.error || !resolved.target) return resolved.error!
  const target = resolved.target

  const admin = createAdminClient()
  const { data: intent, error: intentError } = await admin
    .from("member_whatsapp_join_intents")
    .insert({
      user_id: user.id,
      channel_kind: target.kind,
      channel_slug: target.slug,
      source,
      event_id: target.eventId,
    })
    .select("clicked_at")
    .single()

  if (intentError || !intent) {
    console.error("[whatsapp] join intent insert failed:", intentError?.message ?? "missing row")
    return errorResponse("Could not record WhatsApp join intent", 503)
  }

  await recordPortalAnalyticsEvent({
    eventName: "whatsapp_join_intent",
    sessionId: analyticsSessionId,
    userId: user.id,
    pagePath: request.headers.get("referer"),
    targetId: `${target.kind}:${target.slug}`,
    targetLabel: target.label,
    metadata: {
      channelKind: target.kind,
      channelSlug: target.slug,
      source,
      deliveryMode: mode,
      eventId: target.eventId,
    },
  })

  if (mode === "qr") {
    return NextResponse.json(
      {
        inviteUrl: target.inviteUrl.toString(),
        channel: {
          kind: target.kind,
          slug: target.slug,
          label: target.label,
          featured: target.featured,
        },
        joinIntentRecordedAt: intent.clicked_at,
        whatsappMembershipVerified: false,
      },
      { headers: { "Cache-Control": "no-store, private" } },
    )
  }

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: target.inviteUrl.toString(),
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  })
}
