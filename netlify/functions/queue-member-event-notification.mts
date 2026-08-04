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

function isSecretAuthorized(request: Request) {
  const secret = env("CONTENT_SYNC_SECRET")
  const headerSecret = request.headers.get("x-content-sync-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

async function requestedEventSlug(request: Request) {
  try {
    const payload = (await request.json()) as { eventSlug?: unknown }
    return typeof payload.eventSlug === "string" && payload.eventSlug.trim()
      ? payload.eventSlug.trim()
      : null
  } catch {
    return null
  }
}

export default async function queueMemberEventNotification(request: Request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: {
        allow: "POST",
        "content-type": "application/json",
      },
    })
  }

  if (!isSecretAuthorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  if (memberNotificationMode() !== "test") {
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

  const eventSlug = await requestedEventSlug(request)
  if (!eventSlug) {
    return new Response(
      JSON.stringify({ ok: false, error: "eventSlug is required" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    )
  }

  try {
    const queued = await queueNewEventAnnouncementBySlug(eventSlug)
    const result = await processPendingMemberNotifications()
    console.log(
      "[queue-member-event-notification]",
      JSON.stringify({ queued, result }),
    )

    return new Response(JSON.stringify({ ok: true, queued, result }), {
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[queue-member-event-notification] failed:", message)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

export const config: Config = {
  method: "POST",
}
