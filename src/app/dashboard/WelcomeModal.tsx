"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { WHATSAPP_COMMUNITY_COPY } from "@/components/community/WhatsAppCommunityCard"

const WHATSAPP_COMMUNITY_URL = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL

export default function WelcomeModal({
  userId,
  show,
}: {
  userId: string
  show: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!show) return

    const key = `ipn_welcome_shown_${userId}`
    if (!localStorage.getItem(key)) {
      const timer = window.setTimeout(() => {
        localStorage.setItem(key, "1")
        setOpen(true)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [show, userId])

  function dismiss() {
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 hover:text-zinc-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* IPN dot */}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-ipn/10">
          <svg className="h-6 w-6 text-ipn" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-zinc-900">Welcome to IPN</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          We&apos;re glad you&apos;re here. Two quick steps will help you get
          settled: finish your profile so members can learn more about you, then
          join the WhatsApp community to connect with other members and stay up
          to date on the latest IPN events and news.
        </p>

        <ul className="mt-4 flex flex-col gap-2 text-sm text-zinc-600">
          {[
            "Upload a profile image",
            "Add a short bio",
            "Choose up to 3 interests for the member directory",
            WHATSAPP_COMMUNITY_COPY,
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-ipn" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/profile"
            target="_blank"
            rel="noreferrer"
            onClick={dismiss}
            className="rounded-lg bg-ipn px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-ipn/90 transition"
          >
            Complete your profile
          </Link>
          {WHATSAPP_COMMUNITY_URL ? (
            <a
              href={WHATSAPP_COMMUNITY_URL}
              target="_blank"
              rel="noreferrer"
              onClick={dismiss}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Join WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-400"
            >
              WhatsApp coming soon
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
