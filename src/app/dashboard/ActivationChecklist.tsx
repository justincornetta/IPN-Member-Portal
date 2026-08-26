"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { completeOnboardingStep } from "@/lib/onboarding/actions"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import { activationSummary } from "./activation-model"

type MilestoneId = "whatsapp" | "profile" | "event" | "community" | "invite"

type ActivationItem = {
  id: MilestoneId
  title: string
  description: string
  href?: string
  completed: boolean
}

const INVITE_URL = "https://members.intercollegiatepsychedelics.net/register?utm_source=member_portal&utm_medium=member_invite&utm_campaign=member_referral"

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  )
}

export default function ActivationChecklist({
  progress,
  profileCompletedCount,
  profileTotalCount,
}: {
  progress: OnboardingProgress | null
  profileCompletedCount: number
  profileTotalCount: number
}) {
  const router = useRouter()
  const [inviteCopied, setInviteCopied] = useState(false)

  const items: ActivationItem[] = [
    {
      id: "whatsapp",
      title: "Join IPN on WhatsApp",
      description: "Choose the IPN groups that fit how you want to participate.",
      href: "/onboarding/whatsapp?motion=editorial",
      completed: Boolean(progress?.whatsapp_completed_at),
    },
    {
      id: "profile",
      title: "Complete your profile",
      description: `${profileCompletedCount} of ${profileTotalCount} profile requirements complete`,
      href: "/dashboard/profile",
      completed: Boolean(progress?.profile_completed_at),
    },
    {
      id: "event",
      title: "RSVP for an event",
      description: "Find an upcoming gathering and save your place.",
      href: "/dashboard/events",
      completed: Boolean(progress?.event_rsvp_completed_at),
    },
    {
      id: "community",
      title: "Discover and connect with members",
      description: "Search the community and start a new connection.",
      href: "/dashboard/directory",
      completed: Boolean(progress?.connection_request_completed_at),
    },
    {
      id: "invite",
      title: "Invite a friend",
      description: inviteCopied
        ? "Invite link copied."
        : "Share IPN with someone who should be part of the network.",
      completed: Boolean(progress?.invite_completed_at),
    },
  ]

  const summary = activationSummary(progress)
  const completedCount = summary.completedCount

  async function copyInvite() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join the IPN Member Portal",
          text: "Join me in the Intercollegiate Psychedelics Network member portal.",
          url: INVITE_URL,
        })
      } catch {
        return
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(INVITE_URL)
      setInviteCopied(true)
      window.setTimeout(() => setInviteCopied(false), 1800)
    } else {
      return
    }

    await completeOnboardingStep("invite")
    router.refresh()
  }

  return (
    <section className="h-full rounded-xl border border-ipn/15 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="activation-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ipn">Getting settled</p>
          <h2 id="activation-heading" className="mt-1 text-lg font-semibold text-[#1A1034]">
            Your activation path
          </h2>
        </div>
        <p className="whitespace-nowrap rounded-full bg-ipn-light px-2.5 py-1 text-xs font-semibold text-ipn">
          {completedCount} of {items.length} complete
        </p>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EDE5F7]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-ipn motion-safe:transition-[width] motion-reduce:transition-none"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      <ol className="mt-4 overflow-hidden rounded-xl border border-[#E8E0F2] bg-white">
        {items.map((item, index) => {
          const isNext = summary.nextMilestone === item.id
          const content = (
            <>
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.completed
                    ? "bg-ipn text-white"
                    : "bg-ipn-light text-ipn"
                }`}
                aria-label={item.completed ? "Completed" : `Milestone ${index + 1}`}
              >
                {item.completed ? <CheckIcon /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-800">{item.title}</span>
                  {isNext && !item.completed && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ipn">
                      Next
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                  {item.completed ? "Complete" : item.description}
                </span>
                {item.id === "profile" && !item.completed && (
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[#EDE5F7]" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-ipn"
                      style={{ width: `${(profileCompletedCount / profileTotalCount) * 100}%` }}
                    />
                  </span>
                )}
              </span>
              <ArrowIcon />
            </>
          )

          return (
            <li
              key={item.id}
              className={`border-b border-[#EEE9F3] last:border-b-0 ${isNext && !item.completed ? "bg-[#FAF7FF]" : "bg-white"}`}
            >
              {item.id === "invite" ? (
                <button
                  type="button"
                  onClick={copyInvite}
                  className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[#FAF7FF] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ipn"
                >
                  {content}
                </button>
              ) : (
                <Link
                  href={item.href!}
                  aria-label={`Open ${item.title}`}
                  data-analytics-event="curated_click"
                  data-analytics-id={`dashboard-activation-${item.id}`}
                  data-analytics-label={item.title}
                  className="flex min-h-16 items-center gap-3 px-3 py-2.5 transition hover:bg-[#FAF7FF] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ipn"
                >
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
