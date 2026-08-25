import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { recordPortalAnalyticsEvent } from "@/lib/portal-analytics/events"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isPermanentWhatsAppChannelSlug,
  isWhatsAppHandoffToken,
  normalizeWhatsAppSource,
  normalizeWhatsAppSurface,
} from "@/lib/whatsapp/channels"
import {
  getEventWhatsAppInviteById,
  hashWhatsAppHandoffToken,
  permanentTarget,
  type ResolvedWhatsAppTarget,
} from "@/lib/whatsapp/server"

export const runtime = "nodejs"

type HandoffRow = {
  id: string
  user_id: string
  channel_kind: "permanent" | "event"
  channel_slug: string
  source: string
  surface: string
  analytics_session_id: string | null
  event_id: string | null
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

function redirectToInvite(target: ResolvedWhatsAppTarget) {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: target.inviteUrl.toString(),
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
    },
  })
}

async function resolveHandoffTarget(
  admin: ReturnType<typeof createAdminClient>,
  handoff: HandoffRow,
) {
  if (handoff.channel_kind === "permanent") {
    if (!isPermanentWhatsAppChannelSlug(handoff.channel_slug)) return null
    return permanentTarget(handoff.channel_slug)
  }

  if (!handoff.event_id) return null
  const { event, access } = await getEventWhatsAppInviteById(
    admin,
    handoff.event_id,
    handoff.channel_slug,
  )
  if (!event || !access.allowed) return null
  return {
    kind: "event" as const,
    slug: event.slug,
    label: event.title,
    eventId: event.id,
    inviteUrl: access.inviteUrl,
    featured: false,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  const { channel } = await params
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(channel)) {
    return errorResponse("Unknown WhatsApp channel", 404)
  }

  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get("handoff")
  const admin = createAdminClient()

  if (token !== null) {
    if (!isWhatsAppHandoffToken(token)) {
      return errorResponse("WhatsApp handoff is invalid or expired", 410)
    }
    const tokenHash = hashWhatsAppHandoffToken(token)
    const { data, error } = await admin
      .from("member_whatsapp_handoffs")
      .select("id, user_id, channel_kind, channel_slug, source, surface, analytics_session_id, event_id")
      .eq("token_hash", tokenHash)
      .eq("channel_slug", channel)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error("[whatsapp] handoff lookup failed:", error.message)
      return errorResponse("Could not verify WhatsApp handoff", 503)
    }
    const handoff = data as HandoffRow | null
    if (!handoff) return errorResponse("WhatsApp handoff is invalid or expired", 410)

    let target: ResolvedWhatsAppTarget | null
    try {
      target = await resolveHandoffTarget(admin, handoff)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[whatsapp] handoff target lookup failed:", message)
      return errorResponse("Could not verify WhatsApp channel", 503)
    }
    if (!target) return errorResponse("WhatsApp channel is not available", 404)

    const { data: consumed, error: consumeError } = await admin
      .rpc("consume_whatsapp_handoff", {
        p_token_hash: tokenHash,
        p_channel_slug: channel,
      })
      .maybeSingle()
    if (consumeError) {
      console.error("[whatsapp] handoff consume failed:", consumeError.message)
      return errorResponse("Could not record WhatsApp join intent", 503)
    }
    if (!consumed) return errorResponse("WhatsApp handoff is invalid or expired", 410)

    await recordPortalAnalyticsEvent({
      eventName: "whatsapp_join_intent",
      sessionId: handoff.analytics_session_id ?? `handoff_${randomUUID()}`,
      userId: handoff.user_id,
      targetId: `${target.kind}:${target.slug}`,
      targetLabel: target.label,
      metadata: {
        channelKind: target.kind,
        channelSlug: target.slug,
        source: handoff.source,
        surface: handoff.surface,
        eventId: target.eventId,
        handoffId: handoff.id,
      },
    })
    return redirectToInvite(target)
  }

  // Tokenless GETs are a compatibility fallback for old/static QR assets.
  // They never attach activity to a member, even when an auth cookie exists.
  if (!isPermanentWhatsAppChannelSlug(channel)) {
    return errorResponse("Unknown WhatsApp channel", 404)
  }
  const target = permanentTarget(channel)
  if (!target) return errorResponse("WhatsApp channel is not configured", 503)

  const source = normalizeWhatsAppSource(requestUrl.searchParams.get("source"))
  const surface = normalizeWhatsAppSurface(requestUrl.searchParams.get("surface"))
  await recordPortalAnalyticsEvent({
    eventName: "whatsapp_anonymous_redirect",
    sessionId: `anonymous_${randomUUID()}`,
    targetId: `permanent:${channel}`,
    targetLabel: target.label,
    metadata: { channelKind: "permanent", channelSlug: channel, source, surface },
  })
  return redirectToInvite(target)
}
