import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import ConferenceDetailOverview from "@/components/conferences/ConferenceDetailOverview"
import ConferenceInteractive from "@/components/conferences/ConferenceInteractive"
import { getConferenceAttendeeState, getConferenceBySlug, getMeetupRsvpIds } from "@/lib/conferences/queries"
import type { ConferenceAttendee } from "@/lib/conferences/types"
import type { ConnectionEntry } from "@/lib/directory/types"
import { createClient } from "@/lib/supabase/server"

const PROFILE_SELECT =
  "role, id, first_name, last_name, avatar_url, school, affiliation, field, city, state, country, bio, interest_tags, linkedin_url, persona, admin_role, team"

type Props = { params: Promise<{ slug: string }> }

export default async function ConferenceDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", user.id).single()
  const conference = await getConferenceBySlug(slug)
  if (!conference) notFound()

  const [{ isGoing, isVisible, visibleAttendees }, meetupRsvpIds, { data: connRows }] = await Promise.all([
    getConferenceAttendeeState(conference.id, user.id),
    getMeetupRsvpIds(conference.id, user.id),
    supabase.from("connections").select("requester_id, addressee_id, status").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
  ])

  const connectionMap: Record<string, ConnectionEntry> = {}
  const acceptedConnectionIds: string[] = []
  for (const row of connRows ?? []) {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id
    connectionMap[otherId] = { status: row.status as ConnectionEntry["status"], amRequester: row.requester_id === user.id }
    if (row.status === "accepted") acceptedConnectionIds.push(otherId)
  }

  const { data: contacts } = acceptedConnectionIds.length > 0
    ? await supabase.from("member_contacts").select("user_id, email, whatsapp_url").in("user_id", acceptedConnectionIds)
    : { data: [] }
  const contactMap = new Map((contacts ?? []).map((contact) => [
    contact.user_id as string,
    { email: (contact.email as string | null) ?? null, whatsapp_url: (contact.whatsapp_url as string | null) ?? null },
  ]))
  const attendeesWithContact: ConferenceAttendee[] = visibleAttendees.map((attendee) => ({
    ...attendee,
    contact: contactMap.get(attendee.id) ?? null,
  }))

  const currentMemberProfile: ConferenceAttendee = {
    id: user.id,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    school: profile?.school ?? null,
    affiliation: profile?.affiliation ?? null,
    field: profile?.field ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    country: profile?.country ?? null,
    bio: profile?.bio ?? null,
    interest_tags: profile?.interest_tags ?? null,
    linkedin_url: profile?.linkedin_url ?? null,
    persona: profile?.persona ?? null,
    admin_role: profile?.admin_role ?? null,
    team: profile?.team ?? null,
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/conferences" className="text-sm font-medium text-ipn hover:underline">Back to conferences</Link>
      </div>
      <ConferenceDetailOverview conference={conference} />
      <ConferenceInteractive
        conferenceId={conference.id}
        conferenceSlug={conference.slug}
        currentUserId={user.id}
        currentMemberProfile={currentMemberProfile}
        initialIsGoing={isGoing}
        initialIsVisible={isVisible}
        initialAttendees={attendeesWithContact}
        totalCount={conference.rsvp_count}
        connectionMap={connectionMap}
        meetups={conference.meetups}
        timezone={conference.timezone}
        initialMeetupRsvpIds={[...meetupRsvpIds]}
      />
    </div>
  )
}
