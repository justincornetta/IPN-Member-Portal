import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConferenceBySlug, getConferenceAttendeeState } from "@/lib/conferences/queries"
import { formatConferenceDateRange, formatMeetupDateTime } from "@/lib/conferences/format"
import RsvpPanel from "@/components/conferences/RsvpPanel"
import CopyCodeButton from "@/components/conferences/CopyCodeButton"
import type { ConnectionEntry } from "@/lib/directory/types"

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

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A9.8 9.8 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.27-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.9-7.01ZM12.04 20.15h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.54 3.69-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.16 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
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
    .select("role, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single()

  const isAdmin = profile?.role === "superadmin" || profile?.role === "admin"
  if (!isAdmin) redirect("/dashboard")

  const conference = await getConferenceBySlug(slug)
  if (!conference) notFound()

  const [{ isGoing, isVisible, visibleAttendees }, { data: connRows }] = await Promise.all([
    getConferenceAttendeeState(conference.id, user.id),
    supabase
      .from("connections")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
  ])

  const connectionMap: Record<string, ConnectionEntry> = {}
  for (const row of connRows ?? []) {
    const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id
    connectionMap[otherId] = {
      status: row.status as ConnectionEntry["status"],
      amRequester: row.requester_id === user.id,
    }
  }

  const location = [conference.city, conference.state, conference.country].filter(Boolean).join(", ")
  const currentMemberName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ""}`.trim()
    : (user.email ?? "You")

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/conferences" className="text-sm font-medium text-ipn hover:underline">
          Back to conferences
        </Link>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Admin beta
        </span>
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

          <div className="mt-6 flex flex-wrap gap-2">
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
            {conference.registration_url && (
              <a
                href={conference.registration_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
              >
                Register
                <ExternalLinkIcon />
              </a>
            )}
          </div>

          {conference.description && (
            <div className="mt-7 space-y-4 text-sm leading-7 text-zinc-600">
              {conference.description.split("\n").map((paragraph, index) => (
                <p key={`${index}-${paragraph}`}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      </article>

      {conference.meetups.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            IPN events &amp; meetups
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
            IPN-organized gatherings happening on-site during this conference.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {conference.meetups.map((meetup, index) => (
              <div
                key={`${meetup.title}-${index}`}
                className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
                      {meetup.type}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {formatMeetupDateTime(meetup.startsAt, conference.timezone)}
                    </span>
                  </div>
                  {meetup.registrationUrl && (
                    <a
                      href={meetup.registrationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-md border border-ipn/20 bg-white px-2.5 py-1.5 text-xs font-medium text-ipn transition hover:bg-ipn/5 sm:min-h-0"
                    >
                      Register
                      <ExternalLinkIcon />
                    </a>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-zinc-900">{meetup.title}</h3>
                {meetup.location && <p className="mt-1 text-xs text-zinc-500">{meetup.location}</p>}
                {meetup.description && (
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{meetup.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <WhatsAppIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-900">Conference chat</span>
            <span className="mt-1 block text-sm leading-6 text-zinc-500">
              {conference.whatsapp_url
                ? "Connect with other IPN members attending this conference — coordinate meetups, share housing, or just say hi before you arrive."
                : "A dedicated WhatsApp chat for this conference hasn't been set up yet."}
            </span>
          </span>
        </div>
        <div className="mt-4">
          {conference.whatsapp_url ? (
            <a
              href={conference.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Join conference chat
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400"
            >
              Chat coming soon
            </button>
          )}
        </div>
      </section>

      {conference.discounts.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Member discounts
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {conference.discounts.map((discount, index) => (
              <div
                key={`${discount.label}-${index}`}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ipn-light text-ipn">
                    <TagIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900">{discount.label}</span>
                    {discount.description && (
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">
                        {discount.description}
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
            ))}
          </div>
        </section>
      )}

      <RsvpPanel
        conferenceId={conference.id}
        conferenceSlug={conference.slug}
        currentUserId={user.id}
        currentMemberName={currentMemberName}
        currentMemberAvatarUrl={profile?.avatar_url ?? null}
        initialIsGoing={isGoing}
        initialIsVisible={isVisible}
        initialAttendees={visibleAttendees}
        totalCount={conference.rsvp_count}
        connectionMap={connectionMap}
      />
    </div>
  )
}
