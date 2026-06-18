"use client"

import { useMemo, useState } from "react"

type InviteFriendsCardProps = {
  id?: string
  className?: string
  variant?: "default" | "compact" | "header" | "checklist"
  checklistNumber?: number
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://members.ipn.org"

function buildInviteUrl() {
  const baseUrl = SITE_URL.replace(/\/$/, "")
  const url = new URL("/register", baseUrl)
  url.searchParams.set("utm_source", "member_portal")
  url.searchParams.set("utm_medium", "member_invite")
  url.searchParams.set("utm_campaign", "member_referral")
  return url.toString()
}

function InviteIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a8.25 8.25 0 0 0 3-6.36 8.25 8.25 0 1 0-16.5 0 8.25 8.25 0 0 0 3 6.36m10.5 0A8.217 8.217 0 0 1 12 20.25a8.217 8.217 0 0 1-6-1.53m12 0a5.25 5.25 0 0 0-12 0m12 0a8.198 8.198 0 0 1-6 2.28 8.198 8.198 0 0 1-6-2.28M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75A1.125 1.125 0 0 1 3.75 20.625v-9.75c0-.621.504-1.125 1.125-1.125H8.25m7.5 7.5h3.375c.621 0 1.125-.504 1.125-1.125v-9.75c0-.621-.504-1.125-1.125-1.125h-9.75c-.621 0-1.125.504-1.125 1.125V9.75m7.5 7.5h-7.5"
      />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 .934-1.966m-.934 1.966a2.25 2.25 0 0 0 .934-1.966m-.934-10.848a2.25 2.25 0 1 0 .934 1.966m-.934-1.966a2.25 2.25 0 0 1 .934 1.966"
      />
    </svg>
  )
}

export default function InviteFriendsCard({
  id,
  className = "",
  variant = "default",
  checklistNumber = 5,
}: InviteFriendsCardProps) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = useMemo(buildInviteUrl, [])
  const isCompact = variant === "compact"
  const isHeader = variant === "header"
  const isChecklist = variant === "checklist"
  const emailHref = `mailto:?subject=${encodeURIComponent(
    "Join me in the IPN Member Portal",
  )}&body=${encodeURIComponent(
    `IPN has a member portal for events, resources, and finding other members. You can join here: ${inviteUrl}`,
  )}`

  async function copyInviteLink() {
    if (!navigator.clipboard) return

    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function shareInviteLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join the IPN Member Portal",
          text: "Join me in the Intercollegiate Psychedelics Network member portal.",
          url: inviteUrl,
        })
      } catch {
        return
      }
      return
    }

    await copyInviteLink()
  }

  if (isHeader) {
    return (
      <div id={id} className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={copyInviteLink}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
        >
          <CopyIcon />
          {copied ? "Copied" : "Invite Your Friends to IPN"}
        </button>
        <button
          type="button"
          onClick={shareInviteLink}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
          aria-label="Share IPN invite link"
        >
          <ShareIcon />
        </button>
      </div>
    )
  }

  if (isChecklist) {
    return (
      <div id={id} className={`flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={copyInviteLink}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition hover:border-ipn/30 hover:bg-zinc-50"
        >
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ipn-light text-xs font-semibold text-ipn">
            {checklistNumber}
          </span>
          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            <CopyIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-900">
              Invite Friends to IPN
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-500">
              {copied ? "Invite link copied." : "Copy an invite link for peers."}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={shareInviteLink}
          className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-ipn/30 hover:bg-zinc-50 hover:text-zinc-900"
          aria-label="Share IPN invite link"
        >
          <ShareIcon />
        </button>
      </div>
    )
  }

  return (
    <div
      id={id}
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${
        isCompact ? "p-4" : "p-5"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ipn-light text-ipn">
          <InviteIcon />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-900">
            Invite Your Friends to IPN
          </h2>
          <p
            className={`mt-1 text-sm leading-6 text-zinc-500 ${
              isCompact ? "line-clamp-2" : ""
            }`}
          >
            Share the member portal with students, researchers, clinicians, and
            peers who should be part of the IPN community.
          </p>
        </div>
      </div>

      <div className={`mt-4 flex ${isCompact ? "gap-2" : "flex-wrap gap-2"}`}>
        <button
          type="button"
          onClick={copyInviteLink}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-ipn px-3 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
        >
          <CopyIcon />
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={shareInviteLink}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          <ShareIcon />
          Share
        </button>
        {!isCompact && (
          <a
            href={emailHref}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            Email
          </a>
        )}
      </div>
    </div>
  )
}
