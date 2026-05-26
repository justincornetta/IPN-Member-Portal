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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-medium text-ipn">Resources</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Member resources
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
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
