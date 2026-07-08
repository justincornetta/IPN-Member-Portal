import { runPortalAnalyticsMaintenance } from "../../src/lib/portal-analytics/rollup"

declare const Netlify:
  | {
      env?: {
        get(name: string): string | undefined
      }
    }
  | undefined

function env(name: string) {
  if (typeof Netlify !== "undefined") return Netlify.env?.get(name) ?? process.env[name]
  return process.env[name]
}

function isSecretAuthorized(request: Request) {
  const secrets = [
    env("PORTAL_ANALYTICS_MAINTENANCE_SECRET"),
    env("CONTENT_SYNC_SECRET"),
  ].filter((secret): secret is string => Boolean(secret))
  const headerSecret = request.headers.get("x-portal-analytics-maintenance-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return secrets.some((secret) => headerSecret === secret || bearer === secret)
}

async function getTrigger(request: Request) {
  const headerTrigger = request.headers.get("x-portal-analytics-trigger")
  if (headerTrigger) return headerTrigger

  try {
    const payload = (await request.clone().json()) as { trigger?: unknown }
    if (typeof payload.trigger === "string" && payload.trigger.trim()) return payload.trigger.trim()
  } catch {
    // The request body is optional for manual invocations.
  }

  return "manual"
}

export default async function handler(request: Request) {
  if (!isSecretAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const result = await runPortalAnalyticsMaintenance({ trigger: await getTrigger(request) })

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "content-type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics refresh error"
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}
