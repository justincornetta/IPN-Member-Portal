"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AttendeeAvatar from "./AttendeeAvatar"
import { sendConnectionRequest, acceptConnection } from "@/lib/connections/actions"
import type { ConnectionEntry } from "@/lib/directory/types"
import type { ConferenceAttendee } from "@/lib/conferences/types"

type Props = {
  attendee: ConferenceAttendee
  connectionEntry?: ConnectionEntry
  isSelf: boolean
  onConnectionChange: (entry: ConnectionEntry) => void
  onClose: () => void
}

export default function AttendeeProfileModal({
  attendee,
  connectionEntry,
  isSelf,
  onConnectionChange,
  onClose,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const { status, amRequester } = connectionEntry ?? {}

  function actionButton() {
    if (isSelf) {
      return (
        <span className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-500">
          Your profile
        </span>
      )
    }

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
        <button type="button" disabled className="min-h-11 cursor-default rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400">
          Request Sent
        </button>
      )
    }

    if (status === "pending" && !amRequester) {
      return (
        <button
          type="button"
          onClick={() => {
            onConnectionChange({ status: "accepted", amRequester: false })
            startTransition(async () => {
              const result = await acceptConnection(attendee.id)
              if (result.error) setError(result.error)
              else router.refresh()
            })
          }}
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
            const result = await sendConnectionRequest(attendee.id)
            if (result.error) setError(result.error)
            else router.refresh()
          })
        }}
        className="min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90"
      >
        Connect
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/40 px-0 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(event) => event.stopPropagation()}
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
          <div className="h-20 w-20 flex-shrink-0">
            <AttendeeAvatar name={attendee.name} avatarUrl={attendee.avatarUrl} size="sm" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-zinc-900">
            {attendee.name}
            {isSelf && <span className="ml-2 text-sm font-normal text-zinc-400">(You)</span>}
          </h2>
          {attendee.persona && (
            <span className="mt-2 inline-block rounded-full bg-ipn-light px-2.5 py-0.5 text-xs font-medium text-ipn">
              {attendee.persona}
            </span>
          )}
          {attendee.school && (
            <p className="mt-2 text-sm text-zinc-500">{attendee.school}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 px-6 py-4">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard/directory"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
            >
              Open Directory
            </Link>
            {actionButton()}
          </div>
          {!isSelf && (!connectionEntry || connectionEntry.status === "declined") && (
            <p className="text-center text-xs text-zinc-400">
              Connecting lets you share email and WhatsApp details with each other.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
