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

async function isScheduledInvocation(request: Request) {
  try {
    const payload = (await request.clone().json()) as { next_run?: unknown }
    return typeof payload.next_run === "string"
  } catch {
    return false
  }
}

function isSecretAuthorized(request: Request) {
  const secret = env("PORTAL_ANALYTICS_MAINTENANCE_SECRET")
  const headerSecret = request.headers.get("x-portal-analytics-maintenance-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

export default async function handler(request: Request) {
  if (!(await isScheduledInvocation(request)) && !isSecretAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const result = await runPortalAnalyticsMaintenance()

  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "content-type": "application/json" },
  })
}

export const config = {
  schedule: "@daily",
}
