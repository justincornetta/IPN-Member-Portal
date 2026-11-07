import { cookies } from "next/headers"
import { makeClient } from "./data"
export async function createClient() {
  const jar = await cookies()
  const delay = Math.min(2000, Math.max(0, Number(jar.get("qa-delay")?.value) || 0))
  return makeClient(undefined, { latencyMs: delay, failTable: jar.get("qa-fail")?.value, missingTable: jar.get("qa-missing")?.value })
}
export function createAdminClient(): never { throw new Error("Privileged clients are disabled in the local performance preview") }
