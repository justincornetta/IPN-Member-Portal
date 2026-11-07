"use client"

import { useEffect, useRef, useState, useTransition, type RefObject } from "react"
import { PERSONA_OPTIONS } from "@/lib/constants/registration"
import type { ConnectionEntry, DirectoryMember, DirectoryContact } from "@/lib/directory/types"
import { sendConnectionRequest, acceptConnection, removeConnection, getConnectionDetails } from "@/lib/connections/actions"
import { memberAffiliation, memberLocation } from "@/lib/directory/presentation"
import type { ConnectionActionResult } from "@/lib/connections/types"
import { educationLevelLabel } from "@/lib/members/education"

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

function useDialogFocus(ref: RefObject<HTMLDivElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = ref.current
    dialog?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true })
    function onKey(event: KeyboardEvent) {
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] !== dialog) return
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return }
      if (event.key !== "Tab" || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0)
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [ref])
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
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, onCancel)

  const title = mode === "cancel" ? "Cancel request?" : "Remove connection?"
  const body = mode === "cancel"
    ? <>Your pending connection request to <span className="font-medium text-zinc-700">{name}</span> will be withdrawn.</>
    : <>You and <span className="font-medium text-zinc-700">{name}</span> will no longer be connected.</>
  const confirmLabel = mode === "cancel" ? "Cancel request" : "Remove connection"

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 px-0 sm:items-center sm:px-4" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-connection-title"
        className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-connection-title" className="text-base font-semibold text-zinc-900">{title}</h2>
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
  onConnectionChange: (entry: ConnectionEntry, contact?: DirectoryContact | null) => void
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const busyRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionContact, setActionContact] = useState<DirectoryContact | null | undefined>(undefined)
  const connectionChangeRef = useRef(onConnectionChange)
  useEffect(() => { connectionChangeRef.current = onConnectionChange }, [onConnectionChange])
  const [contactWarning, setContactWarning] = useState<string | null>(null)
  useDialogFocus(dialogRef, onClose)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const initials = getInitials(member.first_name, member.last_name)
  const location = memberLocation(member)
  const institution = memberAffiliation(member)
  const contact = actionContact
  const isConnected = connectionEntry?.status === "accepted"
  const isPendingOutgoing = connectionEntry?.status === "pending" && connectionEntry.amRequester

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    // Reopening a later-page profile must not rely on a retained contact snapshot.
    getConnectionDetails(member.id).then((result) => {
      if (cancelled) return
      if (result.error || !result.entry) {
        setActionContact(null)
        setContactWarning(result.error ?? "Contact details could not load.")
        return
      }
      setActionContact(result.contact)
      setContactWarning(result.contactWarning ?? null)
      connectionChangeRef.current(result.entry, result.contact)
    }).catch(() => {
      if (!cancelled) {
        setActionContact(null)
        setContactWarning("Contact details could not load. Reopen this profile to try again.")
      }
    })
    return () => { cancelled = true }
  }, [isConnected, member.id])

  function runConnectionAction(action: () => Promise<ConnectionActionResult>) {
    if (busyRef.current) return
    busyRef.current = true
    setActionError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (result.error) { setActionError(result.error); return }
        if (!result.entry) { setActionError("Could not confirm the connection. Please try again."); return }
        setActionContact(result.contact)
        setContactWarning(result.contactWarning ?? null)
        onConnectionChange(result.entry, result.contact)
        setConfirmRemove(false)
      } catch {
        setActionError("The connection could not be updated. Please try again.")
      } finally {
        busyRef.current = false
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-0 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-profile-title"
        aria-busy={isPending}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-ipn"
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
          <h2 id="member-profile-title" className="mt-4 text-xl font-semibold text-zinc-900">
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
          {member.education && member.education.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Education</p>
              <div className="mt-2 flex flex-col gap-3">
                {member.education.map((entry) => (
                  <div key={entry.id}>
                    <p className="text-sm font-medium text-zinc-700">{entry.institution}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {[
                        educationLevelLabel(entry.education_level),
                        entry.degree_credential,
                        entry.area_of_study,
                        entry.status === "currently_enrolled"
                          ? "Currently enrolled"
                          : entry.status === "completed"
                            ? "Completed / alumni"
                            : null,
                        entry.graduation_year ? `Class of ${entry.graduation_year}` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                ))}
              </div>
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
                {contact?.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn hover:text-ipn"
                  >
                    Email
                  </a>
                )}
                {contact?.whatsapp_url && (
                  <a
                    href={contact.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                  >
                    WhatsApp
                  </a>
                )}
                {!contact?.email && !contact?.whatsapp_url && (
                  <p className="text-sm text-zinc-500">{actionContact === undefined ? "Loading contact details…" : contactWarning ?? "No contact details added yet."}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div role="status" aria-live="polite" className="px-6">
          {isPending && <p className="pb-3 text-sm text-zinc-600">Updating connection…</p>}
          {actionError && <p role="alert" className="pb-3 text-sm text-red-700">{actionError}</p>}
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
              disabled={isPending}
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
              disabled={isPending}
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
                  onClick={() => runConnectionAction(() => acceptConnection(member.id))}
                  disabled={isPending}
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
                onClick={() => runConnectionAction(() => sendConnectionRequest(member.id))}
                disabled={isPending}
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
            Once accepted, you can share email and WhatsApp details with each other.
          </p>
        )}
      </div>

      {confirmRemove && (
        <ConfirmRemoveModal
          name={`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()}
          mode={isPendingOutgoing ? "cancel" : "remove"}
          onConfirm={() => {
            setConfirmRemove(false)
            runConnectionAction(() => removeConnection(member.id))
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}
