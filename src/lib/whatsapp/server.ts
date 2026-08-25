import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PERMANENT_WHATSAPP_CHANNELS,
  isPermanentWhatsAppChannelSlug,
  validateEventWhatsAppAccess,
  validateWhatsAppInviteUrl,
  type PermanentWhatsAppChannelSlug,
} from "./channels"

declare const Netlify:
  | {
      env?: {
        get(name: string): string | undefined
      }
    }
  | undefined

function serverEnv(name: string) {
  if (typeof Netlify !== "undefined") {
    return Netlify.env?.get(name) ?? process.env[name]
  }
  return process.env[name]
}

export function getPermanentWhatsAppInvite(slug: string) {
  if (!isPermanentWhatsAppChannelSlug(slug)) return null
  const channel = PERMANENT_WHATSAPP_CHANNELS[slug]
  const inviteUrl = validateWhatsAppInviteUrl(serverEnv(channel.envKey))
  if (!inviteUrl) return null
  return { channel, inviteUrl }
}

export async function getEventWhatsAppInvite(
  supabase: SupabaseClient,
  userId: string,
  eventSlug: string,
) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, title, status, chat_platform, chat_status, chat_external_url")
    .eq("slug", eventSlug)
    .maybeSingle()

  if (eventError) throw new Error(`Could not read event chat: ${eventError.message}`)

  let isRegistered = false
  if (event) {
    const { data: registration, error: registrationError } = await supabase
      .from("event_registrations")
      .select("event_id")
      .eq("event_id", event.id)
      .eq("user_id", userId)
      .maybeSingle()
    if (registrationError) throw new Error(`Could not verify event RSVP: ${registrationError.message}`)
    isRegistered = Boolean(registration)
  }

  const access = validateEventWhatsAppAccess(event, isRegistered)
  return { event, access }
}

export type ResolvedWhatsAppTarget = {
  kind: "permanent" | "event"
  slug: string
  label: string
  eventId: string | null
  inviteUrl: URL
  featured: boolean
}

export function permanentTarget(slug: PermanentWhatsAppChannelSlug): ResolvedWhatsAppTarget | null {
  const resolved = getPermanentWhatsAppInvite(slug)
  if (!resolved) return null
  return {
    kind: "permanent",
    slug,
    label: resolved.channel.label,
    eventId: null,
    inviteUrl: resolved.inviteUrl,
    featured: resolved.channel.featured,
  }
}

export function createWhatsAppHandoffToken() {
  return randomBytes(32).toString("base64url")
}

export function hashWhatsAppHandoffToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export async function getEventWhatsAppInviteById(
  admin: SupabaseClient,
  eventId: string,
  eventSlug: string,
) {
  const { data: event, error } = await admin
    .from("events")
    .select("id, slug, title, status, chat_platform, chat_status, chat_external_url")
    .eq("id", eventId)
    .eq("slug", eventSlug)
    .maybeSingle()
  if (error) throw new Error(`Could not read event chat: ${error.message}`)

  const access = validateEventWhatsAppAccess(event, true)
  if (!access.allowed) return { event, access }
  return { event, access }
}
