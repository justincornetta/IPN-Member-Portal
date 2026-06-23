"use client"

import { useState, useTransition, useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import InviteFriendsCard from "@/components/InviteFriendsCard"
import WhatsAppCommunityCard from "@/components/community/WhatsAppCommunityCard"
import { acceptConnection, declineConnection, removeConnection } from "@/lib/connections/actions"
import type { ConnectionRow, ConnectionProfile } from "./page"

function getInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function Avatar({ profile, size = "md" }: { profile: ConnectionProfile; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-20 w-20 text-xl" : size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"
  const initials = getInitials(profile.first_name, profile.last_name)
  return (
    <div className={`${cls} flex-shrink-0 overflow-hidden rounded-full`}>
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  )
}

function ConfirmRemoveModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-zinc-900">Remove connection?</h2>
        <p className="mt-2 text-sm text-zinc-500">
          You and <span className="font-medium text-zinc-700">{name}</span> will no longer be connected and won&apos;t be able to see each other&apos;s contact details.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg border border-ipn bg-transparent py-2 text-sm font-medium text-ipn hover:bg-ipn/5 transition"
          >
            Remove connection
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileModal({
  profile,
  onRemove,
  onClose,
  removeLabel = "Remove connection",
  showEmail = true,
}: {
  profile: ConnectionProfile
  onRemove: () => void
  onClose: () => void
  removeLabel?: string
  showEmail?: boolean
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center px-6 pb-4 pt-8">
          <Avatar profile={profile} size="lg" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            {profile.first_name} {profile.last_name}
          </h2>
          {profile.persona && (
            <p className="mt-1 text-sm text-zinc-500">{profile.persona}</p>
          )}
        </div>

        <div className="border-t border-zinc-100" />

        <div className="flex flex-col gap-4 px-6 py-5">
          {showEmail && profile.email && (
            <div className="flex items-center gap-2 rounded-lg bg-ipn/5 border border-ipn/20 px-4 py-3">
              <svg className="h-4 w-4 flex-shrink-0 text-ipn" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <a href={`mailto:${profile.email}`} className="text-sm font-medium text-ipn hover:underline">
                {profile.email}
              </a>
            </div>
          )}
          {showEmail && profile.whatsapp_url && (
            <a
              href={profile.whatsapp_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <svg className="h-4 w-4 flex-shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.05 4.91A9.8 9.8 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.27-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.9-7.01ZM12.04 20.15h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.54 3.69-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.16 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
              </svg>
              <span className="flex-1 text-sm font-medium text-emerald-700">Message on WhatsApp</span>
              <svg className="h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
          {profile.field && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Field</p>
              <p className="mt-1 text-sm text-zinc-700">{profile.field}</p>
            </div>
          )}
          {profile.bio && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{profile.bio}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
          {profile.linkedin_url ? (
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z" />
              </svg>
              LinkedIn
            </a>
          ) : <span />}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-ipn bg-transparent px-4 py-2 text-sm font-medium text-ipn hover:bg-ipn/5 transition"
          >
            {removeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function OutgoingCard({
  row,
  onCancelled,
  onView,
}: {
  row: ConnectionRow
  onCancelled: (addresseeId: string) => void
  onView: (profile: ConnectionProfile) => void
}) {
  const addressee = row.addressee
  const [, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Avatar profile={addressee} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">
          {addressee.first_name} {addressee.last_name}
        </p>
        {addressee.persona && (
          <p className="truncate text-xs text-zinc-400">{addressee.persona}</p>
        )}
        <p className="mt-0.5 text-xs text-zinc-400">Request pending</p>
      </div>
      <div className="flex flex-shrink-0 gap-2">
        <button
          onClick={() => onView(addressee)}
          className="rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white hover:bg-ipn/90 transition"
        >
          View profile
        </button>
        <button
          onClick={() => {
            onCancelled(row.addressee_id)
            startTransition(() => { removeConnection(row.addressee_id) })
          }}
          className="rounded-md border border-ipn bg-transparent px-3 py-1.5 text-xs font-medium text-ipn hover:bg-ipn/5 transition"
        >
          Cancel request
        </button>
      </div>
    </div>
  )
}

function ConnectionCard({
  row,
  userId,
  onRequestRemove,
  onView,
}: {
  row: ConnectionRow
  userId: string
  onRequestRemove: (profile: ConnectionProfile) => void
  onView: (profile: ConnectionProfile) => void
}) {
  const other = row.requester_id === userId ? row.addressee : row.requester

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Avatar profile={other} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">
          {other.first_name} {other.last_name}
        </p>
        {other.persona && (
          <p className="truncate text-xs text-zinc-400">{other.persona}</p>
        )}
        {other.email && (
          <a href={`mailto:${other.email}`} className="mt-0.5 block truncate text-xs text-ipn hover:underline">
            {other.email}
          </a>
        )}
      </div>
      <div className="flex flex-shrink-0 gap-2">
        <button
          onClick={() => onView(other)}
          className="rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white hover:bg-ipn/90 transition"
        >
          View
        </button>
        <button
          onClick={() => onRequestRemove(other)}
          className="rounded-md border border-ipn px-3 py-1.5 text-xs font-medium text-ipn bg-transparent hover:bg-ipn/5 transition"
        >
          Remove connection
        </button>
      </div>
    </div>
  )
}

function RequestCard({
  row,
  onAccepted,
  onDeclined,
  onView,
}: {
  row: ConnectionRow
  onAccepted: (id: string) => void
  onDeclined: (id: string) => void
  onView: (profile: ConnectionProfile) => void
}) {
  const [, startTransition] = useTransition()
  const requester = row.requester
  if (!requester) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <Avatar profile={requester} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">
          {requester.first_name} {requester.last_name}
        </p>
        {requester.persona && (
          <p className="truncate text-xs text-zinc-400">{requester.persona}</p>
        )}
      </div>
      <div className="flex flex-shrink-0 gap-2">
        <button
          onClick={() => onView(requester)}
          className="rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white hover:bg-ipn/90 transition"
        >
          View profile
        </button>
        <button
          onClick={() => {
            onAccepted(row.requester_id)
            startTransition(() => { acceptConnection(row.requester_id) })
          }}
          className="rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white hover:bg-ipn/90 transition"
        >
          Accept
        </button>
        <button
          onClick={() => {
            onDeclined(row.id)
            startTransition(() => { declineConnection(row.requester_id) })
          }}
          className="rounded-md border border-ipn bg-transparent px-3 py-1.5 text-xs font-medium text-ipn hover:bg-ipn/5 transition"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

type Props = {
  userId: string
  accepted: ConnectionRow[]
  incoming: ConnectionRow[]
  outgoing: ConnectionRow[]
}

type CommunityTab = "connections" | "requests"

function communityTabFromParam(
  value: string | null,
  hasIncomingRequests: boolean,
): CommunityTab {
  if (value === "connections" || value === "requests") return value
  return hasIncomingRequests ? "requests" : "connections"
}

export default function CommunityClient({ userId, accepted: initialAccepted, incoming: initialIncoming, outgoing: initialOutgoing }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [accepted, setAccepted] = useState(initialAccepted)
  const [incoming, setIncoming] = useState(initialIncoming)
  const [outgoing, setOutgoing] = useState(initialOutgoing)
  const [viewProfile, setViewProfile] = useState<ConnectionProfile | null>(null)
  const [viewOutgoingProfile, setViewOutgoingProfile] = useState<ConnectionProfile | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ConnectionProfile | null>(null)
  const [, startTransition] = useTransition()
  const tab = communityTabFromParam(searchParams.get("tab"), incoming.length > 0)

  function setCommunityTab(nextTab: CommunityTab) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", nextTab)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function handleRemoved(otherUserId: string) {
    setAccepted((prev) => prev.filter((c) =>
      c.requester_id !== otherUserId && c.addressee_id !== otherUserId,
    ))
  }

  function handleAccepted(requesterId: string) {
    const row = incoming.find((c) => c.requester_id === requesterId)
    if (row) {
      setIncoming((prev) => prev.filter((c) => c.requester_id !== requesterId))
      setAccepted((prev) => [{ ...row, status: "accepted" }, ...prev])
    }
  }

  function handleDeclined(rowId: string) {
    setIncoming((prev) => prev.filter((c) => c.id !== rowId))
  }

  function handleCancelledOutgoing(addresseeId: string) {
    setOutgoing((prev) => prev.filter((c) => c.addressee_id !== addresseeId))
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:gap-8 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Community</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Connect with members to share contact details.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <WhatsAppCommunityCard className="flex-1" />
        <InviteFriendsCard className="flex-1" />
      </div>

      <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit shadow-sm">
        {(["connections", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setCommunityTab(t)}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-ipn text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t === "connections" ? "Connections" : "Requests"}
            {t === "requests" && incoming.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                {incoming.length > 9 ? "9+" : incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "connections" && (
        <div className="flex flex-col gap-3">
          {accepted.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No connections yet. Send requests from the{" "}
              <a href="/dashboard/directory" className="text-ipn hover:underline">Directory</a>.
            </p>
          ) : (
            accepted.map((row) => (
              <ConnectionCard
                key={row.id}
                row={row}
                userId={userId}
                onRequestRemove={setPendingRemove}
                onView={setViewProfile}
              />
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-6">
          {incoming.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Received</p>
              {incoming.map((row) => (
                <RequestCard
                  key={row.id}
                  row={row}
                  onAccepted={handleAccepted}
                  onDeclined={handleDeclined}
                  onView={setViewProfile}
                />
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sent</p>
              {outgoing.map((row) => (
                <OutgoingCard
                  key={row.id}
                  row={row}
                  onCancelled={handleCancelledOutgoing}
                  onView={setViewOutgoingProfile}
                />
              ))}
            </div>
          )}
          {incoming.length === 0 && outgoing.length === 0 && (
            <p className="text-sm text-zinc-400">No pending requests.</p>
          )}
        </div>
      )}

      {viewProfile && (
        <ProfileModal
          profile={viewProfile}
          onRemove={() => {
            setPendingRemove(viewProfile)
            setViewProfile(null)
          }}
          onClose={() => setViewProfile(null)}
        />
      )}

      {viewOutgoingProfile && (
        <ProfileModal
          profile={viewOutgoingProfile}
          removeLabel="Cancel request"
          showEmail={false}
          onRemove={() => {
            handleCancelledOutgoing(viewOutgoingProfile.id)
            startTransition(() => { removeConnection(viewOutgoingProfile.id) })
            setViewOutgoingProfile(null)
          }}
          onClose={() => setViewOutgoingProfile(null)}
        />
      )}

      {pendingRemove && (
        <ConfirmRemoveModal
          name={`${pendingRemove.first_name ?? ""} ${pendingRemove.last_name ?? ""}`.trim()}
          onConfirm={() => {
            handleRemoved(pendingRemove.id)
            startTransition(() => { removeConnection(pendingRemove.id) })
            setPendingRemove(null)
          }}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </div>
  )
}
