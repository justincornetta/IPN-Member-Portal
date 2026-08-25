"use server"

import { createClient } from "@/lib/supabase/server"

export type ProfileCompletionDetails = {
  inspiration: string
  supportNeeds: string
  linkedinOptOut: boolean
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
      support_needs: details.supportNeeds.trim(),
    },
  })

  if (metadataError) return { error: metadataError.message }
}
