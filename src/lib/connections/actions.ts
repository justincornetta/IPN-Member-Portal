"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { markOnboardingStepsComplete } from "@/lib/onboarding/progress"

export async function sendConnectionRequest(
  addresseeId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // If they already sent us a request, auto-accept instead
  const { data: reverse } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_id", addresseeId)
    .eq("addressee_id", user.id)
    .maybeSingle()

  if (reverse?.status === "pending") {
    return acceptConnection(addresseeId)
  }
  if (reverse?.status === "accepted") {
    return {}
  }

  const { error } = await supabase
    .from("connections")
    .upsert(
      { requester_id: user.id, addressee_id: addresseeId, status: "pending", updated_at: new Date().toISOString() },
      { onConflict: "requester_id,addressee_id" },
    )

  if (error) return { error: error.message }
  await markOnboardingStepsComplete(supabase, user.id, ["connection_request"])
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/community")
  revalidatePath("/dashboard/directory")
  return {}
}

export async function acceptConnection(
  requesterId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("connections")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("requester_id", requesterId)
    .eq("addressee_id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/community")
  revalidatePath("/dashboard/directory")
  return {}
}

export async function declineConnection(
  requesterId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("connections")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("requester_id", requesterId)
    .eq("addressee_id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/community")
  return {}
}

export async function removeConnection(
  otherUserId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("connections")
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`,
    )

  if (error) return { error: error.message }
  revalidatePath("/dashboard/community")
  revalidatePath("/dashboard/directory")
  return {}
}
