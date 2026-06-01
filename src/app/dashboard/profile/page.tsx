import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProfileForm from "./ProfileForm"

type Props = {
  searchParams?: Promise<{ discord?: string }>
}

export default async function ProfilePage({ searchParams }: Props) {
  const params = await searchParams
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
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Profile</h1>
      </div>
      <ProfileForm
        profile={profile}
        userId={user.id}
        discordStatus={params?.discord ?? null}
      />
    </div>
  )
}
