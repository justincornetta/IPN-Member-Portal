"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRightIcon, UserPlusIcon } from "@heroicons/react/24/outline"
import MemberProfileModal from "@/components/directory/MemberProfileModal"
import type { ConnectionEntry, DirectoryMember } from "@/lib/directory/types"

function FeaturedMember({
  member,
  onOpen,
}: {
  member: DirectoryMember
  onOpen: () => void
}) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ")
  const focus = member.persona ?? member.field ?? member.affiliation ?? member.school
  const initials = [member.first_name?.[0], member.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${name || "member"} profile`}
      className="group flex min-w-0 flex-col items-center px-2 py-3 text-center transition hover:bg-ipn-light/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
    >
      <span className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full bg-ipn-light sm:h-24 sm:w-24">
        {member.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatar_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-ipn">
            {initials}
          </span>
        )}
      </span>
      <span className="mt-3 min-w-0 max-w-full">
        <span className="block truncate text-sm font-semibold text-zinc-950 group-hover:text-ipn sm:text-base">
          {name}
        </span>
        {focus && (
          <span className="mt-1 block truncate text-xs text-zinc-500">
            {focus}
          </span>
        )}
        <span className="mt-4 hidden min-h-11 items-center justify-center gap-2 text-sm font-semibold text-ipn sm:inline-flex">
          <UserPlusIcon className="h-5 w-5" aria-hidden="true" />
          Connect
        </span>
      </span>
    </button>
  )
}

export default function FeaturedMembersPreview({
  featuredMembers,
  currentUserId,
  connectionMap: initialConnectionMap,
}: {
  featuredMembers: DirectoryMember[]
  currentUserId: string
  connectionMap: Record<string, ConnectionEntry>
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [connectionMap, setConnectionMap] = useState(initialConnectionMap)
  const selectedMember = featuredMembers.find(
    (member) => member.id === selectedMemberId,
  )

  return (
    <section aria-labelledby="members-to-know">
      <div className="flex items-center justify-between gap-4">
        <h2 id="members-to-know" className="text-lg font-semibold text-ipn sm:text-xl">
          Members to know
        </h2>
        <Link
          href="/dashboard/directory"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline"
        >
          Explore community
          <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-3 divide-x divide-zinc-100">
        {featuredMembers.map((member) => (
          <FeaturedMember
            key={member.id}
            member={member}
            onOpen={() => setSelectedMemberId(member.id)}
          />
        ))}
      </div>

      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          connectionEntry={connectionMap[selectedMember.id]}
          isSelf={selectedMember.id === currentUserId}
          onConnectionChange={(entry) =>
            setConnectionMap((current) => ({
              ...current,
              [selectedMember.id]: entry,
            }))
          }
          onClose={() => setSelectedMemberId(null)}
        />
      )}
    </section>
  )
}
