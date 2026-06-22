import { NextResponse } from "next/server"
import { runContentSync } from "@/lib/sync/content"

function isAuthorized(request: Request) {
  const secret = process.env.CONTENT_SYNC_SECRET
  const headerSecret = request.headers.get("x-content-sync-secret")
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  return Boolean(secret && (headerSecret === secret || bearer === secret))
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const TIMEOUT_MS = 9000
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Sync timed out after 9s")), TIMEOUT_MS),
  )

  try {
    const result = await Promise.race([runContentSync(), timeout])
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[sync-content] Unhandled error:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
