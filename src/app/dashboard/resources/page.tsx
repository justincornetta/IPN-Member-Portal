import { redirect } from "next/navigation"
import ResourcesHub from "./ResourcesHub"
import { createClient } from "@/lib/supabase/server"
import type { ResourceRecord } from "@/lib/resources/types"

export default async function ResourcesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("status", "published")
    .in("resource_type", ["affiliate_benefit", "blog_post", "partner"])
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  const resources = (data ?? []) as ResourceRecord[]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-10">
      <div>
        <p className="hidden text-sm font-medium text-ipn sm:block">Resources</p>
        <h1 className="text-2xl font-semibold text-zinc-900 sm:mt-1">
          Resources
        </h1>
        <p className="mt-1 line-clamp-1 max-w-2xl text-sm leading-5 text-zinc-500 sm:mt-2 sm:line-clamp-none sm:leading-6">
          A member-only home for approved benefits, IPN writing, and partner
          organizations.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-red-900">
            Resources could not be loaded
          </h2>
          <p className="mt-1 text-sm leading-6 text-red-700">
            Check that the resources table has been created in Supabase and try
            again.
          </p>
        </div>
      ) : (
        <ResourcesHub resources={resources} />
      )}
    </div>
  )
}
