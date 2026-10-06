import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LEADERSHIP_TEAMS } from "@/lib/admin/leadership"
import type { Kind } from "@/lib/leadership-workflows/domain"
import WorkflowWorkspace from "./WorkflowWorkspace"
export default async function WorkflowPage({ kind }: { kind: Kind }) {
  const client = await createClient()
  const {
    data: { user }
  } = await client.auth.getUser()
  if (!user) redirect("/login")
  const { data: p } = await client
    .from("profiles")
    .select("role,team,is_banned")
    .eq("id", user.id)
    .single()
  if (
    !p ||
    p.is_banned ||
    !(
      p.role === "superadmin" ||
      (p.role === "admin" &&
        (LEADERSHIP_TEAMS as readonly string[]).includes(p.team))
    )
  )
    redirect("/dashboard")
  return <WorkflowWorkspace kind={kind} />
}
