"use server"

import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"
import {
  canonicalMailchimpErrorDescription,
  normalizeMailchimpStatus,
  profileMailchimpFields,
  type MailchimpErrorRaw,
  type MailchimpStatus,
  type MailchimpSyncResult,
} from "./status"

const LIST_ID = "e7bcf08ab8"
const MAILCHIMP_TIMEOUT_MS = 8000
const PORTAL_REGISTRATION_TAG = "IPN Member Portal Registration"
const LEGACY_GOOGLE_FORM_TAG = "Google Form 2025"

type MailchimpTagUpdate = {
  name: string
  status: "active" | "inactive"
}

type MailchimpMemberFields = {
  firstName?: string | null
  lastName?: string | null
}

function mailchimpAuth() {
  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) throw new Error("MAILCHIMP_API_KEY not set")
  const dc = apiKey.split("-")[1]
  if (!dc) throw new Error("Invalid MAILCHIMP_API_KEY format — expected key-dc (e.g. abc123-us1)")
  return {
    baseUrl: `https://${dc}.api.mailchimp.com/3.0`,
    auth: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
  }
}

function subscriberHash(email: string) {
  return createHash("md5").update(email.toLowerCase()).digest("hex")
}

function cleanMergeFieldValue(value: string | null | undefined) {
  const cleaned = value?.trim()
  return cleaned ? cleaned : undefined
}

function mailchimpMergeFields(fields?: MailchimpMemberFields) {
  const firstName = cleanMergeFieldValue(fields?.firstName)
  const lastName = cleanMergeFieldValue(fields?.lastName)
  const mergeFields: Record<string, string> = {}

  if (firstName) mergeFields.FNAME = firstName
  if (lastName) mergeFields.LNAME = lastName

  return Object.keys(mergeFields).length > 0 ? mergeFields : undefined
}

async function readMailchimpError(res: Response): Promise<{
  raw: MailchimpErrorRaw
  description: string
}> {
  const raw: MailchimpErrorRaw = { status: res.status }
  const body = await res.text()
  try {
    const data = JSON.parse(body) as MailchimpErrorRaw
    raw.type = data.type
    raw.title = data.title
    raw.detail = data.detail
    raw.instance = data.instance
    raw.response = data
  } catch {
    raw.detail = body
  }
  return { raw, description: canonicalMailchimpErrorDescription(raw) }
}

async function recordCurrentUserMailchimpResult(result: MailchimpSyncResult) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from("profiles")
    .update(profileMailchimpFields(result))
    .eq("id", user.id)
}

async function updateMailchimpTags(
  email: string,
  tags: MailchimpTagUpdate[],
): Promise<MailchimpSyncResult | null> {
  const { baseUrl, auth } = mailchimpAuth()
  const res = await fetch(
    `${baseUrl}/lists/${LIST_ID}/members/${subscriberHash(email)}/tags`,
    {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(MAILCHIMP_TIMEOUT_MS),
      body: JSON.stringify({ tags }),
    },
  )

  if (res.ok) return null

  const { raw, description } = await readMailchimpError(res)
  return {
    status: "sync_failed",
    error: raw.detail ?? raw.title ?? "Mailchimp tag update failed",
    errorRaw: raw,
    errorDescription: description,
  }
}

