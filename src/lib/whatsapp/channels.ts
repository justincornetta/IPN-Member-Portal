export const WHATSAPP_ANNOUNCEMENTS_NOTE =
  "Joining any IPN WhatsApp group automatically adds the member to Announcements. IPN does not publish a separate Announcements invite."

export const PERMANENT_WHATSAPP_CHANNELS = {
  general: {
    slug: "general",
    label: "IPN General",
    description: "The featured, recommended starting point for the IPN community.",
    featured: true,
    envKey: "WHATSAPP_GENERAL_INVITE_URL",
  },
  labs: {
    slug: "labs",
    label: "IPN Labs",
    description: "Discussion and updates for IPN Labs programming.",
    featured: false,
    envKey: "WHATSAPP_LABS_INVITE_URL",
  },
  conferences: {
    slug: "conferences",
    label: "Conferences",
    description: "Coordination and connection around psychedelic conferences.",
    featured: false,
    envKey: "WHATSAPP_CONFERENCES_INVITE_URL",
  },
} as const

export type PermanentWhatsAppChannelSlug = keyof typeof PERMANENT_WHATSAPP_CHANNELS
export type WhatsAppChannelKind = "permanent" | "event"

export function isPermanentWhatsAppChannelSlug(
  value: string,
): value is PermanentWhatsAppChannelSlug {
  return Object.hasOwn(PERMANENT_WHATSAPP_CHANNELS, value)
}

export function normalizeWhatsAppSource(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? ""
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : "unspecified"
}

export function normalizeWhatsAppAnalyticsSessionId(value: string | null) {
  const normalized = value?.trim() ?? ""
  return /^[A-Za-z0-9_-]{1,120}$/.test(normalized) ? normalized : null
}

export function normalizeWhatsAppSurface(value: string | null) {
  const normalized = value?.trim().toLowerCase() ?? ""
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : "unspecified"
}

export function isWhatsAppHandoffToken(value: string | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function validateWhatsAppInviteUrl(value: string | null | undefined): URL | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    if (url.hostname.toLowerCase() !== "chat.whatsapp.com") return null
    if (url.port || url.username || url.password || url.hash) return null
    if (!/^\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null
    return url
  } catch {
    return null
  }
}

export type EventWhatsAppAccessRecord = {
  id: string
  slug: string
  title: string
  status: string
  chat_platform: string | null
  chat_status: string | null
  chat_external_url: string | null
}

export function validateEventWhatsAppAccess(
  event: EventWhatsAppAccessRecord | null,
  isRegistered: boolean,
) {
  if (!event || event.status !== "published") return { allowed: false as const, reason: "not_found" as const }
  if (!isRegistered) return { allowed: false as const, reason: "rsvp_required" as const }
  if (event.chat_platform !== "whatsapp" || event.chat_status !== "active") {
    return { allowed: false as const, reason: "inactive" as const }
  }
  const inviteUrl = validateWhatsAppInviteUrl(event.chat_external_url)
  if (!inviteUrl) return { allowed: false as const, reason: "invalid_invite" as const }
  return { allowed: true as const, inviteUrl }
}
