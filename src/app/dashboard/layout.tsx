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

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      <Sidebar
        firstName={profile?.first_name ?? null}
        lastName={profile?.last_name ?? null}
        email={user.email ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="flex flex-1 flex-col overflow-y-auto bg-zinc-50">
        {children}
      </div>
    </div>
  )
}
