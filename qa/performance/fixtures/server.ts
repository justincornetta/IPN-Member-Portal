import { AuthSessionMissingError } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { makeClient, sampleData, previewUser } from "./data"
export async function createClient() {
  const jar = await cookies()
  const delay = Math.min(2000, Math.max(0, Number(jar.get("qa-delay")?.value) || 0))
  const data = sampleData()
  const mode = jar.get("qa-viewer")?.value
  const profile = data.profiles.find(row => row.id === previewUser.id)!
  if (mode === "banned") profile.is_banned = true
  if (mode === "second") { profile.id = "second-user"; profile.first_name = "Second" }
  const client = makeClient(data, { latencyMs: delay, failTable: jar.get("qa-fail")?.value, missingTable: jar.get("qa-missing")?.value })
  if (mode === "anonymous") client.auth.getUser = async () => ({ data: { user: null }, error: new AuthSessionMissingError() })
  if (mode === "second") client.auth.getUser = async () => ({ data: { user: { ...previewUser, id: "second-user", aud: "authenticated", app_metadata: {}, created_at: "2026-11-01T00:00:00Z" } }, error: null })
  return client
}
export function createAdminClient(): never { throw new Error("Privileged clients are disabled in the local performance preview") }
