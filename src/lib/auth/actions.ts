"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { setMailchimpSubscription } from "@/lib/mailchimp/actions"
import { profileMailchimpFields } from "@/lib/mailchimp/status"

export type RegistrationData = {
  email: string
  password: string
  first_name: string
  last_name: string
  country: string
  state: string
  city: string
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

async function geocodeCity(
  city: string,
  country: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${city}, ${country}`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { "User-Agent": "IPN-Member-Portal (members.ipn.org)" } },
    )
    const results: { lat: string; lon: string }[] = await res.json()
    if (results[0]) return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
  } catch { /* non-fatal — registration proceeds without coordinates */ }
  return null
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
  const rawPath = next && next.startsWith("/") ? next : fallback

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

export async function signUp(
  data: RegistrationData,
  next?: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const siteUrl = getSiteUrl()
  const coords = await geocodeCity(data.city, data.country)
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
        city_lat: coords?.lat ?? null,
        city_lng: coords?.lng ?? null,
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
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect(next && next.startsWith("/") ? next : "/dashboard")
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
  persona: string
  affiliation: string | null
  school: string | null
  field: string
  psychedelic_field_status: string
  role_and_goals: string
  bio: string | null
  interest_tags: string[] | null
  linkedin_url: string | null
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

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("email, mailchimp_status")
    .single()

  if (error) return { error: error.message }

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
