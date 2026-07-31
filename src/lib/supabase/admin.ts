import { createClient } from "@supabase/supabase-js"

declare const Netlify:
  | {
      env?: {
        get(name: string): string | undefined
      }
    }
  | undefined

function env(name: string) {
  if (typeof Netlify !== "undefined") {
    return Netlify.env?.get(name) ?? process.env[name]
  }
  return process.env[name]
}

export function createAdminClient() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables")
  }

  return createClient(
    url,
    serviceRoleKey,
  )
}
