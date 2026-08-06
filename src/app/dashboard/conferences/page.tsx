import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listPublishedConferences, listPastConferences } from "@/lib/conferences/queries"
import ConferencesGrid from "./ConferencesGrid"

export default async function ConferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [conferences, pastConferences] = await Promise.all([
    listPublishedConferences(),
    listPastConferences(),
  ])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-10">
      <div>
        <p className="hidden text-sm font-medium text-ipn sm:block">Conferences</p>
        <h1 className="text-2xl font-semibold text-zinc-900 sm:mt-1">Conferences</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 sm:mt-2">
          Upcoming external conferences with IPN meetups and member discounts. Click on each
          module to sign up for IPN-sponsored events, see who&apos;s attending, and connect
          with other members attending the event by joining our WhatsApp conference chat.
          Check out the previous conferences tab to find highlights and photos from prior
          conferences IPN has attended.
        </p>
      </div>

      <ConferencesGrid conferences={conferences} pastConferences={pastConferences} />
    </div>
  )
}
