"use server"

import { createHash } from "crypto"

const LIST_ID = "e7bcf08ab8"

function mailchimpAuth() {
  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) throw new Error("MAILCHIMP_API_KEY not set")
  const dc = apiKey.split("-")[1]
  if (!dc) throw new Error("Invalid MAILCHIMP_API_KEY format — expected key-dc (e.g. abc123-us1)")
  return {
    baseUrl: `https://${dc}.api.mailchimp.com/3.1`,
    auth: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
  }
}

function subscriberHash(email: string) {
  return createHash("md5").update(email.toLowerCase()).digest("hex")
}

export async function setMailchimpSubscription(
  email: string,
  subscribed: boolean,
): Promise<{ error?: string }> {
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
      const data = (await res.json()) as { detail?: string }
      return { error: data.detail ?? "Mailchimp request failed" }
    }
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function getMailchimpStatus(
  email: string,
): Promise<"subscribed" | "unsubscribed" | "unknown"> {
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
