"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

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

export async function signUp(
  data: RegistrationData,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const siteUrl = getSiteUrl()
  const coords = await geocodeCity(data.city, data.country)

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
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

  redirect("/dashboard")
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect("/dashboard")
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

  const { error } = await supabase
    .from("profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  if (error) return { error: error.message }
}

export async function disconnectDiscord(): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("profiles")
    .update({
      discord_user_id: null,
      discord_username: null,
      discord_global_name: null,
      discord_avatar_url: null,
      discord_connected_at: null,
      discord_server_status: null,
      discord_server_joined_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) return { error: error.message }
}
