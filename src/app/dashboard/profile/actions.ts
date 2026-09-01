"use server"

import { createClient } from "@/lib/supabase/server"
import { syncProfileOnboardingCompletion } from "@/lib/onboarding/progress"

export type ProfileCompletionDetails = {
  inspiration: string
  supportNeeds: string
  linkedinOptOut: boolean
  whatsappOptOut: boolean
}

export async function updateProfileCompletionDetails(
  details: ProfileCompletionDetails,
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      inspiration: details.inspiration.trim(),
    })
    .eq("id", user.id)

  if (profileError) return { error: profileError.message }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      linkedin_opt_out: details.linkedinOptOut,
      whatsapp_opt_out: details.whatsappOptOut,
      support_needs: details.supportNeeds.trim(),
    },
  })

  if (metadataError) return { error: metadataError.message }

  try {
    await syncProfileOnboardingCompletion(supabase, user.id, {
      supportNeeds: details.supportNeeds,
      linkedInOptOut: details.linkedinOptOut,
      whatsAppOptOut: details.whatsappOptOut,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update profile completion" }
  }
}

export async function refreshProfileOnboardingCompletion(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  try {
    await syncProfileOnboardingCompletion(supabase, user.id, {
      supportNeeds: typeof user.user_metadata?.support_needs === "string"
        ? user.user_metadata.support_needs
        : null,
      linkedInOptOut: user.user_metadata?.linkedin_opt_out === true,
      whatsAppOptOut: user.user_metadata?.whatsapp_opt_out === true,
    })
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update profile completion" }
  }
}
