import type { Config } from "@netlify/functions"
import {
  memberNotificationMode,
  processPendingMemberNotifications,
  queueNewEventAnnouncementBySlug,
} from "../../src/lib/member-notifications/email-service"

declare const Netlify:
  | {
      env?: {
        get(name: string): string | undefined
      }
    }
  | undefined

function env(name: string) {
  if (typeof Netlify !== "undefined") {
    return Netlify.env?.get(name) ?? process.env[name]
  }
  return process.env[name]
}

async function isScheduledInvocation(request: Request) {
  try {
    const payload = (await request.clone().json()) as { next_run?: unknown }
    return typeof payload.next_run === "string"
  } catch {
    return false
  }
}

function isSecretAuthorized(request: Request) {
  const secret = env("CONTENT_SYNC_SECRET")
  const headerSecret = request.headers.get("x-content-sync-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

async function requestedEventSlug(request: Request) {
  try {
    const payload = (await request.clone().json()) as { eventSlug?: unknown }
    return typeof payload.eventSlug === "string" && payload.eventSlug.trim()
      ? payload.eventSlug.trim()
      : null
  } catch {
    return null
  }
}

export default async function sendMemberNotifications(request: Request) {
  const scheduled = await isScheduledInvocation(request)
  if (!scheduled && !isSecretAuthorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const eventSlug = scheduled ? null : await requestedEventSlug(request)
    if (eventSlug && memberNotificationMode() !== "test") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Manual event announcement queuing is available only in test mode",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      )
    }

    const queued = eventSlug
      ? await queueNewEventAnnouncementBySlug(eventSlug)
      : null
    const result = await processPendingMemberNotifications()
    console.log(
      "[send-member-notifications]",
      JSON.stringify({ queued, result }),
    )

    return new Response(JSON.stringify({ ok: true, queued, result }), {
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[send-member-notifications] failed:", message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const config: Config = {
  schedule: "*/5 * * * *",
}
