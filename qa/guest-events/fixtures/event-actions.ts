"use server"
import { cookies } from "next/headers"
export async function registerForEvent() {
  const jar = await cookies()
  if (jar.has("qa-retry")) { jar.delete("qa-retry"); return {error:"QA retry"} }
  jar.set("qa-registered", "1")
  return {}
}
