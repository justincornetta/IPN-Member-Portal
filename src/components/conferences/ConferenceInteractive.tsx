"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import AttendeeAvatar from "./AttendeeAvatar"
import MemberProfileModal from "@/components/directory/MemberProfileModal"
import {
  rsvpToConference,
  cancelConferenceRsvp,
  updateConferenceRsvpVisibility,
  rsvpToMeetup,
  cancelMeetupRsvp,
} from "@/lib/conferences/actions"
import { formatMeetupDateTime } from "@/lib/conferences/format"
import type { ConferenceAttendee, ConferenceMeetup } from "@/lib/conferences/types"
import type { ConnectionEntry } from "@/lib/directory/types"

type Props = {
  conferenceId: string
  conferenceSlug: string
  currentUserId: string
  currentMemberProfile: ConferenceAttendee
  initialIsGoing: boolean
  initialIsVisible: boolean
  initialAttendees: ConferenceAttendee[]
  totalCount: number
  connectionMap: Record<string, ConnectionEntry>
  meetups: ConferenceMeetup[]
  timezone: string
  initialMeetupRsvpIds: string[]
  preview?: boolean
  compact?: boolean
}

const STACK_LIMIT = 6

function attendeeName(attendee: ConferenceAttendee) {
  return `${attendee.first_name ?? ""} ${attendee.last_name ?? ""}`.trim() || "IPN member"
}

