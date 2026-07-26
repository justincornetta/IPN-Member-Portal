"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PERSONA_OPTIONS } from "@/lib/constants/registration"
import type { ConnectionEntry, DirectoryMember } from "@/lib/directory/types"
import { sendConnectionRequest, acceptConnection, removeConnection } from "@/lib/connections/actions"

// DB values are the display labels — this is an identity map kept for future flexibility
const PERSONA_LABEL: Record<string, string> = Object.fromEntries(
  PERSONA_OPTIONS.map((o) => [o.value, o.value]),
)

export function getInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

export function AvatarCircle({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null
  initials: string
}) {
  return (
    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full sm:h-16 sm:w-16">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn text-lg font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  )
}

export function PersonaBadge({ persona }: { persona: string | null }) {
  if (!persona) return null
  return (
    <span className="inline-block rounded-full bg-ipn-light px-2.5 py-0.5 text-xs font-medium text-ipn">
      {PERSONA_LABEL[persona] ?? persona}
    </span>
  )
}

function ConfirmRemoveModal({
  name,
  mode = "remove",
  onConfirm,
  onCancel,
}: {
  name: string
  mode?: "remove" | "cancel"
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCancel])

  const title = mode === "cancel" ? "Cancel request?" : "Remove connection?"
  const body = mode === "cancel"
    ? <>Your pending connection request to <span className="font-medium text-zinc-700">{name}</span> will be withdrawn.</>
    : <>You and <span className="font-medium text-zinc-700">{name}</span> will no longer be connected.</>
  const confirmLabel = mode === "cancel" ? "Cancel request" : "Remove connection"

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 px-0 sm:items-center sm:px-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm text-zinc-500">{body}</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50">
            Never mind
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-analytics-event="curated_click"
            data-analytics-id="connection-remove-confirm"
            data-analytics-label="Confirm remove connection"
            className="min-h-11 flex-1 rounded-lg border border-ipn bg-transparent py-2 text-sm font-medium text-ipn transition hover:bg-ipn/5">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MemberProfileModal({
  member,
  connectionEntry,
  isSelf,
  onConnectionChange,
  onClose,
}: {
  member: DirectoryMember
  connectionEntry: ConnectionEntry | undefined
  isSelf: boolean
  onConnectionChange: (entry: ConnectionEntry) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const initials = getInitials(member.first_name, member.last_name)
  const location = [member.city, member.state].filter(Boolean).join(", ")
  const institution = member.school ?? member.affiliation
  const isConnected = connectionEntry?.status === "accepted"
  const isPendingOutgoing = connectionEntry?.status === "pending" && connectionEntry.amRequester

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-0 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
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

        {/* Header */}
        <div className="flex flex-col items-center px-6 pb-4 pt-8">
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-ipn text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            {member.first_name} {member.last_name}
          </h2>
          {(isSelf || member.persona) && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {isSelf && (
                <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                  You
                </span>
              )}
              <PersonaBadge persona={member.persona} />
            </div>
          )}
          {(institution || location) && (
            <div className="mt-2 flex flex-col items-center gap-0.5">
              {institution && (
                <p className="text-sm font-medium text-zinc-600">{institution}</p>
              )}
              {location && (
                <p className="text-xs text-zinc-400">{location}</p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100" />

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5">
          {member.field && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Field</p>
              <p className="mt-1 text-sm text-zinc-700">{member.field}</p>
            </div>
          )}
          {member.bio && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{member.bio}</p>
            </div>
          )}
          {member.interest_tags && member.interest_tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Interests</p>
              <p className="mt-1 text-sm text-zinc-700">{member.interest_tags.join(" · ")}</p>
            </div>
          )}
          {isConnected && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {member.contact?.email && (
                  <a
                    href={`mailto:${member.contact.email}`}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn hover:text-ipn"
                  >
                    Email
                  </a>
                )}
                {member.contact?.whatsapp_url && (
                  <a
                    href={member.contact.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                  >
                    WhatsApp
                  </a>
                )}
                {!member.contact?.email && !member.contact?.whatsapp_url && (
                  <p className="text-sm text-zinc-500">No contact details added yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-zinc-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {isSelf ? (
            member.linkedin_url ? (
              <a
                href={member.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z" />
                </svg>
                LinkedIn
              </a>
            ) : (
              <span />
            )
          ) : isConnected ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              data-analytics-event="curated_click"
              data-analytics-id={`connection-remove-start-${member.id}`}
              data-analytics-label="Remove connection"
              className="min-h-11 rounded-lg border border-ipn bg-transparent px-4 py-2 text-sm font-medium text-ipn transition hover:bg-ipn/5"
            >
              Remove connection
            </button>
          ) : isPendingOutgoing ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              data-analytics-event="curated_click"
              data-analytics-id={`connection-cancel-start-${member.id}`}
              data-analytics-label="Cancel connection request"
              className="min-h-11 rounded-lg border border-zinc-200 bg-transparent px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-red-200 hover:text-red-600"
            >
              Cancel request
            </button>
          ) : member.linkedin_url ? (
            <a
              href={member.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z" />
              </svg>
              LinkedIn
            </a>
          ) : (
            <span />
          )}
          {(() => {
            if (isSelf) {
              return (
                <span className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500">
                  Your profile
                </span>
              )
            }

            const { status, amRequester } = connectionEntry ?? {}

            if (status === "accepted") {
              return (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Connected
                </span>
              )
            }

            if (status === "pending" && amRequester) {
              return (
                <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-500">
                  Request sent
                </span>
              )
            }

            if (status === "pending" && !amRequester) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    onConnectionChange({ status: "accepted", amRequester: false })
                    startTransition(async () => {
                      const result = await acceptConnection(member.id)
                      if (!result.error) router.refresh()
                    })
                  }}
                  data-analytics-event="curated_click"
                  data-analytics-id={`connection-accept-${member.id}`}
                  data-analytics-label="Accept connection request"
                  className="min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90"
                >
                  Accept Request
                </button>
              )
            }

            return (
              <button
                type="button"
                onClick={() => {
                  onConnectionChange({ status: "pending", amRequester: true })
                  startTransition(async () => {
                    const result = await sendConnectionRequest(member.id)
                    if (!result.error) router.refresh()
                  })
                }}
                data-analytics-event="curated_click"
                data-analytics-id={`connection-request-${member.id}`}
                data-analytics-label="Send connection request"
                className="min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90"
              >
                Connect
              </button>
            )
          })()}
        </div>

        {!isSelf && (!connectionEntry || connectionEntry.status === "declined") && (
          <p className="px-6 pb-4 text-center text-xs text-zinc-400">
            Connecting lets you share email and WhatsApp details with each other.
          </p>
        )}
      </div>

      {confirmRemove && (
        <ConfirmRemoveModal
          name={`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()}
          mode={isPendingOutgoing ? "cancel" : "remove"}
          onConfirm={() => {
            onConnectionChange({ status: "declined", amRequester: true })
            startTransition(async () => {
              const result = await removeConnection(member.id)
              if (!result.error) router.refresh()
            })
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}
