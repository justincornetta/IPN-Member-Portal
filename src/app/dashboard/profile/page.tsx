import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProfileForm from "./ProfileForm"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold text-zinc-900">Profile</h1>
      <ProfileForm profile={profile} userId={user.id} />
    </div>
  )
}
