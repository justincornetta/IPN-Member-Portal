"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isSafeRedirectPath } from "@/lib/auth/redirect"
import { setMailchimpSubscription } from "@/lib/mailchimp/actions"
import { profileMailchimpFields } from "@/lib/mailchimp/status"
import { sendMemberRegistrationSlackNotification } from "@/lib/slack/member-registration"
import { recordPortalAnalyticsEvent } from "@/lib/portal-analytics/events"
import type { PortalAnalyticsEventName } from "@/lib/portal-analytics/events"
import {
  syncProfileOnboardingCompletion,
} from "@/lib/onboarding/progress"
import { STUDENT_BACKGROUNDS } from "@/lib/constants/registration"
import {
  compactEducationEntries,
  educationLevelForPersona,
  validateEducationEntries,
  type MemberEducationInput,
} from "@/lib/members/education"

export type RegistrationData = {
  email: string
  password: string
  first_name: string
  last_name: string
  country: string
  state: string
  city: string
  city_lat: number | null
  city_lng: number | null
  persona: string
  affiliation: string | null
  school: string | null
  field: string
  psychedelic_field_status: string
  psychedelic_field_barriers: string[]
  role_and_goals: string
  inspiration: string
  support_needs: string
  referral_source: string
  referral_source_other: string | null
}

function normalizeWhatsAppUrl(value: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const allowedHosts = new Set([
      "wa.me",
      "www.wa.me",
      "api.whatsapp.com",
      "www.api.whatsapp.com",
      "chat.whatsapp.com",
      "www.chat.whatsapp.com",
    ])

    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) {
      return ""
    }

    return url.toString()
  } catch {
    return ""
  }
}

function normalizeSiteUrl(url: string): string {
  const withProtocol = url.startsWith("http") ? url : `https://${url}`
  return withProtocol.replace(/\/$/, "")
}

function getSiteUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL
  const netlifyPreviewUrl = process.env.DEPLOY_PRIME_URL ?? process.env.URL
  const isPreview =
    process.env.CONTEXT === "deploy-preview" ||
    process.env.CONTEXT === "branch-deploy"

  const url = isPreview
    ? (netlifyPreviewUrl ?? explicitUrl)
    : (explicitUrl ?? netlifyPreviewUrl)

  return normalizeSiteUrl(url ?? "http://localhost:3000")
}

