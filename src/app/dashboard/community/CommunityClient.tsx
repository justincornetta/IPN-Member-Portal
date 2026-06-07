"use client"

import { useState, useTransition, useEffect } from "react"
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
}: {
  profile: ConnectionProfile
  onRemove: () => void
  onClose: () => void
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
          <div className="flex flex-col gap-2 rounded-lg bg-ipn/5 border border-ipn/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 flex-shrink-0 text-ipn" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <a href={`mailto:${profile.email}`} className="text-sm font-medium text-ipn hover:underline">
                {profile.email}
              </a>
            </div>
            {profile.discord_handle && (
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0 text-ipn" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.054A19.9 19.9 0 0 0 5.93 20.82a.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                <span className="text-sm font-medium text-ipn">{profile.discord_handle}</span>
              </div>
            )}
          </div>
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
            Remove connection
          </button>
        </div>
      </div>
    </div>
  )
}

function OutgoingCard({
  row,
  onCancelled,
}: {
  row: ConnectionRow
  onCancelled: (addresseeId: string) => void
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
      <button
        onClick={() => {
          onCancelled(row.addressee_id)
          startTransition(() => { removeConnection(row.addressee_id) })
        }}
        className="flex-shrink-0 rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 hover:border-red-200 hover:text-red-500 transition cursor-pointer"
      >
        Cancel
      </button>
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
        {other.discord_handle && (
          <p className="mt-0.5 truncate text-xs text-zinc-400">{other.discord_handle}</p>
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
}: {
  row: ConnectionRow
  onAccepted: (id: string) => void
  onDeclined: (id: string) => void
}) {
  const requester = row.requester
  if (!requester) return null
  const [, startTransition] = useTransition()

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
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 transition"
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

export default function CommunityClient({ userId, accepted: initialAccepted, incoming: initialIncoming, outgoing: initialOutgoing }: Props) {
  const [tab, setTab] = useState<"connections" | "requests">(
    initialIncoming.length > 0 ? "requests" : "connections",
  )
  const [accepted, setAccepted] = useState(initialAccepted)
  const [incoming, setIncoming] = useState(initialIncoming)
  const [outgoing, setOutgoing] = useState(initialOutgoing)
  const [viewProfile, setViewProfile] = useState<ConnectionProfile | null>(null)
  const [pendingRemove, setPendingRemove] = useState<ConnectionProfile | null>(null)
  const [, startTransition] = useTransition()

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

      <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit shadow-sm">
        {(["connections", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
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
