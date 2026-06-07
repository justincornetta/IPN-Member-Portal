import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import CommunityClient from "./CommunityClient"

export type ConnectionProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  persona: string | null
  avatar_url: string | null
  email: string | null
  bio: string | null
  field: string | null
  linkedin_url: string | null
  discord_handle: string | null
}

export type ConnectionRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
  requester: ConnectionProfile
  addressee: ConnectionProfile
}

export default async function CommunityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: rows } = await supabase
    .from("connections")
    .select(`
      id, requester_id, addressee_id, status, created_at,
      requester:profiles!connections_requester_id_fkey(id, first_name, last_name, persona, avatar_url, email, bio, field, linkedin_url, discord_handle),
      addressee:profiles!connections_addressee_id_fkey(id, first_name, last_name, persona, avatar_url, email, bio, field, linkedin_url, discord_handle)
    `)
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  const connections = (rows ?? []) as unknown as ConnectionRow[]

  const accepted = connections.filter((c) => c.status === "accepted")
  const incoming = connections.filter(
    (c) => c.status === "pending" && c.addressee_id === user.id,
  )
  const outgoing = connections.filter(
    (c) => c.status === "pending" && c.requester_id === user.id,
  )

  return (
    <CommunityClient
      userId={user.id}
      accepted={accepted}
      incoming={incoming}
      outgoing={outgoing}
    />
  )
}
