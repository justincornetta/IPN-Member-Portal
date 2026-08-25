"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { completeOnboardingStep } from "@/lib/onboarding/actions"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import { activationSummary } from "./activation-model"

type MilestoneId = "whatsapp" | "profile" | "event" | "community" | "invite"

type ActivationItem = {
  id: MilestoneId | "conferences" | "resources"
  title: string
  description: string
  href?: string
  kind: "milestone" | "suggestion"
  completed: boolean
}

const INVITE_URL = "https://members.intercollegiatepsychedelics.net/register?utm_source=member_portal&utm_medium=member_invite&utm_campaign=member_referral"
const NEXT_ACTION_LABELS: Partial<Record<ActivationItem["id"], string>> = {
  whatsapp: "Choose WhatsApp groups",
  profile: "Complete profile",
  event: "Browse events",
  community: "Discover members",
}

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
}: {
  progress: OnboardingProgress | null
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  const items: ActivationItem[] = [
    {
      id: "whatsapp",
      title: "Join IPN on WhatsApp",
      description: "Choose the IPN groups that fit how you want to participate.",
      href: "/dashboard/whatsapp",
      kind: "milestone",
      completed: Boolean(progress?.whatsapp_completed_at),
    },
    {
      id: "profile",
      title: "Complete your profile",
      description: "Add a photo, short bio, and interests so members can find you.",
      href: "/dashboard/profile",
      kind: "milestone",
      completed: Boolean(progress?.profile_completed_at),
    },
    {
      id: "event",
      title: "RSVP for an event",
      description: "Find an upcoming gathering and save your place.",
      href: "/dashboard/events",
      kind: "milestone",
      completed: Boolean(progress?.event_rsvp_completed_at),
    },
    {
      id: "community",
      title: "Discover and connect with members",
      description: "Search the community and start a new connection.",
      href: "/dashboard/directory",
      kind: "milestone",
      completed: Boolean(progress?.connection_request_completed_at),
    },
    {
      id: "conferences",
      title: "Explore Conferences",
      description: "Plan for conferences and find fellow IPN attendees.",
      href: "/dashboard/conferences",
      kind: "suggestion",
      completed: false,
    },
    {
      id: "resources",
      title: "Explore Resources",
      description: "Browse member benefits, articles, and partner organizations.",
      href: "/dashboard/resources",
      kind: "suggestion",
      completed: false,
    },
    {
      id: "invite",
      title: "Invite a friend",
      description: "Share IPN with someone who should be part of the network.",
      kind: "milestone",
      completed: Boolean(progress?.invite_completed_at),
    },
  ]

  const milestoneItems = items.filter((item) => item.kind === "milestone")
  const summary = activationSummary(progress)
  const completedCount = summary.completedCount
  const nextItem = summary.nextMilestone
    ? items.find((item) => item.id === summary.nextMilestone)
    : undefined

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

  const nextAction = nextItem?.id === "invite" ? (
    <button
      type="button"
      onClick={copyInvite}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-semibold text-white hover:bg-ipn-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
    >
      {inviteCopied ? "Invite link copied" : "Share an invite"}
      <ArrowIcon />
    </button>
  ) : nextItem?.href ? (
    <Link
      href={nextItem.href}
      data-analytics-event="curated_click"
      data-analytics-id={`dashboard-activation-${nextItem.id}`}
      data-analytics-label={nextItem.title}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-semibold text-white hover:bg-ipn-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
    >
      {NEXT_ACTION_LABELS[nextItem.id] ?? "Continue"}
      <ArrowIcon />
    </Link>
  ) : null

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
          {completedCount} of {milestoneItems.length} milestones
        </p>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EDE5F7]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-ipn motion-safe:transition-[width] motion-reduce:transition-none"
          style={{ width: `${(completedCount / milestoneItems.length) * 100}%` }}
        />
      </div>

      {nextItem ? (
        <div className="mt-4 rounded-xl border border-[#E0D4F0] bg-[#FAF7FF] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7B4FBF]">Your next step</p>
          <h3 className="mt-1 text-base font-semibold text-[#1A1034]">{nextItem.title}</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{nextItem.description}</p>
          <div className="mt-3">{nextAction}</div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#E0D4F0] bg-[#FAF7FF] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ipn">Milestones complete</p>
          <h3 className="mt-1 text-base font-semibold text-[#1A1034]">You’re ready to make the portal your own.</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">Keep exploring events, people, conferences, and resources at your pace.</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium text-zinc-500">Explore anytime</span>
        <Link href="/dashboard/conferences" className="rounded-full border border-[#E0D4F0] px-3 py-1.5 text-xs font-semibold text-ipn hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-ipn">
          Conferences
        </Link>
        <Link href="/dashboard/resources" className="rounded-full border border-[#E0D4F0] px-3 py-1.5 text-xs font-semibold text-ipn hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-ipn">
          Resources
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="activation-path-details"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-ipn hover:underline focus-visible:outline-2 focus-visible:outline-ipn"
      >
        {expanded ? "Hide activation path" : "View the full activation path"}
      </button>

      {expanded && (
        <ol id="activation-path-details" className="mt-2 divide-y divide-zinc-100 border-t border-zinc-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.completed
                    ? "bg-ipn text-white"
                    : item.kind === "suggestion"
                      ? "border border-[#E0D4F0] bg-white text-[#7B4FBF]"
                      : "bg-ipn-light text-ipn"
                }`}
                aria-label={item.completed ? "Completed" : item.kind === "suggestion" ? "Explore anytime" : `Milestone ${milestoneItems.findIndex((milestone) => milestone.id === item.id) + 1}`}
              >
                {item.completed ? (
                  <CheckIcon />
                ) : item.kind === "suggestion" ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.5 8.5-2.25 4.75L8.5 15.5l2.25-4.75L15.5 8.5Z" />
                    <circle cx="12" cy="12" r="8.5" />
                  </svg>
                ) : (
                  milestoneItems.findIndex((milestone) => milestone.id === item.id) + 1
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-800">{item.title}</span>
                <span className="block text-xs text-zinc-500">
                  {item.kind === "suggestion" ? "Explore anytime · not counted as a milestone" : item.completed ? "Complete" : item.description}
                </span>
              </span>
              {item.id === "invite" ? (
                <button type="button" onClick={copyInvite} className="min-h-11 px-2 text-sm font-semibold text-ipn hover:underline focus-visible:outline-2 focus-visible:outline-ipn">
                  {inviteCopied ? "Copied" : "Share"}
                </button>
              ) : item.href ? (
                <Link href={item.href} aria-label={`Open ${item.title}`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ipn hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-ipn">
                  <ArrowIcon />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
