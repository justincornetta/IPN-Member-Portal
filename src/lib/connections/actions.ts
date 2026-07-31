"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { markOnboardingStepsComplete } from "@/lib/onboarding/progress"
import {
  notifyConnectionRequestAccepted,
  notifyConnectionRequestReceived,
} from "@/lib/member-notifications/email-service"

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

  const { data: existing } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_id", user.id)
    .eq("addressee_id", addresseeId)
    .maybeSingle()

  if (existing?.status === "pending" || existing?.status === "accepted") {
    return {}
  }

  const updatedAt = new Date().toISOString()
  const { data: connection, error } = await supabase
    .from("connections")
    .upsert(
      { requester_id: user.id, addressee_id: addresseeId, status: "pending", updated_at: updatedAt },
      { onConflict: "requester_id,addressee_id" },
    )
    .select("id, requester_id, addressee_id, updated_at")
    .single()

  if (error || !connection) return { error: error?.message ?? "Could not send connection request" }
  await markOnboardingStepsComplete(supabase, user.id, ["connection_request"])
  await notifyConnectionRequestReceived({
    connectionId: connection.id,
    requesterUserId: connection.requester_id,
    addresseeUserId: connection.addressee_id,
    sourceVersion: connection.updated_at,
  })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/directory")
  return {}
}

export async function acceptConnection(
  requesterId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const updatedAt = new Date().toISOString()
  const { data: connection, error } = await supabase
    .from("connections")
    .update({ status: "accepted", updated_at: updatedAt })
    .eq("requester_id", requesterId)
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .select("id, requester_id, addressee_id, updated_at")
    .maybeSingle()

  if (error) return { error: error.message }
  if (!connection) return {}
  await notifyConnectionRequestAccepted({
    connectionId: connection.id,
    requesterUserId: connection.requester_id,
    acceptingUserId: connection.addressee_id,
    sourceVersion: connection.updated_at,
  })
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
  revalidatePath("/dashboard/directory")
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
  revalidatePath("/dashboard/directory")
  return {}
}
