"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MagnifyingGlassPlusIcon, XMarkIcon } from "@heroicons/react/24/outline"
import AttendeeAvatar from "./AttendeeAvatar"
import MemberProfileModal from "@/components/directory/MemberProfileModal"
import {
  cancelConferenceRsvp,
  cancelMeetupRsvp,
  rsvpToConference,
  rsvpToMeetup,
  updateConferenceRsvpVisibility,
  updateMeetupRsvpVisibility,
} from "@/lib/conferences/actions"
import { formatMeetupDateTime } from "@/lib/conferences/format"
import type {
  ConferenceAttendee,
  ConferenceMeetup,
  ConferenceMeetupAttendanceState,
} from "@/lib/conferences/types"
import type { ConnectionEntry } from "@/lib/directory/types"

type MeetupAttendanceMap = Record<string, ConferenceMeetupAttendanceState>

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
  initialMeetupAttendance: MeetupAttendanceMap
  preview?: boolean
  compact?: boolean
}

const STACK_LIMIT = 6

type ImagePreview = {
  src: string
  alt: string
}

function ImageLightbox({ image, onClose }: { image: ImagePreview; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
      if (event.key === "Tab") {
        event.preventDefault()
        closeButtonRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Event image preview"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/85 p-4 sm:p-8"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="relative flex max-h-full max-w-6xl items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-[calc(100vh-4rem)] max-w-full rounded-lg object-contain shadow-2xl sm:max-h-[calc(100vh-6rem)]"
        />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950/75 text-white transition hover:bg-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:-right-4 sm:-top-4"
        >
          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function attendeeName(attendee: ConferenceAttendee) {
  return `${attendee.first_name ?? ""} ${attendee.last_name ?? ""}`.trim() || "IPN member"
}

function withCurrentMember(
  attendees: ConferenceAttendee[],
  currentMember: ConferenceAttendee,
  shouldInclude: boolean,
) {
  const withoutCurrent = attendees.filter((attendee) => attendee.id !== currentMember.id)
  return shouldInclude ? [currentMember, ...withoutCurrent] : withoutCurrent
}

function AttendeeStack({ attendees, totalCount }: { attendees: ConferenceAttendee[]; totalCount: number }) {
  const stacked = attendees.slice(0, STACK_LIMIT)
  const overflow = Math.max(totalCount - stacked.length, 0)

  return (
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ipn text-[10px] font-semibold text-white ring-2 ring-white">
          +{overflow}
        </span>
      )}
    </span>
  )
}

function AttendeeList({
  attendees,
  totalCount,
  currentUserId,
  onSelect,
}: {
  attendees: ConferenceAttendee[]
  totalCount: number
  currentUserId: string
  onSelect: (id: string) => void
}) {
  const hiddenCount = Math.max(totalCount - attendees.length, 0)

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      {attendees.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {attendees.map((attendee) => (
            <li key={attendee.id}>
              <button
                type="button"
                onClick={() => onSelect(attendee.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-left transition hover:border-ipn/20 hover:bg-ipn/5"
              >
                <AttendeeAvatar name={attendeeName(attendee)} avatarUrl={attendee.avatar_url} size="xs" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-zinc-700">
                    {attendeeName(attendee)}
                    {attendee.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-zinc-400">(You)</span>
                    )}
                  </span>
                  {(attendee.school ?? attendee.affiliation) && (
                    <span className="block truncate text-xs text-zinc-400">
                      {attendee.school ?? attendee.affiliation}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No visible attendees yet.</p>
      )}
      {hiddenCount > 0 && (
        <p className="mt-3 text-xs text-zinc-400">
          {hiddenCount} {hiddenCount === 1 ? "member is" : "members are"} included in the total but hidden from this list.
        </p>
      )}
    </div>
  )
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
  initialMeetupAttendance,
  preview = false,
  compact = false,
}: Props) {
  const router = useRouter()
  const [isGoing, setIsGoing] = useState(initialIsGoing)
  const [isVisible, setIsVisible] = useState(initialIsVisible)
  const [openListId, setOpenListId] = useState<string | null>(null)
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null)
  const [selectedMeetupImage, setSelectedMeetupImage] = useState<ImagePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [meetupPendingId, setMeetupPendingId] = useState<string | null>(null)
  const [meetupError, setMeetupError] = useState<string | null>(null)
  const [, startMeetupTransition] = useTransition()
  const [connectionState, setConnectionState] = useState(() => ({
    source: initialConnectionMap,
    value: initialConnectionMap,
  }))
  const [meetupState, setMeetupState] = useState(() => ({
    source: initialMeetupAttendance,
    value: initialMeetupAttendance,
  }))

  const connMap = connectionState.source === initialConnectionMap
    ? connectionState.value
    : initialConnectionMap
  const meetupAttendance = meetupState.source === initialMeetupAttendance
    ? meetupState.value
    : initialMeetupAttendance

  const updateConnectionMap = useCallback((memberId: string, entry: ConnectionEntry) => {
    setConnectionState((current) => {
      const base = current.source === initialConnectionMap ? current.value : initialConnectionMap
      return { source: initialConnectionMap, value: { ...base, [memberId]: entry } }
    })
  }, [initialConnectionMap])

  const updateMeetupState = useCallback((
    meetupId: string,
    updater: (current: ConferenceMeetupAttendanceState) => ConferenceMeetupAttendanceState,
  ) => {
    setMeetupState((current) => {
      const base = current.source === initialMeetupAttendance ? current.value : initialMeetupAttendance
      const existing = base[meetupId] ?? {
        isGoing: false,
        isVisible: true,
        totalCount: 0,
        visibleAttendees: [],
      }
      return {
        source: initialMeetupAttendance,
        value: { ...base, [meetupId]: updater(existing) },
      }
    })
  }, [initialMeetupAttendance])

  const conferenceAttendees = useMemo(() => withCurrentMember(
    initialAttendees,
    currentMemberProfile,
    isGoing && isVisible,
  ), [initialAttendees, currentMemberProfile, isGoing, isVisible])
  const conferenceTotal = Math.max(totalCount + Number(isGoing) - Number(initialIsGoing), 0)
  const conferenceHidden = Math.max(conferenceTotal - conferenceAttendees.length, 0)

  const attendeePool = useMemo(() => {
    const all = [
      ...conferenceAttendees,
      ...Object.values(meetupAttendance).flatMap((state) => state.visibleAttendees),
    ]
    return new Map(all.map((attendee) => [attendee.id, attendee]))
  }, [conferenceAttendees, meetupAttendance])
  const selectedAttendee = selectedAttendeeId ? attendeePool.get(selectedAttendeeId) ?? null : null
  const closeMeetupImagePreview = useCallback(() => setSelectedMeetupImage(null), [])

  function toggleConferenceRsvp() {
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

  function toggleConferenceVisibility(nextVisible: boolean) {
    if (preview) return
    setError(null)
    setIsVisible(nextVisible)
    if (!isGoing) return

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
    const previous = meetupAttendance[meetupId] ?? {
      isGoing: false,
      isVisible: true,
      totalCount: 0,
      visibleAttendees: [],
    }
    const goingNext = !previous.isGoing

    updateMeetupState(meetupId, (current) => ({
      ...current,
      isGoing: goingNext,
      totalCount: Math.max(current.totalCount + (goingNext ? 1 : -1), 0),
      visibleAttendees: withCurrentMember(
        current.visibleAttendees,
        currentMemberProfile,
        goingNext && current.isVisible,
      ),
    }))
    setMeetupPendingId(meetupId)
    startMeetupTransition(async () => {
      const result = goingNext
        ? await rsvpToMeetup(conferenceId, meetupId, conferenceSlug, previous.isVisible)
        : await cancelMeetupRsvp(conferenceId, meetupId, conferenceSlug)
      setMeetupPendingId(null)
      if (result.error) {
        updateMeetupState(meetupId, () => previous)
        setMeetupError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  function toggleMeetupVisibility(meetupId: string, nextVisible: boolean) {
    if (preview) return
    setMeetupError(null)
    const previous = meetupAttendance[meetupId] ?? {
      isGoing: false,
      isVisible: true,
      totalCount: 0,
      visibleAttendees: [],
    }

    updateMeetupState(meetupId, (current) => ({
      ...current,
      isVisible: nextVisible,
      visibleAttendees: withCurrentMember(
        current.visibleAttendees,
        currentMemberProfile,
        current.isGoing && nextVisible,
      ),
    }))
    if (!previous.isGoing) return

    setMeetupPendingId(meetupId)
    startMeetupTransition(async () => {
      const result = await updateMeetupRsvpVisibility(
        conferenceId,
        meetupId,
        conferenceSlug,
        nextVisible,
      )
      setMeetupPendingId(null)
      if (result.error) {
        updateMeetupState(meetupId, () => previous)
        setMeetupError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="-mt-6 rounded-b-lg border border-t-0 border-zinc-200 bg-white px-5 pb-5 shadow-sm sm:px-7 sm:pb-7">
        <div className="border-t border-zinc-100 pt-5">
          <h2 className="text-sm font-semibold text-zinc-900">IPN members attending this conference</h2>
          <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <AttendeeStack attendees={conferenceAttendees} totalCount={conferenceTotal} />
              <p className="text-xs text-zinc-500">
                {conferenceTotal} attending · {conferenceAttendees.length} visible · {conferenceHidden} hidden
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(event) => toggleConferenceVisibility(event.target.checked)}
                  disabled={preview || pending}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#664fa1]"
                />
                <span className="text-xs font-medium text-zinc-700">
                  Show me in the conference attendee list
                  <span className="mt-0.5 block text-[11px] font-normal text-zinc-400">
                    Hidden members still count toward the total.
                  </span>
                </span>
              </label>

              {isGoing ? (
                <>
                  <span className="inline-flex min-h-11 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:min-h-0">
                    You&apos;re attending ✓
                  </span>
                  <button
                    type="button"
                    onClick={toggleConferenceRsvp}
                    disabled={preview || pending}
                    className="inline-flex min-h-11 items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60 sm:min-h-0"
                  >
                    Cancel RSVP
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={toggleConferenceRsvp}
                  disabled={preview || pending}
                  className="inline-flex min-h-11 items-center rounded-lg bg-ipn px-4 py-2 text-xs font-semibold text-white transition hover:bg-ipn-dark disabled:opacity-60 sm:min-h-0"
                >
                  RSVP to conference
                </button>
              )}

              {conferenceTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenListId((current) => current === "conference" ? null : "conference")}
                  disabled={preview}
                  className="min-h-11 text-xs font-medium text-ipn hover:underline sm:min-h-0"
                >
                  {openListId === "conference" ? "Hide attendees" : "View all attendees"}
                </button>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          {openListId === "conference" && (
            <AttendeeList
              attendees={conferenceAttendees}
              totalCount={conferenceTotal}
              currentUserId={currentUserId}
              onSelect={setSelectedAttendeeId}
            />
          )}
        </div>
      </section>

      {meetups.length > 0 && (
        <section id="ipn-meetups" className={`scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${compact ? "" : "sm:p-7"}`}>
          {meetupError && <p className="mb-3 text-xs text-red-600">{meetupError}</p>}
          <div className="flex flex-col gap-6">
            {meetups.map((meetup, index) => {
              const attendance = meetupAttendance[meetup.id] ?? {
                isGoing: false,
                isVisible: true,
                totalCount: 0,
                visibleAttendees: [],
              }
              const hiddenCount = Math.max(attendance.totalCount - attendance.visibleAttendees.length, 0)
              const listId = `meetup:${meetup.id}`
              const isPending = meetupPendingId === meetup.id

              return (
                <article key={meetup.id} className={index > 0 ? "border-t border-zinc-100 pt-6" : ""}>
                  <div className={`grid gap-5 ${compact ? "" : "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start"}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedMeetupImage({
                        src: meetup.imageUrl || "/events/horizons-community-meetup.png",
                        alt: `${meetup.title} cover`,
                      })}
                      aria-label={`Enlarge ${meetup.title} image`}
                      className="group relative aspect-video overflow-hidden rounded-lg bg-ipn-light text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={meetup.imageUrl || "/events/horizons-community-meetup.png"}
                        alt={`${meetup.title} cover`}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-zinc-950/75 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                        <MagnifyingGlassPlusIcon className="h-4 w-4" aria-hidden="true" />
                        View larger
                      </span>
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                        IPN events &amp; meetups
                      </h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-ipn-light px-2 py-1 text-[11px] font-medium text-ipn">
                          Community
                        </span>
                        <span className="text-xs text-zinc-400">
                          {formatMeetupDateTime(meetup.startsAt, timezone, meetup.endsAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-zinc-900">{meetup.title}</h3>
                      {meetup.location && <p className="mt-1 text-sm text-zinc-500">{meetup.location}</p>}
                      {meetup.description && (
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">{meetup.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-zinc-100 pt-5">
                    <h3 className="text-sm font-semibold text-zinc-900">IPN members going to this meetup</h3>
                    <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <AttendeeStack attendees={attendance.visibleAttendees} totalCount={attendance.totalCount} />
                        <p className="text-xs text-zinc-500">
                          {attendance.totalCount} going · {attendance.visibleAttendees.length} visible · {hiddenCount} hidden
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            checked={attendance.isVisible}
                            onChange={(event) => toggleMeetupVisibility(meetup.id, event.target.checked)}
                            disabled={preview || isPending}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#664fa1]"
                          />
                          <span className="text-xs font-medium text-zinc-700">
                            Show me in the meetup attendee list
                            <span className="mt-0.5 block text-[11px] font-normal text-zinc-400">
                              Hidden members still count toward the total.
                            </span>
                          </span>
                        </label>

                        {attendance.isGoing ? (
                          <>
                            <span className="inline-flex min-h-11 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:min-h-0">
                              Going to meetup ✓
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleMeetupRsvp(meetup.id)}
                              disabled={preview || isPending}
                              className="inline-flex min-h-11 items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-red-200 hover:text-red-600 disabled:opacity-60 sm:min-h-0"
                            >
                              Cancel RSVP
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleMeetupRsvp(meetup.id)}
                            disabled={preview || isPending}
                            className="inline-flex min-h-11 items-center rounded-lg bg-ipn px-4 py-2 text-xs font-semibold text-white transition hover:bg-ipn-dark disabled:opacity-60 sm:min-h-0"
                          >
                            RSVP to meetup
                          </button>
                        )}

                        {attendance.totalCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenListId((current) => current === listId ? null : listId)}
                            disabled={preview}
                            className="min-h-11 text-xs font-medium text-ipn hover:underline sm:min-h-0"
                          >
                            {openListId === listId ? "Hide attendees" : "View all attendees"}
                          </button>
                        )}
                      </div>
                    </div>
                    {openListId === listId && (
                      <AttendeeList
                        attendees={attendance.visibleAttendees}
                        totalCount={attendance.totalCount}
                        currentUserId={currentUserId}
                        onSelect={setSelectedAttendeeId}
                      />
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {selectedAttendee && (
        <MemberProfileModal
          member={selectedAttendee}
          connectionEntry={connMap[selectedAttendee.id]}
          isSelf={selectedAttendee.id === currentUserId}
          onConnectionChange={(entry) => updateConnectionMap(selectedAttendee.id, entry)}
          onClose={() => setSelectedAttendeeId(null)}
        />
      )}

      {selectedMeetupImage && (
        <ImageLightbox
          image={selectedMeetupImage}
          onClose={closeMeetupImagePreview}
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
      initialMeetupAttendance={{}}
      preview
      compact={compact}
    />
  )
}
