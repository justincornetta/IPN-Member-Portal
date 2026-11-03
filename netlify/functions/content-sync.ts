import type { Context } from "@netlify/functions"
import { runContentSync } from "../../src/lib/sync/content"

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
  const secret = env("CONTENT_SYNC_SECRET")
  const headerSecret = request.headers.get("x-content-sync-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

export default async function handler(request: Request, context: Context) {
  if (context.deploy.context === "deploy-preview") return new Response("Background actions are disabled in deploy previews", { status: 403 })

  if (!(await isScheduledInvocation(request)) && !isSecretAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const result = await runContentSync()

  const ok = !Object.values(result).some(value => "error" in value)
  return new Response(JSON.stringify({ ok, result }), {
    status: ok ? 200 : 502,
    headers: { "content-type": "application/json" },
  })
}

export const config = {
  schedule: "@hourly",
}