export default function ConferenceInteractive({
  conferenceId,
  conferenceSlug,
  currentUserId,
  currentMemberProfile,
  initialIsGoing,
  initialIsVisible,
  initialAttendees,
  totalCount,
  connectionMap: initialConnectionMap,
  meetups,
  timezone,
  initialMeetupRsvpIds,
  preview = false,
  compact = false,
}: Props) {
  const router = useRouter()
  const [isGoing, setIsGoing] = useState(initialIsGoing)
  const [isVisible, setIsVisible] = useState(initialIsVisible)
  const [showList, setShowList] = useState(false)
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [connectionState, setConnectionState] = useState(() => ({
    source: initialConnectionMap,
    value: initialConnectionMap,
  }))

  const [meetupGoing, setMeetupGoing] = useState<Set<string>>(() => new Set(initialMeetupRsvpIds))
  const [meetupPendingId, setMeetupPendingId] = useState<string | null>(null)
  const [meetupError, setMeetupError] = useState<string | null>(null)
  const [, startMeetupTransition] = useTransition()

  const connMap = connectionState.source === initialConnectionMap
    ? connectionState.value
    : initialConnectionMap

  const updateConnectionMap = useCallback((memberId: string, entry: ConnectionEntry) => {
    setConnectionState((current) => {
      const base = current.source === initialConnectionMap ? current.value : initialConnectionMap
      return { source: initialConnectionMap, value: { ...base, [memberId]: entry } }
    })
  }, [initialConnectionMap])

  // The current member always sees themself in the "who's going" list once RSVP'd,
  // even if is_visible is false (nobody else will see them, but their own view should be honest).
  const attendees = useMemo(() => {
    if (!isGoing) return initialAttendees.filter((attendee) => attendee.id !== currentUserId)
    if (initialAttendees.some((attendee) => attendee.id === currentUserId)) return initialAttendees
    return [currentMemberProfile, ...initialAttendees]
  }, [initialAttendees, isGoing, currentUserId, currentMemberProfile])

  const selectedAttendee = attendees.find((attendee) => attendee.id === selectedAttendeeId) ?? null
  const stacked = attendees.slice(0, STACK_LIMIT)
  const overflow = Math.max(totalCount - stacked.length, 0)

  function toggleRsvp() {
    if (preview) return
    setError(null)
    const goingNext = !isGoing
    setIsGoing(goingNext)
    startTransition(async () => {
      const result = goingNext
        ? await rsvpToConference(conferenceId, conferenceSlug, isVisible)
        : await cancelConferenceRsvp(conferenceId, conferenceSlug)
      if (result.error) {
        setIsGoing(!goingNext)
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function toggleVisibility(nextVisible: boolean) {
    if (preview) return
    setError(null)
    setIsVisible(nextVisible)
    startTransition(async () => {
      const result = await updateConferenceRsvpVisibility(conferenceId, conferenceSlug, nextVisible)
      if (result.error) {
        setIsVisible(!nextVisible)
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function toggleMeetupRsvp(meetupId: string) {
    if (preview) return
    setMeetupError(null)
    const goingNext = !meetupGoing.has(meetupId)
    setMeetupGoing((current) => {
      const next = new Set(current)
      if (goingNext) next.add(meetupId)
      else next.delete(meetupId)
      return next
    })
    setMeetupPendingId(meetupId)
    startMeetupTransition(async () => {
      const result = goingNext
        ? await rsvpToMeetup(conferenceId, meetupId, conferenceSlug)
        : await cancelMeetupRsvp(conferenceId, meetupId, conferenceSlug)
      setMeetupPendingId(null)
      if (result.error) {
        setMeetupGoing((current) => {
          const next = new Set(current)
          if (goingNext) next.delete(meetupId)
          else next.add(meetupId)
          return next
        })
        setMeetupError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`rounded-lg border-2 p-5 shadow-sm ${isGoing ? "border-emerald-200 bg-emerald-50/40" : "border-ipn/30 bg-ipn/5"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-zinc-900">
              {isGoing ? "You're going ✓" : "Are you going?"}
            </p>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isGoing
                ? "Other IPN members can see you're attending."
                : "Let other IPN members know you'll be there."}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleRsvp}
            disabled={preview || pending}
            className={`inline-flex min-h-11 flex-shrink-0 items-center rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${preview ? "" : "disabled:opacity-60"} ${compact ? "" : "sm:min-h-0"} ${
              isGoing
                ? "border border-zinc-200 bg-white text-zinc-600 hover:border-red-200 hover:text-red-600"
                : "bg-ipn text-white hover:bg-ipn-dark"
            }`}
          >
            {isGoing ? "Cancel RSVP" : "RSVP — I'm going"}
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        {isGoing && (
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-3">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(event) => toggleVisibility(event.target.checked)}
              disabled={preview || pending}
              className="mt-0.5 h-4 w-4 cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-zinc-700">
              Show me in the attendee list below
              <span className="mt-0.5 block text-xs text-zinc-400">
                You&apos;ll always count toward the RSVP total either way — this only controls whether other members see your name.
              </span>
            </span>
          </label>
        )}
      </div>

      {meetups.length > 0 && (
        <section className={`rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${compact ? "" : "sm:p-7"}`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            IPN events &amp; meetups
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
            IPN-organized gatherings happening on-site during this conference.
          </p>
          {meetupError && <p className="mt-2 text-xs text-red-600">{meetupError}</p>}
          <div className="mt-4 flex flex-col gap-3">
            {meetups.map((meetup) => {
              const going = meetupGoing.has(meetup.id)
              return (
                <div
                  key={meetup.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
                        {meetup.type}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatMeetupDateTime(meetup.startsAt, timezone)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMeetupRsvp(meetup.id)}
                      disabled={preview || meetupPendingId === meetup.id}
                      className={`inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${preview ? "" : "disabled:opacity-60"} ${compact ? "" : "sm:min-h-0"} ${
                        going
                          ? "border-zinc-200 bg-white text-zinc-600 hover:border-red-200 hover:text-red-600"
                          : "border-ipn/20 bg-white text-ipn hover:bg-ipn/5"
                      }`}
                    >
                      {going ? "Going ✓" : "RSVP"}
                    </button>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-900">{meetup.title}</h3>
                  {meetup.location && <p className="mt-1 text-xs text-zinc-500">{meetup.location}</p>}
                  {meetup.description && (
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{meetup.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Who&apos;s going
        </h2>
        <button
          type="button"
          onClick={() => { if (!preview) setShowList((current) => !current) }}
          disabled={preview}
          className={`mt-3 flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed ${compact ? "" : "sm:min-h-0"}`}
        >
          <span className="flex items-center gap-3">
            <span className="flex -space-x-2">
              {stacked.map((attendee) => (
                <AttendeeAvatar
                  key={attendee.id}
                  name={attendeeName(attendee)}
                  avatarUrl={attendee.avatar_url}
                  size="sm"
                  ringed
                />
              ))}
              {overflow > 0 && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 ring-2 ring-white">
                  +{overflow}
                </span>
              )}
            </span>
            <span className="text-sm font-medium text-zinc-700">
              {totalCount === 0
                ? "No one has RSVP'd yet"
                : `${totalCount} member${totalCount === 1 ? "" : "s"} going`}
            </span>
          </span>
          {totalCount > 0 && (
            <span className="text-xs font-medium text-ipn">
              {showList ? "Hide list" : "Show who's going"}
            </span>
          )}
        </button>

        {showList && attendees.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {attendees.map((attendee) => (
              <li key={attendee.id}>
                <button
                  type="button"
                  onClick={() => setSelectedAttendeeId(attendee.id)}
                  className="flex w-full items-center gap-3 rounded-md border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-left transition hover:border-ipn/20 hover:bg-ipn/5"
                >
                  <AttendeeAvatar name={attendeeName(attendee)} avatarUrl={attendee.avatar_url} size="xs" />
                  <span className="text-sm text-zinc-700">
                    {attendeeName(attendee)}
                    {attendee.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-zinc-400">(You)</span>
                    )}
                  </span>
                  {(attendee.school ?? attendee.affiliation) && (
                    <span className="text-xs text-zinc-400">{attendee.school ?? attendee.affiliation}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showList && attendees.length < totalCount && (
          <p className="mt-2 text-xs text-zinc-400">
            {totalCount - attendees.length} more {totalCount - attendees.length === 1 ? "member has" : "members have"} RSVP&apos;d without showing their name.
          </p>
        )}
      </div>

      {selectedAttendee && (
        <MemberProfileModal
          member={selectedAttendee}
          connectionEntry={connMap[selectedAttendee.id]}
          isSelf={selectedAttendee.id === currentUserId}
          onConnectionChange={(entry) => updateConnectionMap(selectedAttendee.id, entry)}
          onClose={() => setSelectedAttendeeId(null)}
        />
      )}
    </div>
  )
}

const PREVIEW_MEMBER: ConferenceAttendee = {
  id: "preview-member",
  first_name: "IPN",
  last_name: "Member",
  avatar_url: null,
  school: null,
  affiliation: null,
  field: null,
  city: null,
  state: null,
  country: null,
  bio: null,
  interest_tags: null,
  linkedin_url: null,
  persona: null,
  admin_role: null,
  team: null,
}

export function ConferenceInteractivePreview({
  meetups,
  timezone,
  compact = false,
}: {
  meetups: ConferenceMeetup[]
  timezone: string
  compact?: boolean
}) {
  return (
    <ConferenceInteractive
      conferenceId="preview"
      conferenceSlug="conference-preview"
      currentUserId={PREVIEW_MEMBER.id}
      currentMemberProfile={PREVIEW_MEMBER}
      initialIsGoing={false}
      initialIsVisible={true}
      initialAttendees={[]}
      totalCount={0}
      connectionMap={{}}
      meetups={meetups}
      timezone={timezone}
      initialMeetupRsvpIds={[]}
      preview
      compact={compact}
    />
  )
}
