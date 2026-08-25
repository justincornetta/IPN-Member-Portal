"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyAdmin } from "@/lib/admin/actions"
import { clean, isValidTimeZone, slugify, toIsoInTimeZone } from "@/lib/admin/content-utils"
import { conferenceNotificationChanges } from "@/lib/conferences/notification-diff"
import {
  queueConferenceDiscountAnnouncement,
  queueConferenceMeetupAnnouncement,
  queueNewConferenceAnnouncement,
} from "@/lib/member-notifications/email-service"
import type {
  ConferenceCategory,
  ConferenceDiscount,
  ConferenceMeetup,
  ConferenceRecord,
  ConferenceStatus,
  PastConferenceRecord,
} from "@/lib/conferences/types"

export type AdminConferenceMeetupInput = {
  id?: string
  title: string
  startsAt: string
  endsAt?: string
  location?: string
  description?: string
  notificationMessage?: string
}

export type AdminConferenceDiscountInput = {
  id?: string
  label: string
  code?: string
  url?: string
  description?: string
  notificationMessage?: string
  howToApply?: string
  expiresAt?: string
}

export type AdminConferencePayload = {
  id?: string
  slug?: string
  name: string
  organizer?: string
  category: ConferenceCategory
  coverImageUrl?: string
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
  "id, slug, name, organizer, category, cover_image_url, summary, description, starts_at, ends_at, timezone, city, state, country, venue, website_url, registration_url, whatsapp_url, meetups, discounts, rsvp_count, status"

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

  const admin = createAdminClient()
  const slug = clean(payload.slug) ?? slugify(name)

  const { data: existingConference, error: existingConferenceError } = payload.id
    ? await admin
        .from("conferences")
        .select("id, status, meetups, discounts")
        .eq("id", payload.id)
        .maybeSingle()
    : await admin
        .from("conferences")
        .select("id, status, meetups, discounts")
        .eq("slug", slug)
        .maybeSingle()

  if (existingConferenceError) return { error: existingConferenceError.message }

  const meetupInputs = payload.meetups.filter((meetup) => clean(meetup.title))
  for (const meetup of meetupInputs) {
    const meetupTitle = clean(meetup.title)!
    const meetupStartsAt = toIsoInTimeZone(meetup.startsAt, timezone)
    const meetupEndsAt = toIsoInTimeZone(meetup.endsAt, timezone)
    if (!meetupStartsAt) return { error: `Start date and time are required for ${meetupTitle}` }
    if (!meetupEndsAt) return { error: `End date and time are required for ${meetupTitle}` }
    if (new Date(meetupEndsAt) <= new Date(meetupStartsAt)) {
      return { error: `End time must be after the start time for ${meetupTitle}` }
    }
  }

  const meetups: ConferenceMeetup[] = meetupInputs
    .map((meetup) => {
      const meetupStartsAt = toIsoInTimeZone(meetup.startsAt, timezone)!
      const meetupEndsAt = toIsoInTimeZone(meetup.endsAt, timezone)!
      return {
        id: meetup.id ?? `${slug}-meetup-${randomUUID()}`,
        title: clean(meetup.title)!,
        type: "IPN Meetup",
        startsAt: meetupStartsAt,
        endsAt: meetupEndsAt,
        location: clean(meetup.location),
        description: clean(meetup.description),
        notificationMessage: clean(meetup.notificationMessage),
      }
    })

  const discounts: ConferenceDiscount[] = payload.discounts
    .filter((discount) => clean(discount.label))
    .map((discount) => ({
      id: discount.id ?? `${slug}-discount-${randomUUID()}`,
      label: clean(discount.label)!,
      code: clean(discount.code),
      url: clean(discount.url),
      description: clean(discount.description),
      notificationMessage: clean(discount.notificationMessage),
      howToApply: clean(discount.howToApply),
      expiresAt: toIsoInTimeZone(discount.expiresAt, timezone),
    }))

  const conferencePayload = {
    slug,
    name,
    organizer: clean(payload.organizer),
    category: payload.category,
    cover_image_url: clean(payload.coverImageUrl),
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

  const { data: savedConference, error } = payload.id
    ? await admin
        .from("conferences")
        .update(conferencePayload)
        .eq("id", payload.id)
        .select("id")
        .single()
    : await admin
        .from("conferences")
        .upsert(conferencePayload, { onConflict: "slug" })
        .select("id")
        .single()

  if (error) return { error: error.message }

  const changes = conferenceNotificationChanges(
    existingConference
      ? {
          status: existingConference.status,
          meetups: (existingConference.meetups ?? []) as ConferenceMeetup[],
          discounts: (existingConference.discounts ?? []) as ConferenceDiscount[],
        }
      : null,
    { status: payload.status, meetups, discounts },
  )

  try {
    if (changes.announceConference) {
      const result = await queueNewConferenceAnnouncement(savedConference.id)
      console.log("[member-notification] queued new conference announcement", {
        conferenceId: savedConference.id,
        ...result,
      })
    } else {
      for (const meetup of changes.addedMeetups) {
        const result = await queueConferenceMeetupAnnouncement(
          savedConference.id,
          meetup.id,
        )
        console.log("[member-notification] queued conference meetup announcement", {
          conferenceId: savedConference.id,
          meetupId: meetup.id,
          ...result,
        })
      }

      for (const discount of changes.addedDiscounts) {
        const result = await queueConferenceDiscountAnnouncement(
          savedConference.id,
          discount.id,
        )
        console.log("[member-notification] queued conference discount announcement", {
          conferenceId: savedConference.id,
          discountId: discount.id,
          ...result,
        })
      }
    }
  } catch (notificationError) {
    console.warn(
      "[member-notification] could not queue conference announcement:",
      notificationError instanceof Error
        ? notificationError.message
        : String(notificationError),
    )
  }

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

export type AdminPastConferencePayload = {
  id?: string
  name: string
  organizer?: string
  category?: string
  coverImageUrl?: string
  startsAt?: string
  endsAt?: string
  city?: string
  state?: string
  country?: string
  summary?: string
  driveFolderUrl?: string
}

const PAST_CONFERENCE_ADMIN_SELECT =
  "id, name, organizer, category, cover_image_url, starts_at, ends_at, city, state, country, summary, drive_folder_url"

export async function listAdminPastConferences(): Promise<PastConferenceRecord[]> {
  const auth = await verifyAdmin()
  if ("error" in auth) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from("past_conferences")
    .select(PAST_CONFERENCE_ADMIN_SELECT)
    .order("starts_at", { ascending: false })
    .limit(200)

  return (data ?? []) as PastConferenceRecord[]
}

export async function publishAdminPastConference(
  payload: AdminPastConferencePayload,
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const name = clean(payload.name)
  if (!name) return { error: "Name is required" }

  const admin = createAdminClient()
  const pastConferencePayload = {
    name,
    organizer: clean(payload.organizer),
    category: clean(payload.category),
    cover_image_url: clean(payload.coverImageUrl),
    starts_at: clean(payload.startsAt),
    ends_at: clean(payload.endsAt),
    city: clean(payload.city),
    state: clean(payload.state),
    country: clean(payload.country),
    summary: clean(payload.summary),
    drive_folder_url: clean(payload.driveFolderUrl),
  }

  const { data, error } = payload.id
    ? await admin.from("past_conferences").update(pastConferencePayload).eq("id", payload.id).select("id").single()
    : await admin.from("past_conferences").insert(pastConferencePayload).select("id").single()

  if (error) return { error: error.message }

  revalidatePath("/dashboard/conferences")
  return { id: data?.id }
}

export async function deleteAdminPastConference(id: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const admin = createAdminClient()
  const { error } = await admin.from("past_conferences").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/conferences")
  return {}
}
