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

  const result = await runContentSync()
  return NextResponse.json({ ok: true, result })
}
