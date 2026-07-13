"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import AttendeeAvatar from "./AttendeeAvatar"
import AttendeeProfileModal from "./AttendeeProfileModal"
import { rsvpToConference, cancelConferenceRsvp, updateConferenceRsvpVisibility } from "@/lib/conferences/actions"
import type { ConferenceAttendee } from "@/lib/conferences/types"
import type { ConnectionEntry } from "@/lib/directory/types"

type Props = {
  conferenceId: string
  conferenceSlug: string
  currentUserId: string
  currentMemberName: string
  currentMemberAvatarUrl: string | null
  initialIsGoing: boolean
  initialIsVisible: boolean
  initialAttendees: ConferenceAttendee[]
  totalCount: number
  connectionMap: Record<string, ConnectionEntry>
}

const STACK_LIMIT = 6

export default function RsvpPanel({
  conferenceId,
  conferenceSlug,
  currentUserId,
  currentMemberName,
  currentMemberAvatarUrl,
  initialIsGoing,
  initialIsVisible,
  initialAttendees,
  totalCount,
  connectionMap: initialConnectionMap,
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
    return [
      { id: currentUserId, name: currentMemberName, avatarUrl: currentMemberAvatarUrl, school: null, persona: null },
      ...initialAttendees,
    ]
  }, [initialAttendees, isGoing, currentUserId, currentMemberName, currentMemberAvatarUrl])

  const selectedAttendee = attendees.find((attendee) => attendee.id === selectedAttendeeId) ?? null
  const stacked = attendees.slice(0, STACK_LIMIT)
  const overflow = Math.max(totalCount - stacked.length, 0)

  function toggleRsvp() {
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

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            RSVP
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Let other IPN members know you&apos;ll be at this conference.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleRsvp}
          disabled={pending}
          className={`min-h-11 flex-shrink-0 rounded-lg px-5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 ${
            isGoing
              ? "border border-zinc-200 bg-white text-zinc-600 hover:border-red-200 hover:text-red-600"
              : "bg-ipn text-white hover:bg-ipn-dark"
          }`}
        >
          {isGoing ? "I'm going ✓ — cancel" : "I'm going"}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {isGoing && (
        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3.5 py-3">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(event) => toggleVisibility(event.target.checked)}
            disabled={pending}
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

      <div className="mt-5 border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={() => setShowList((current) => !current)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left sm:min-h-0"
        >
          <span className="flex items-center gap-3">
            <span className="flex -space-x-2">
              {stacked.map((attendee) => (
                <AttendeeAvatar
                  key={attendee.id}
                  name={attendee.name}
                  avatarUrl={attendee.avatarUrl}
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
                  <AttendeeAvatar name={attendee.name} avatarUrl={attendee.avatarUrl} size="xs" />
                  <span className="text-sm text-zinc-700">
                    {attendee.name}
                    {attendee.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-zinc-400">(You)</span>
                    )}
                  </span>
                  {attendee.school && (
                    <span className="text-xs text-zinc-400">{attendee.school}</span>
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
        <AttendeeProfileModal
          attendee={selectedAttendee}
          connectionEntry={connMap[selectedAttendee.id]}
          isSelf={selectedAttendee.id === currentUserId}
          onConnectionChange={(entry) => updateConnectionMap(selectedAttendee.id, entry)}
          onClose={() => setSelectedAttendeeId(null)}
        />
      )}
    </div>
  )
}
