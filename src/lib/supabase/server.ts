/**
 * Supabase client for use in **Server Components**, Server Actions, and Route Handlers.
 *
 * Uses Next.js's async `cookies()` API (Next 15+) to read/write the auth session
 * cookie that Supabase uses for SSR. The session refresh happens via middleware
 * (set up later when we add auth flows).
 *
 * Usage in a Server Component:
 *   import { createClient } from "@/lib/supabase/server"
 *   const supabase = await createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // In Server Components, setAll throws — that's expected and safe to
          // swallow as long as middleware refreshes the session on each request.
          // See https://supabase.com/docs/guides/auth/server-side/nextjs
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — middleware handles refresh instead.
          }
        },
      },
    },
  )
}