function getPostRegistrationPath(next?: string): string {
  const fallback = "/dashboard"
  let rawPath = isSafeRedirectPath(next) ? next : fallback

  // External event pages (/events/slug) should land on the member portal event page
  if (rawPath.startsWith("/events/")) {
    rawPath = `/dashboard${rawPath}`
  }

  try {
    const url = new URL(rawPath, "http://localhost")
    if (url.pathname === "/dashboard") {
      url.searchParams.set("onboarding", "1")
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/dashboard?onboarding=1"
  }
}

function cleanCoordinate(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

type AnalyticsContext = {
  sessionId?: string
  anonymousId?: string
  pagePath?: string
  pageTitle?: string
  referrer?: string
}

async function recordAuthAnalyticsEvent(
  eventName: PortalAnalyticsEventName,
  analytics: AnalyticsContext | undefined,
  userId?: string | null,
  errorCode?: string,
) {
  if (!analytics?.sessionId) return
  await recordPortalAnalyticsEvent({
    eventName,
    sessionId: analytics.sessionId,
    anonymousId: analytics.anonymousId,
    pagePath: analytics.pagePath,
    pageTitle: analytics.pageTitle,
    referrer: analytics.referrer,
    userId,
    errorCode,
  })
}

export async function signUp(
  data: RegistrationData,
  next?: string,
  analytics?: AnalyticsContext,
): Promise<{ error: string } | void> {
  if (data.referral_source === "Other" && !data.referral_source_other?.trim()) {
    return { error: "Please tell us how you heard about IPN." }
  }
  if (STUDENT_BACKGROUNDS.has(data.persona) && !data.school?.trim()) {
    return { error: "Please select your school from the list." }
  }

  const supabase = await createClient()
  const siteUrl = getSiteUrl()
  const postRegistrationPath = getPostRegistrationPath(next)

  const { data: authData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(postRegistrationPath)}`,
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        country: data.country,
        state: data.state,
        city: data.city,
        city_lat: cleanCoordinate(data.city_lat),
        city_lng: cleanCoordinate(data.city_lng),
        persona: data.persona,
        affiliation: data.affiliation,
        school: data.school,
        field: data.field,
        psychedelic_field_status: data.psychedelic_field_status,
        psychedelic_field_barriers: data.psychedelic_field_barriers,
        role_and_goals: data.role_and_goals,
        inspiration: data.inspiration,
        support_needs: data.support_needs,
        referral_source: data.referral_source,
        referral_source_other: data.referral_source === "Other"
          ? data.referral_source_other?.trim() || null
          : null,
      },
    },
  })

  if (error) {
    await recordAuthAnalyticsEvent("registration_error", analytics, null, error.message)
    return { error: error.message }
  }

  // The trigger doesn't capture email — set it explicitly on the new profile row
  if (authData.user) {
    const { error: profileEmailError } = await supabase
      .from("profiles")
      .update({
        email: data.email,
        referral_source_other: data.referral_source === "Other"
          ? data.referral_source_other?.trim() || null
          : null,
      })
      .eq("id", authData.user.id)

    const admin = createAdminClient()
    const educationResult = STUDENT_BACKGROUNDS.has(data.persona) && data.school?.trim()
      ? await admin.from("member_education").insert({
          user_id: authData.user.id,
          institution: data.school.trim(),
          education_level: educationLevelForPersona(data.persona),
          degree_credential: null,
          area_of_study: null,
          status: "currently_enrolled",
          graduation_year: null,
          sort_order: 0,
        })
      : { error: null }
    const privateDataError = profileEmailError ?? educationResult.error
    if (privateDataError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      await recordAuthAnalyticsEvent("registration_error", analytics, null, privateDataError.message)
      return { error: "We could not save your registration details. Please try again." }
    }
  }

  // Mailchimp sync is tracked for admins, but never blocks registration.
  if (authData.user) {
    const mailchimpResult = await setMailchimpSubscription(data.email, true, {
      firstName: data.first_name,
      lastName: data.last_name,
    })
    await supabase
      .from("profiles")
      .update(profileMailchimpFields(mailchimpResult))
      .eq("id", authData.user.id)
  }

  if (authData.user) {
    // Slack delivery never blocks registration on failure already — run it
    // after the response is sent so a slow/unreachable webhook can't delay
    // the redirect either.
    after(() => sendMemberRegistrationSlackNotification(data))
    await recordAuthAnalyticsEvent("registration_success", analytics, authData.user.id)
  }

  redirect(postRegistrationPath)
}

export async function signIn(
  email: string,
  password: string,
  next?: string,
  analytics?: AnalyticsContext,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth
    .signInWithPassword({ email, password })
    .catch((signInError) => ({
      data: { user: null, session: null },
      error: signInError instanceof Error
        ? signInError
        : new Error("Could not reach the authentication server."),
    }))
  if (error) {
    await recordAuthAnalyticsEvent("sign_in_error", analytics, null, error.message)
    return { error: error.message }
  }
  let destination = isSafeRedirectPath(next) ? next : "/dashboard"
  if (destination.startsWith("/events/")) {
    destination = `/dashboard${destination}`
  }
  await recordAuthAnalyticsEvent("sign_in_success", analytics, authData.user?.id)
  redirect(destination)
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const siteUrl = getSiteUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })
  if (error) return { error: error.message }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export type ProfileUpdateData = {
  first_name: string
  last_name: string
  country: string
  state: string
  city: string
  city_lat: number | null
  city_lng: number | null
  persona: string
  affiliation: string | null
  school: string | null
  field: string
  psychedelic_field_status: string
  role_and_goals: string
  bio: string | null
  interest_tags: string[] | null
  linkedin_url: string | null
  whatsapp_url: string | null
  is_discoverable: boolean
  share_location: boolean
  avatar_url: string | null
  education: MemberEducationInput[]
}

export async function updateProfile(
  data: ProfileUpdateData,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const educationError = validateEducationEntries(data.education, {
    required: STUDENT_BACKGROUNDS.has(data.persona),
  })
  if (educationError) return { error: educationError }

  const whatsappUrl = normalizeWhatsAppUrl(data.whatsapp_url)
  if (whatsappUrl === "") {
    return { error: "Enter a valid WhatsApp link, such as https://wa.me/15551234567." }
  }

  const profileData = {
    first_name: data.first_name,
    last_name: data.last_name,
    country: data.country,
    state: data.state,
    city: data.city,
    persona: data.persona,
    affiliation: data.affiliation,
    school: compactEducationEntries(data.education)[0]?.institution ?? null,
    field: data.field,
    psychedelic_field_status: data.psychedelic_field_status,
    role_and_goals: data.role_and_goals,
    bio: data.bio,
    interest_tags: data.interest_tags,
    linkedin_url: data.linkedin_url,
    whatsapp_url: whatsappUrl,
    is_discoverable: data.is_discoverable,
    share_location: data.share_location,
    avatar_url: data.avatar_url,
  }
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("city, state, country, city_lat, city_lng")
    .eq("id", user.id)
    .maybeSingle()

  const nextCityLat = cleanCoordinate(data.city_lat)
  const nextCityLng = cleanCoordinate(data.city_lng)
  const locationChanged =
    currentProfile?.city !== data.city ||
    currentProfile?.state !== data.state ||
    currentProfile?.country !== data.country
  const coordinatesChanged =
    currentProfile?.city_lat !== nextCityLat ||
    currentProfile?.city_lng !== nextCityLng

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      ...profileData,
      ...(locationChanged || coordinatesChanged
        ? {
            city_lat: nextCityLat,
            city_lng: nextCityLng,
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("email, mailchimp_status")
    .single()

  if (error) return { error: error.message }

  const compactEducation = compactEducationEntries(data.education)
  const { data: currentEducation, error: educationReadError } = await supabase
    .from("member_education")
    .select("id")
    .eq("user_id", user.id)
  if (educationReadError) return { error: educationReadError.message }

  const existingIds = new Set((currentEducation ?? []).map((entry) => entry.id as string))
  const retainedIds: string[] = []
  for (let sortOrder = 0; sortOrder < compactEducation.length; sortOrder += 1) {
    const entry = compactEducation[sortOrder]
    if (entry.id && existingIds.has(entry.id)) {
      const { error: educationUpdateError } = await supabase
        .from("member_education")
        .update({
          institution: entry.institution,
          education_level: entry.education_level,
          degree_credential: entry.degree_credential,
          area_of_study: entry.area_of_study,
          status: entry.status,
          graduation_year: entry.graduation_year,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id)
        .eq("user_id", user.id)
      if (educationUpdateError) return { error: educationUpdateError.message }
      retainedIds.push(entry.id)
    } else {
      const { data: insertedEducation, error: educationInsertError } = await supabase
        .from("member_education")
        .insert({
          ...(entry.id ? { id: entry.id } : {}),
          user_id: user.id,
          institution: entry.institution,
          education_level: entry.education_level,
          degree_credential: entry.degree_credential,
          area_of_study: entry.area_of_study,
          status: entry.status,
          graduation_year: entry.graduation_year,
          sort_order: sortOrder,
        })
        .select("id")
        .single()
      if (educationInsertError) return { error: educationInsertError.message }
      retainedIds.push(insertedEducation.id as string)
    }
  }

  const removedIds = Array.from(existingIds).filter((id) => !retainedIds.includes(id))
  if (removedIds.length) {
    const { error: educationDeleteError } = await supabase
      .from("member_education")
      .delete()
      .eq("user_id", user.id)
      .in("id", removedIds)
    if (educationDeleteError) return { error: educationDeleteError.message }
  }

  try {
    await syncProfileOnboardingCompletion(supabase, user.id, {
      supportNeeds: typeof user.user_metadata?.support_needs === "string"
        ? user.user_metadata.support_needs
        : null,
      linkedInOptOut: user.user_metadata?.linkedin_opt_out === true,
      whatsAppOptOut: user.user_metadata?.whatsapp_opt_out === true,
    })
  } catch (completionError) {
    // The profile and education writes above are authoritative even if a newly
    // deployed onboarding table is temporarily unavailable. A later profile or
    // avatar update will retry synchronization without rolling back user data.
    console.error("[profile] onboarding completion sync failed:", completionError)
  }
  revalidatePath("/dashboard")

  if (updatedProfile?.mailchimp_status === "subscribed" && updatedProfile.email) {
    const mailchimpResult = await setMailchimpSubscription(
      updatedProfile.email,
      true,
      {
        firstName: data.first_name,
        lastName: data.last_name,
      },
    )
    await supabase
      .from("profiles")
      .update(profileMailchimpFields(mailchimpResult))
      .eq("id", user.id)
  }
}
