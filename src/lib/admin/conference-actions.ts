"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyAdmin } from "@/lib/admin/actions"
import { clean, isValidTimeZone, slugify, toIsoInTimeZone } from "@/lib/admin/content-utils"
import type {
  ConferenceCategory,
  ConferenceDiscount,
  ConferenceMeetup,
  ConferenceRecord,
  ConferenceStatus,
} from "@/lib/conferences/types"

export type AdminConferenceMeetupInput = {
  title: string
  type?: string
  startsAt: string
  location?: string
  description?: string
  registrationUrl?: string
}

export type AdminConferenceDiscountInput = {
  label: string
  code?: string
  url?: string
  description?: string
  expiresAt?: string
}

export type AdminConferencePayload = {
  id?: string
  slug?: string
  name: string
  organizer?: string
  category: ConferenceCategory
  summary?: string
  description?: string
  startsAt: string
  endsAt: string
  timezone: string
  city?: string
  state?: string
  country?: string
  venue?: string
  websiteUrl?: string
  registrationUrl?: string
  whatsappUrl?: string
  status: ConferenceStatus
  meetups: AdminConferenceMeetupInput[]
  discounts: AdminConferenceDiscountInput[]
}

const CONFERENCE_ADMIN_SELECT =
  "id, slug, name, organizer, category, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status"

export async function listAdminConferences(): Promise<ConferenceRecord[]> {
  const auth = await verifyAdmin()
  if ("error" in auth) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from("conferences")
    .select(CONFERENCE_ADMIN_SELECT)
    .order("starts_at", { ascending: true })
    .limit(200)

  return (data ?? []) as ConferenceRecord[]
}

export async function publishAdminConference(
  payload: AdminConferencePayload,
): Promise<{ error?: string; slug?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const name = clean(payload.name)
  if (!name) return { error: "Name is required" }

  const timezone = clean(payload.timezone) ?? "America/New_York"
  if (!isValidTimeZone(timezone)) return { error: "Timezone is invalid" }

  const startsAt = toIsoInTimeZone(payload.startsAt, timezone)
  const endsAt = toIsoInTimeZone(payload.endsAt, timezone)
  if (!startsAt) return { error: "Start date is required" }
  if (!endsAt) return { error: "End date is required" }

  const meetups: ConferenceMeetup[] = payload.meetups
    .filter((meetup) => clean(meetup.title))
    .map((meetup) => ({
      title: clean(meetup.title)!,
      type: clean(meetup.type) ?? "IPN Meetup",
      startsAt: toIsoInTimeZone(meetup.startsAt, timezone) ?? startsAt,
      location: clean(meetup.location),
      description: clean(meetup.description),
      registrationUrl: clean(meetup.registrationUrl),
    }))

  const discounts: ConferenceDiscount[] = payload.discounts
    .filter((discount) => clean(discount.label))
    .map((discount) => ({
      label: clean(discount.label)!,
      code: clean(discount.code),
      url: clean(discount.url),
      description: clean(discount.description),
      expiresAt: toIsoInTimeZone(discount.expiresAt, timezone),
    }))

  const admin = createAdminClient()
  const slug = clean(payload.slug) ?? slugify(name)

  const conferencePayload = {
    slug,
    name,
    organizer: clean(payload.organizer),
    category: payload.category,
    summary: clean(payload.summary),
    description: clean(payload.description),
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    city: clean(payload.city),
    state: clean(payload.state),
    country: clean(payload.country),
    venue: clean(payload.venue),
    website_url: clean(payload.websiteUrl),
    registration_url: clean(payload.registrationUrl),
    whatsapp_url: clean(payload.whatsappUrl),
    meetups,
    discounts,
    status: payload.status,
  }

  const { error } = payload.id
    ? await admin.from("conferences").update(conferencePayload).eq("id", payload.id)
    : await admin.from("conferences").upsert(conferencePayload, { onConflict: "slug" })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/conferences")
  revalidatePath(`/dashboard/conferences/${slug}`)
  return { slug }
}

export async function deleteAdminConference(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const admin = createAdminClient()
  const { error } = await admin.from("conferences").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/conferences")
  return {}
}
