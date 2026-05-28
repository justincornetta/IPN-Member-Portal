"use client"

import { useState, useTransition } from "react"
import { acceptConnection, declineConnection, removeConnection } from "@/lib/connections/actions"
import type { ConnectionRow, ConnectionProfile } from "./page"

function getInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function Avatar({ profile, size = "md" }: { profile: ConnectionProfile; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"
  const initials = getInitials(profile.first_name, profile.last_name)
  return (
    <div className={`${cls} flex-shrink-0 overflow-hidden rounded-full`}>
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn text-xs font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  )
}

function ConnectionCard({
  row,
  userId,
  onRemoved,
}: {
  row: ConnectionRow
  userId: string
  onRemoved: (id: string) => void
}) {
  const other = row.requester_id === userId ? row.addressee : row.requester
  const [, startTransition] = useTransition()

  function handleRemove() {
    onRemoved(other.id)
    startTransition(() => { removeConnection(other.id) })
  }

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
        <p className="mt-0.5 truncate text-xs text-ipn">{other.email}</p>
      </div>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 rounded-md px-3 py-1.5 text-xs text-zinc-400 border border-zinc-200 hover:border-red-200 hover:text-red-500 transition"
      >
        Remove
      </button>
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
  const [, startTransition] = useTransition()

  function handleAccept() {
    onAccepted(row.requester_id)
    startTransition(() => { acceptConnection(row.requester_id) })
  }

  function handleDecline() {
    onDeclined(row.id)
    startTransition(() => { declineConnection(row.requester_id) })
  }

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
          onClick={handleAccept}
          className="rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white hover:bg-ipn/90 transition"
        >
          Accept
        </button>
        <button
          onClick={handleDecline}
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
}

export default function CommunityClient({ userId, accepted: initialAccepted, incoming: initialIncoming }: Props) {
  const [tab, setTab] = useState<"connections" | "requests">(
    initialIncoming.length > 0 ? "requests" : "connections",
  )
  const [accepted, setAccepted] = useState(initialAccepted)
  const [incoming, setIncoming] = useState(initialIncoming)

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

  return (
    <div className="flex flex-col gap-6 p-4 sm:gap-8 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Community</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Connect with members to share contact details.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 w-fit shadow-sm">
        {(["connections", "requests"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-ipn text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
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
              <a href="/dashboard/directory" className="text-ipn hover:underline">
                Directory
              </a>
              .
            </p>
          ) : (
            accepted.map((row) => (
              <ConnectionCard
                key={row.id}
                row={row}
                userId={userId}
                onRemoved={handleRemoved}
              />
            ))
          )}
        </div>
      )}

      {tab === "requests" && (
        <div className="flex flex-col gap-3">
          {incoming.length === 0 ? (
            <p className="text-sm text-zinc-400">No pending requests.</p>
          ) : (
            incoming.map((row) => (
              <RequestCard
                key={row.id}
                row={row}
                onAccepted={handleAccepted}
                onDeclined={handleDeclined}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
