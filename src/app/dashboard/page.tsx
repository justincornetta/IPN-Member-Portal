import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { signOut } from "@/lib/auth/actions"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
            Intercollegiate Psychedelics Network
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
            Member Portal
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-zinc-500">
          <p className="text-sm">
            Directory, events, and resources are coming soon.
          </p>
        </div>

        <form action={signOut} className="mt-6 flex justify-end">
          <button
            type="submit"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
