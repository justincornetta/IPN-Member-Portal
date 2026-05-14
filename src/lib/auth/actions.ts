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

export async function signUp(
  data: RegistrationData,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

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
