import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listPublishedConferences } from "@/lib/conferences/queries"
import ConferencesGrid from "./ConferencesGrid"

export default async function ConferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isAdmin = profile?.role === "superadmin" || profile?.role === "admin"
  if (!isAdmin) redirect("/dashboard")

  const conferences = await listPublishedConferences()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-10">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="hidden text-sm font-medium text-ipn sm:block">Conferences</p>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            Admin beta
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 sm:mt-1">Conferences</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 sm:mt-2">
          Upcoming external conferences with IPN meetups, member discounts, and RSVPs. This
          page is still in beta — visible to admins only while we finalize the design.
        </p>
      </div>

      <ConferencesGrid conferences={conferences} />
    </div>
  )
}
