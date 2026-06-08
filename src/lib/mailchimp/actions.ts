"use server"

import { createHash } from "crypto"
import { createClient } from "@/lib/supabase/server"
import {
  canonicalMailchimpErrorDescription,
  profileMailchimpFields,
  type MailchimpErrorRaw,
  type MailchimpStatus,
  type MailchimpSyncResult,
} from "./status"

const LIST_ID = "e7bcf08ab8"

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

export async function setMailchimpSubscription(
  email: string,
  subscribed: boolean,
): Promise<MailchimpSyncResult> {
  try {
    const { baseUrl, auth } = mailchimpAuth()
    const res = await fetch(
      `${baseUrl}/lists/${LIST_ID}/members/${subscriberHash(email)}`,
      {
        method: "PUT",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: email,
          status_if_new: subscribed ? "subscribed" : "unsubscribed",
          status: subscribed ? "subscribed" : "unsubscribed",
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
    return { status: subscribed ? "subscribed" : "unsubscribed" }
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
  const result = await setMailchimpSubscription(email, subscribed)
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
      { headers: { Authorization: auth } },
    )
    if (!res.ok) return "unknown"
    const data = (await res.json()) as { status?: string }
    if (data.status === "subscribed") return "subscribed"
    if (data.status === "unsubscribed") return "unsubscribed"
    return "unknown"
  } catch {
    return "unknown"
  }
}
