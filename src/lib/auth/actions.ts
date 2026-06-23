"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { setMailchimpSubscription } from "@/lib/mailchimp/actions"
import { profileMailchimpFields } from "@/lib/mailchimp/status"
import {
  isProfileOnboardingComplete,
  markOnboardingStepsComplete,
  type OnboardingStep,
} from "@/lib/onboarding/progress"

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
  referral_source: string
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
  let rawPath = next && next.startsWith("/") ? next : fallback

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

export async function signUp(
  data: RegistrationData,
  next?: string,
): Promise<{ error: string } | void> {
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
        referral_source: data.referral_source,
      },
    },
  })

  if (error) return { error: error.message }

  // The trigger doesn't capture email — set it explicitly on the new profile row
  if (authData.user) {
    await supabase
      .from("profiles")
      .update({ email: data.email })
      .eq("id", authData.user.id)
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

  redirect(postRegistrationPath)
}

export async function signIn(
  email: string,
  password: string,
  next?: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.auth
    .signInWithPassword({ email, password })
    .catch((signInError) => ({
      error: signInError instanceof Error
        ? signInError
        : new Error("Could not reach the authentication server."),
    }))
  if (error) return { error: error.message }
  let destination = next && next.startsWith("/") ? next : "/dashboard"
  if (destination.startsWith("/events/")) {
    destination = `/dashboard${destination}`
  }
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
}

export async function updateProfile(
  data: ProfileUpdateData,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

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
    school: data.school,
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

  const completedSteps: OnboardingStep[] = []
  if (isProfileOnboardingComplete({
    avatar_url: data.avatar_url,
    bio: data.bio,
    interest_tags: data.interest_tags,
  })) {
    completedSteps.push("profile")
  }
  if (whatsappUrl) {
    completedSteps.push("whatsapp")
  }
  await markOnboardingStepsComplete(supabase, user.id, completedSteps)
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
