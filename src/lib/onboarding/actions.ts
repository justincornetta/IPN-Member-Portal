"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  advanceOnboardingFlow,
  isOnboardingStep,
  markOnboardingStepsComplete,
  type OnboardingFlow,
  type OnboardingStep,
} from "@/lib/onboarding/progress"

export async function completeOnboardingStep(step: OnboardingStep): Promise<void> {
  if (!isOnboardingStep(step)) return
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await markOnboardingStepsComplete(supabase, user.id, [step])
  revalidatePath("/dashboard")
}

export async function saveOnboardingFlowProgress(input: {
  flow: OnboardingFlow
  currentStep?: string | null
  complete?: boolean
}): Promise<{ error?: string; fallback?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  try {
    const persistedDurably = await advanceOnboardingFlow(supabase, user.id, input)
    revalidatePath("/dashboard")
    return persistedDurably ? {} : { fallback: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save onboarding progress"
    console.error("[onboarding] failed to advance flow:", message)
    return { error: message }
  }
}

function isMissingOnboardingColumn(error: { code?: string; message: string }) {
  const message = error.message.toLowerCase()
  return error.code === "42703"
    || error.code === "PGRST204"
    || message.includes("does not exist")
    || message.includes("schema cache")
}

export async function markGettingStartedSuccessSeen(): Promise<{
  error?: string
  fallback?: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  const now = new Date().toISOString()
  const { data: existing, error: readError } = await supabase
    .from("member_onboarding_progress")
    .select("getting_started_completed_at, getting_started_success_seen_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (readError) {
    if (
      isMissingOnboardingColumn(readError)
    ) {
      return { fallback: true }
    }
    console.error("[onboarding] failed to read Getting Started completion:", readError.message)
    return { error: "Could not save Getting Started completion" }
  }

  const { error } = await supabase
    .from("member_onboarding_progress")
    .upsert(
      {
        user_id: user.id,
        getting_started_completed_at: existing?.getting_started_completed_at ?? now,
        getting_started_success_seen_at: existing?.getting_started_success_seen_at ?? now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )

  if (error) {
    console.error("[onboarding] failed to retire Getting Started:", error.message)
    return { error: "Could not save Getting Started completion" }
  }

  revalidatePath("/dashboard")
  return {}
}
