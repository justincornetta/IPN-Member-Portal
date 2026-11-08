"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ConnectionActionResult } from "./types"
import type { ConnectionEntry } from "../directory/types"
import { markOnboardingStepsComplete } from "@/lib/onboarding/progress"
import {
  notifyConnectionRequestAccepted,
  notifyConnectionRequestReceived,
} from "@/lib/member-notifications/email-service"

// Contact access stays on the authenticated, RLS-scoped client.
async function connectionResult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  otherUserId: string,
  entry: ConnectionEntry,
): Promise<ConnectionActionResult> {
  if (entry.status !== "accepted") return { entry, contact: null }
  const { data, error } = await supabase.from("member_contacts")
    .select("email, whatsapp_url").eq("user_id", otherUserId).maybeSingle()
  return {
    entry,
    contact: error ? null : data,
    ...(error ? { contactWarning: "Connected, but contact details could not load. Reopen this profile to try again." } : {}),
  }
}

export async function sendConnectionRequest(
  addresseeId: string,
): Promise<ConnectionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // If they already sent us a request, auto-accept instead
  const { data: reverse, error: reverseError } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_id", addresseeId)
    .eq("addressee_id", user.id)
    .maybeSingle()

  if (reverseError) return { error: "Could not check the connection. Please try again." }
  if (addresseeId === user.id) return { error: "You cannot connect with yourself." }

  if (reverse?.status === "pending") {
    return acceptConnection(addresseeId)
  }
  if (reverse?.status === "accepted") {
    return connectionResult(supabase, addresseeId, { status: "accepted", amRequester: false })
  }

  const { data: existing, error: existingError } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_id", user.id)
    .eq("addressee_id", addresseeId)
    .maybeSingle()

  if (existingError) return { error: "Could not check the connection. Please try again." }

  if (existing?.status === "pending" || existing?.status === "accepted") {
    return connectionResult(supabase, addresseeId, { status: existing.status, amRequester: true })
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
  return { entry: { status: "pending", amRequester: true }, contact: null }
}

export async function acceptConnection(
  requesterId: string,
): Promise<ConnectionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const updatedAt = new Date().toISOString()
  const { data: updatedConnection, error } = await supabase
    .from("connections")
    .update({ status: "accepted", updated_at: updatedAt })
    .eq("requester_id", requesterId)
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .select("id, requester_id, addressee_id, updated_at")
    .maybeSingle()

  if (error) return { error: error.message }

  // A duplicate/retried action may arrive after the first request committed.
  // Re-read the accepted row so the idempotent notification queue can recover
  // if the original request stopped after the database update.
  let connection = updatedConnection
  if (!connection) {
    const { data: existingConnection, error: existingError } = await supabase
      .from("connections")
      .select("id, requester_id, addressee_id, updated_at")
      .eq("requester_id", requesterId)
      .eq("addressee_id", user.id)
      .eq("status", "accepted")
      .maybeSingle()

    if (existingError) return { error: existingError.message }
    connection = existingConnection
  }

  if (!connection) return { error: "This request is no longer available. Please refresh and try again." }
  await notifyConnectionRequestAccepted({
    connectionId: connection.id,
    requesterUserId: connection.requester_id,
    acceptingUserId: connection.addressee_id,
    sourceVersion: connection.updated_at,
  })
  revalidatePath("/dashboard/directory")
  return connectionResult(supabase, requesterId, { status: "accepted", amRequester: false })
}

export async function declineConnection(
  requesterId: string,
): Promise<ConnectionActionResult> {
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
  return { entry: { status: "declined", amRequester: false }, contact: null }
}

export async function removeConnection(
  otherUserId: string,
): Promise<ConnectionActionResult> {
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
  return { entry: { status: "declined", amRequester: true }, contact: null }
}

/** Refresh a single profile's authorized connection/contact state, including later pages. */
export async function getConnectionDetails(otherUserId: string): Promise<ConnectionActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data, error } = await supabase.from("connections")
    .select("requester_id, addressee_id, status")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`)
  if (error) return { error: "Connection details could not load. Please try again." }
  const row = data?.find((item) => item.status === "accepted")
    ?? data?.find((item) => item.status === "pending")
  return connectionResult(supabase, otherUserId, {
    status: row?.status ?? "declined",
    amRequester: row ? row.requester_id === user.id : true,
  })
}
