import { DataReadError } from "@/lib/data-read-error"
import PageLoadError from "@/components/navigation/PageLoadError"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { loadDirectory } from "@/lib/directory/load"
import DirectoryClient from "./DirectoryClient"

export default async function DirectoryPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const data = await loadDirectory(supabase, user.id, await searchParams).catch(error => {
    if (error instanceof DataReadError) return null
    throw error
  })
  if (!data) return <PageLoadError title="Member Directory" />
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-10">
      <DirectoryClient {...data} />
    </div>
  )
}
