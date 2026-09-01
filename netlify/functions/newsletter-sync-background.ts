import type { Config, Context } from "@netlify/functions"
import { syncLatestMailchimpNewsletter } from "../../src/lib/sync/mailchimp-newsletters"

function env(name: string) {
  return Netlify.env.get(name) ?? process.env[name]
}

function isAuthorized(request: Request) {
  const secret = env("CONTENT_SYNC_SECRET")
  const headerSecret = request.headers.get("x-content-sync-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

export default async function newsletterSyncBackground(
  request: Request,
  context: Context,
) {
  if (request.method !== "POST") {
    console.warn("[newsletter-sync] Rejected non-POST request", {
      method: request.method,
      requestId: context.requestId,
    })
    return
  }
  if (!isAuthorized(request)) {
    console.warn("[newsletter-sync] Rejected unauthorized request", {
      requestId: context.requestId,
    })
    return
  }

  const force = new URL(request.url).searchParams.get("force") === "true"
  try {
    const result = await syncLatestMailchimpNewsletter({ force })
    console.info("[newsletter-sync] Completed", {
      requestId: context.requestId,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[newsletter-sync] Failed", {
      requestId: context.requestId,
      error: message,
    })
    throw error
  }
}

export const config: Config = {
  background: true,
  path: "/api/background/sync-newsletters",
}
