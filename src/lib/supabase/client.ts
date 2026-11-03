/**
 * Supabase client for use in **Client Components** (anything with `"use client"`).
 *
 * Reads the anon public key, which is safe to expose to the browser because
 * Row-Level Security policies in the database control what data it can access.
 *
 * Usage:
 *   import { createClient } from "@/lib/supabase/client"
 *   const supabase = createClient()
 *   const { data } = await supabase.from("events").select("*")
 */

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