export async function setMailchimpSubscription(
  email: string,
  subscribed: boolean,
  fields?: MailchimpMemberFields,
): Promise<MailchimpSyncResult> {
  try {
    const { baseUrl, auth } = mailchimpAuth()
    const mergeFields = mailchimpMergeFields(fields)
    const res = await fetch(
      `${baseUrl}/lists/${LIST_ID}/members/${subscriberHash(email)}`,
      {
        method: "PUT",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(MAILCHIMP_TIMEOUT_MS),
        body: JSON.stringify({
          email_address: email,
          status_if_new: subscribed ? "subscribed" : "unsubscribed",
          status: subscribed ? "subscribed" : "unsubscribed",
          ...(mergeFields ? { merge_fields: mergeFields } : {}),
        }),
      },
    )
    if (!res.ok) {
      const { raw, description } = await readMailchimpError(res)
      return {
        status: "sync_failed",
        error: raw.detail ?? raw.title ?? "Mailchimp request failed",
        errorRaw: raw,
        errorDescription: description,
      }
    }
    const data = (await res.json()) as { status?: string }

    if (subscribed) {
      const tagResult = await updateMailchimpTags(email, [
        { name: PORTAL_REGISTRATION_TAG, status: "active" },
        { name: LEGACY_GOOGLE_FORM_TAG, status: "inactive" },
      ])

      if (tagResult) return tagResult
    }

    return { status: normalizeMailchimpStatus(data.status) }
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error"
    const raw = {
      title: "Mailchimp Sync Exception",
      detail,
    }
    return {
      status: "sync_failed",
      error: detail,
      errorRaw: raw,
      errorDescription: detail.includes("MAILCHIMP_API_KEY")
        ? "Mailchimp is not configured correctly. Check MAILCHIMP_API_KEY in the deployment environment."
        : "The portal could not reach or complete the Mailchimp sync request.",
    }
  }
}

export async function setCurrentUserMailchimpSubscription(
  email: string,
  subscribed: boolean,
): Promise<MailchimpSyncResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()
    : { data: null }

  const result = await setMailchimpSubscription(email, subscribed, {
    firstName: profile?.first_name,
    lastName: profile?.last_name,
  })
  await recordCurrentUserMailchimpResult(result)
  return result
}

export async function getMailchimpStatus(
  email: string,
): Promise<MailchimpStatus> {
  try {
    const { baseUrl, auth } = mailchimpAuth()
    const res = await fetch(
      `${baseUrl}/lists/${LIST_ID}/members/${subscriberHash(email)}`,
      {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(MAILCHIMP_TIMEOUT_MS),
      },
    )
    if (!res.ok) return "unknown"
    const data = (await res.json()) as { status?: string }
    return normalizeMailchimpStatus(data.status)
  } catch {
    return "unknown"
  }
}

export async function lookupMailchimpSubscription(
  email: string,
): Promise<MailchimpSyncResult> {
  if (!email.trim()) return { status: "unknown" }

  try {
    const { baseUrl, auth } = mailchimpAuth()
    const res = await fetch(
      `${baseUrl}/lists/${LIST_ID}/members/${subscriberHash(email)}`,
      {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(MAILCHIMP_TIMEOUT_MS),
      },
    )

    if (res.status === 404) {
      return { status: "not_found" }
    }

    if (!res.ok) {
      const { raw, description } = await readMailchimpError(res)
      return {
        status: "sync_failed",
        error: raw.detail ?? raw.title ?? "Mailchimp lookup failed",
        errorRaw: raw,
        errorDescription: description,
      }
    }

    const data = (await res.json()) as { status?: string }
    return { status: normalizeMailchimpStatus(data.status) }
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error"
    const raw = {
      title: "Mailchimp Lookup Exception",
      detail,
    }
    return {
      status: "sync_failed",
      error: detail,
      errorRaw: raw,
      errorDescription: detail.includes("MAILCHIMP_API_KEY")
        ? "Mailchimp is not configured correctly. Check MAILCHIMP_API_KEY in the deployment environment."
        : "The portal could not complete the Mailchimp status lookup.",
    }
  }
}

export async function permanentlyDeleteMailchimpContact(
  email: string,
): Promise<{ deleted?: boolean; notFound?: boolean; error?: string }> {
  const trimmed = email.trim()
  if (!trimmed) return { notFound: true }

  try {
    const { baseUrl, auth } = mailchimpAuth()
    const res = await fetch(
      `${baseUrl}/lists/${LIST_ID}/members/${subscriberHash(trimmed)}/actions/delete-permanent`,
      {
        method: "POST",
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(MAILCHIMP_TIMEOUT_MS),
      },
    )

    if (res.status === 404) return { notFound: true }
    if (res.ok) return { deleted: true }

    const { description } = await readMailchimpError(res)
    return { error: description }
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error"
    return {
      error: detail.includes("MAILCHIMP_API_KEY")
        ? "Mailchimp is not configured correctly. Check MAILCHIMP_API_KEY in the deployment environment."
        : "The portal could not complete the Mailchimp permanent delete request.",
    }
  }
}
