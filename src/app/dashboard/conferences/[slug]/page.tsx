import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConferenceBySlug, getConferenceAttendeeState, getMeetupRsvpIds } from "@/lib/conferences/queries"
import { formatConferenceDateRange } from "@/lib/conferences/format"
import ConferenceInteractive from "@/components/conferences/ConferenceInteractive"
import CopyCodeButton from "@/components/conferences/CopyCodeButton"
import type { ConferenceAttendee } from "@/lib/conferences/types"
import type { ConnectionEntry } from "@/lib/directory/types"
import WhatsAppHandoffAction from "@/components/whatsapp/WhatsAppHandoffAction"

const PROFILE_SELECT =
  "role, id, first_name, last_name, avatar_url, school, affiliation, field, city, state, country, bio, interest_tags, linkedin_url, persona, admin_role, team"

type Props = {
  params: Promise<{ slug: string }>
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  Academic: "bg-[radial-gradient(circle_at_20%_20%,#a78bfa_0,#664fa1_30%,#18181b_75%)]",
  Industry: "bg-[radial-gradient(circle_at_20%_20%,#fbbf24_0,#b45309_30%,#18181b_75%)]",
  Community: "bg-[radial-gradient(circle_at_20%_20%,#5eead4_0,#0f766e_30%,#18181b_75%)]",
  "Harm Reduction": "bg-[radial-gradient(circle_at_20%_20%,#f9a8d4_0,#9d174d_30%,#18181b_75%)]",
}

function ExternalLinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6.75 6.75h3m-3 0A2.25 2.25 0 0 0 4.5 9v8.25a2.25 2.25 0 0 0 2.25 2.25H15a2.25 2.25 0 0 0 2.25-2.25v-3" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  )
}

export default async function ConferenceDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single()

  const conference = await getConferenceBySlug(slug)
  if (!conference) notFound()

  const [{ isGoing, isVisible, visibleAttendees }, meetupRsvpIds, { data: connRows }] = await Promise.all([
    getConferenceAttendeeState(conference.id, user.id),
    getMeetupRsvpIds(conference.id, user.id),
    supabase
      .from("connections")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
  ])

  const connectionMap: Record<string, ConnectionEntry> = {}
  const acceptedConnectionIds: string[] = []
  for (const row of connRows ?? []) {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id
    connectionMap[otherId] = {
      status: row.status as ConnectionEntry["status"],
      amRequester: row.requester_id === user.id,
    }
    if (row.status === "accepted") acceptedConnectionIds.push(otherId)
  }

  const { data: contacts } = acceptedConnectionIds.length > 0
    ? await supabase
      .from("member_contacts")
      .select("user_id, email, whatsapp_url")
      .in("user_id", acceptedConnectionIds)
    : { data: [] }

  const contactMap = new Map(
    (contacts ?? []).map((c) => [
      c.user_id as string,
      { email: (c.email as string | null) ?? null, whatsapp_url: (c.whatsapp_url as string | null) ?? null },
    ]),
  )

  const attendeesWithContact: ConferenceAttendee[] = visibleAttendees.map((attendee) => ({
    ...attendee,
    contact: contactMap.get(attendee.id) ?? null,
  }))

  const location = [conference.city, conference.state, conference.country].filter(Boolean).join(", ")
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
        <Link href="/dashboard/conferences" className="text-sm font-medium text-ipn hover:underline">
          Back to conferences
        </Link>
      </div>

      <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className={`relative h-40 sm:h-48 ${CATEGORY_GRADIENTS[conference.category] ?? CATEGORY_GRADIENTS.Community}`}>
          <span className="absolute left-4 top-4 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800">
            {conference.category}
          </span>
        </div>

        <div className="p-5 sm:p-7">
          <p className="text-sm font-medium text-ipn">
            {formatConferenceDateRange(conference.starts_at, conference.ends_at, conference.timezone)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-zinc-900">{conference.name}</h1>
          {location && <p className="mt-2 text-sm text-zinc-500">{location}</p>}
          {conference.venue && <p className="mt-1 text-sm text-zinc-400">{conference.venue}</p>}

          {conference.organizer && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
              <span>
                <span className="font-medium text-zinc-500">Organizer:</span> {conference.organizer}
              </span>
            </div>
          )}

          {conference.description && (
            <div className="mt-7 space-y-4 text-sm leading-7 text-zinc-600">
              {conference.description.split("\n").map((paragraph, index) => (
                <p key={`${index}-${paragraph}`}>{paragraph}</p>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {conference.website_url && (
              <a
                href={conference.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:text-ipn sm:min-h-0"
              >
                Conference website
                <ExternalLinkIcon />
              </a>
            )}
            <WhatsAppHandoffAction
              kind="permanent"
              slug="conferences"
              source="conference-detail"
              label="Join Conferences channel"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
            />
          </div>

          {conference.discounts.length > 0 && (
            <div className="mt-7 border-t border-zinc-100 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Member discounts
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                See these before you register — IPN member discounts and how to apply them.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {conference.discounts.map((discount, index) => (
                  <div
                    key={`${discount.label}-${index}`}
                    className="rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-ipn">
                          <TagIcon />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-zinc-900">{discount.label}</span>
                          {discount.description && (
                            <span className="mt-1 block text-xs leading-5 text-zinc-500">
                              {discount.description}
                            </span>
                          )}
                          {discount.howToApply && (
                            <span className="mt-1.5 block text-xs font-medium leading-5 text-ipn">
                              How to apply: {discount.howToApply}
                            </span>
                          )}
                          {discount.expiresAt && (
                            <span className="mt-1 block text-[11px] text-zinc-400">
                              Expires {new Date(discount.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        {discount.code && <CopyCodeButton code={discount.code} />}
                        {discount.url && (
                          <a
                            href={discount.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-ipn/30 hover:text-ipn sm:min-h-0"
                          >
                            Get discount
                            <ExternalLinkIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

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
