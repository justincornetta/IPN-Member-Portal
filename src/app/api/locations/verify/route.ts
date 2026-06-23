import { NextResponse } from "next/server"
import { searchCityCandidates } from "@/lib/location/geocoding"

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 120) : ""
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const payload = body as { city?: unknown; state?: unknown; country?: unknown }
  const city = clean(payload.city)
  const state = clean(payload.state)
  const country = clean(payload.country)

  if (!city || !country) {
    return NextResponse.json(
      { error: "City and country are required", candidates: [] },
      { status: 400 },
    )
  }

  const candidates = await searchCityCandidates({ city, state, country })
  return NextResponse.json({ candidates })
}
