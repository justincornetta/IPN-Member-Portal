"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type RegistrationData = {
  email: string
  password: string
  first_name: string
  last_name: string
  affiliation: string
  country: string
  state: string
  city: string
  persona: string
  field: string
  psychedelic_field_status: string
  psychedelic_field_barriers: string[]
  role_and_goals: string
  inspiration: string
  referral_source: string
}

function normalizeSiteUrl(url: string): string {
  const withProtocol = url.startsWith("http") ? url : `https://${url}`
  return withProtocol.replace(/\/$/, "")
}

function getSiteUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL
  const netlifyPreviewUrl = process.env.DEPLOY_PRIME_URL ?? process.env.URL
  const vercelPreviewUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : undefined
  const isPreview =
    process.env.CONTEXT === "deploy-preview" ||
    process.env.CONTEXT === "branch-deploy" ||
    process.env.VERCEL_ENV === "preview"

  const url = isPreview
    ? (netlifyPreviewUrl ?? vercelPreviewUrl ?? explicitUrl)
    : (explicitUrl ?? netlifyPreviewUrl ?? vercelPreviewUrl)

  return normalizeSiteUrl(url ?? "http://localhost:3000")
}

export async function signUp(
  data: RegistrationData,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const siteUrl = getSiteUrl()

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        affiliation: data.affiliation,
        country: data.country,
        state: data.state,
        city: data.city,
        persona: data.persona,
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

  redirect("/verify-email")
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

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
