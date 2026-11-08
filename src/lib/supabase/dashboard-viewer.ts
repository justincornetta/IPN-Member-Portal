import { cache } from "react"
import { createClient } from "./server"

// React's cache lasts for one Server Component request only. Never persist a
// session, client, or private profile in a process-wide or Next.js data cache.
export const getDashboardViewer = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
})

export const getDashboardProfile = cache(async (userId: string) => {
  const { supabase } = await getDashboardViewer()
  return supabase.from("profiles")
    .select("first_name, last_name, role, is_banned, persona, affiliation, school, field, avatar_url, bio, interest_tags, role_and_goals, inspiration, linkedin_url, whatsapp_url")
    .eq("id", userId)
    .single()
})
