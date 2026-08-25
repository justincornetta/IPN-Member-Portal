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
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Not authenticated" }

  try {
    await advanceOnboardingFlow(supabase, user.id, input)
    revalidatePath("/dashboard")
    return {}
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save onboarding progress"
    console.error("[onboarding] failed to advance flow:", message)
    return { error: message }
  }
}
