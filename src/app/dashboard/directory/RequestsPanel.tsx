"use client"

import { useState, useTransition } from "react"
import { acceptConnection, declineConnection, removeConnection } from "@/lib/connections/actions"
import MemberProfileModal, { getInitials, AvatarCircle } from "@/components/directory/MemberProfileModal"
import type { ConnectionEntry, DirectoryMember } from "@/lib/directory/types"

export type ConnectionRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
  requester: DirectoryMember
  addressee: DirectoryMember
}

function memberName(member: DirectoryMember) {
  return `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()
}

function OutgoingCard({
  row,
  onCancelled,
  onView,
}: {
  row: ConnectionRow
  onCancelled: (addresseeId: string) => void
  onView: (member: DirectoryMember, entry: ConnectionEntry) => void
}) {
  const addressee = row.addressee
  const [, startTransition] = useTransition()
  const initials = getInitials(addressee.first_name, addressee.last_name)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <AvatarCircle avatarUrl={addressee.avatar_url} initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{memberName(addressee)}</p>
        {addressee.persona && (
          <p className="truncate text-xs text-zinc-400">{addressee.persona}</p>
        )}
        <p className="mt-0.5 text-xs text-zinc-400">Request pending</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-shrink-0">
        <button
          onClick={() => onView(addressee, { status: "pending", amRequester: true })}
          className="min-h-11 rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ipn/90"
        >
          View profile
        </button>
        <button
          onClick={() => {
            onCancelled(row.addressee_id)
            startTransition(() => { removeConnection(row.addressee_id) })
          }}
          className="min-h-11 rounded-md border border-ipn bg-transparent px-3 py-1.5 text-xs font-medium text-ipn transition hover:bg-ipn/5"
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
  onView,
}: {
  row: ConnectionRow
  userId: string
  onView: (member: DirectoryMember, entry: ConnectionEntry) => void
}) {
  const other = row.requester_id === userId ? row.addressee : row.requester
  const initials = getInitials(other.first_name, other.last_name)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <AvatarCircle avatarUrl={other.avatar_url} initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{memberName(other)}</p>
        {other.persona && (
          <p className="truncate text-xs text-zinc-400">{other.persona}</p>
        )}
        {other.contact?.email && (
          <a href={`mailto:${other.contact.email}`} className="mt-0.5 inline-flex min-h-11 max-w-full items-center truncate text-xs text-ipn hover:underline sm:min-h-0">
            {other.contact.email}
          </a>
        )}
      </div>
      <div className="flex-shrink-0">
        <button
          onClick={() => onView(other, { status: "accepted", amRequester: row.requester_id === userId })}
          className="min-h-11 rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ipn/90"
        >
          View
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
  onView: (member: DirectoryMember, entry: ConnectionEntry) => void
}) {
  const [isPending, startTransition] = useTransition()
  const requester = row.requester
  if (!requester) return null
  const initials = getInitials(requester.first_name, requester.last_name)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <AvatarCircle avatarUrl={requester.avatar_url} initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{memberName(requester)}</p>
        {requester.persona && (
          <p className="truncate text-xs text-zinc-400">{requester.persona}</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-shrink-0">
        <button
          onClick={() => onView(requester, { status: "pending", amRequester: false })}
          className="min-h-11 rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ipn/90"
        >
          View profile
        </button>
        <button
          onClick={() => {
            startTransition(async () => {
              const result = await acceptConnection(row.requester_id)
              if (!result.error) onAccepted(row.requester_id)
            })
          }}
          disabled={isPending}
          className="min-h-11 rounded-md bg-ipn px-3 py-1.5 text-xs font-medium text-white transition hover:bg-ipn/90"
        >
          {isPending ? "Accepting…" : "Accept"}
        </button>
        <button
          onClick={() => {
            startTransition(async () => {
              const result = await declineConnection(row.requester_id)
              if (!result.error) onDeclined(row.id)
            })
          }}
          disabled={isPending}
          className="min-h-11 rounded-md border border-ipn bg-transparent px-3 py-1.5 text-xs font-medium text-ipn transition hover:bg-ipn/5"
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

export default function RequestsPanel({ userId, accepted: initialAccepted, incoming: initialIncoming, outgoing: initialOutgoing }: Props) {
  const [accepted, setAccepted] = useState(initialAccepted)
  const [incoming, setIncoming] = useState(initialIncoming)
  const [outgoing, setOutgoing] = useState(initialOutgoing)
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<ConnectionEntry | undefined>(undefined)

  function openMember(member: DirectoryMember, entry: ConnectionEntry) {
    setSelectedMember(member)
    setSelectedEntry(entry)
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

  function handleModalConnectionChange(member: DirectoryMember, prevEntry: ConnectionEntry | undefined, nextEntry: ConnectionEntry) {
    if (prevEntry?.status === "accepted" && nextEntry.status === "declined") {
      handleRemoved(member.id)
    } else if (prevEntry?.status === "pending" && !prevEntry.amRequester && nextEntry.status === "accepted") {
      handleAccepted(member.id)
    } else if (prevEntry?.status === "pending" && prevEntry.amRequester && nextEntry.status === "declined") {
      handleCancelledOutgoing(member.id)
    }
    setSelectedEntry(nextEntry)
  }

  const hasRequests = incoming.length > 0 || outgoing.length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {hasRequests && (
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Connections</p>
        )}
        {accepted.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No connections yet. Send requests from the All Members tab above.
          </p>
        ) : (
          accepted.map((row) => (
            <ConnectionCard key={row.id} row={row} userId={userId} onView={openMember} />
          ))
        )}
      </div>

      {hasRequests && (
        <div className="flex flex-col gap-6">
          {incoming.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Requests received</p>
              {incoming.map((row) => (
                <RequestCard
                  key={row.id}
                  row={row}
                  onAccepted={handleAccepted}
                  onDeclined={handleDeclined}
                  onView={openMember}
                />
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Requests sent</p>
              {outgoing.map((row) => (
                <OutgoingCard
                  key={row.id}
                  row={row}
                  onCancelled={handleCancelledOutgoing}
                  onView={openMember}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          connectionEntry={selectedEntry}
          isSelf={selectedMember.id === userId}
          onConnectionChange={(entry) => handleModalConnectionChange(selectedMember, selectedEntry, entry)}
          onClose={() => {
            setSelectedMember(null)
            setSelectedEntry(undefined)
          }}
        />
      )}
    </div>
  )
}
