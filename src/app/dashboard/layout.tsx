import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import Sidebar from "@/components/Sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [profileResult, pendingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", user.id)
      .eq("status", "pending"),
  ])

  const profile = profileResult.data
  const pendingRequestCount = pendingResult.count ?? 0
  const isAdmin = profile?.role === "superadmin"

  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      <Sidebar
        firstName={profile?.first_name ?? null}
        lastName={profile?.last_name ?? null}
        email={user.email ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        pendingRequestCount={pendingRequestCount}
        isAdmin={isAdmin}
      />
      <div className="flex flex-1 flex-col overflow-y-auto bg-zinc-50">
        {children}
      </div>
    </div>
  )
}
