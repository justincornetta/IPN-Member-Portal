import { NextResponse } from "next/server"
import { syncLatestMailchimpNewsletter } from "@/lib/sync/mailchimp-newsletters"

function isAuthorized(request: Request) {
  const secret = process.env.CONTENT_SYNC_SECRET
  const headerSecret = request.headers.get("x-content-sync-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

async function handle(request: Request, defaultDryRun: boolean) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const dryRun = defaultDryRun ||
    (params.has("dryRun")
      ? params.get("dryRun") !== "false" && params.get("dryRun") !== "0"
      : false)
  const force = params.get("force") === "true" || params.get("force") === "1"

  try {
    const result = await syncLatestMailchimpNewsletter({ dryRun, force })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[sync-newsletters] Unhandled error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request, true)
}

export async function POST(request: Request) {
  return handle(request, false)
}
