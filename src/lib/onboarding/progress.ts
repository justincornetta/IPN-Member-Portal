import type { SupabaseClient } from "@supabase/supabase-js"

export type OnboardingStep =
  | "profile"
  | "whatsapp"
  | "connection_request"
  | "invite"
  | "event_rsvp"

export type OnboardingProgress = {
  profile_completed_at: string | null
  whatsapp_completed_at: string | null
  connection_request_completed_at: string | null
  invite_completed_at: string | null
  event_rsvp_completed_at: string | null
}

type ProfileCompletionFields = {
  avatar_url: string | null
  bio: string | null
  interest_tags: string[] | null
}

const STEP_COLUMNS: Record<OnboardingStep, keyof OnboardingProgress> = {
  profile: "profile_completed_at",
  whatsapp: "whatsapp_completed_at",
  connection_request: "connection_request_completed_at",
  invite: "invite_completed_at",
  event_rsvp: "event_rsvp_completed_at",
}

export function isProfileOnboardingComplete(profile: ProfileCompletionFields): boolean {
  return Boolean(
    profile.avatar_url &&
      profile.bio?.trim() &&
      profile.interest_tags &&
      profile.interest_tags.length > 0,
  )
}

export async function markOnboardingStepsComplete(
  supabase: SupabaseClient,
  userId: string,
  steps: OnboardingStep[],
) {
  const uniqueSteps = [...new Set(steps)]
  if (uniqueSteps.length === 0) return

  const columns = uniqueSteps.map((step) => STEP_COLUMNS[step])
  const { data: existing } = await supabase
    .from("member_onboarding_progress")
    .select(["user_id", ...columns].join(", "))
    .eq("user_id", userId)
    .maybeSingle()
  const existingProgress = existing as Partial<OnboardingProgress> | null

  const now = new Date().toISOString()
  const updates: Record<string, string> = {}

  for (const column of columns) {
    if (!existingProgress || !existingProgress[column]) {
      updates[column] = now
    }
  }

  if (Object.keys(updates).length === 0) return

  if (existingProgress) {
    await supabase
      .from("member_onboarding_progress")
      .update({ ...updates, updated_at: now })
      .eq("user_id", userId)
    return
  }

  await supabase
    .from("member_onboarding_progress")
    .insert({ user_id: userId, ...updates })
}
