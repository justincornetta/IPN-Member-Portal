"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  completeOnboardingStep,
  saveOnboardingFlowProgress,
} from "@/lib/onboarding/actions"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import { activationSummary } from "./activation-model"

type MilestoneId = "whatsapp" | "profile" | "event" | "community" | "invite"

type ActivationItem = {
  id: MilestoneId
  title: string
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
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false)
  const [whatsappConfirmationError, setWhatsappConfirmationError] = useState(false)
  const [isConfirmingWhatsApp, startWhatsAppConfirmation] = useTransition()
  const whatsappCompleted = Boolean(progress?.whatsapp_completed_at) || whatsappConfirmed

  const items: ActivationItem[] = [
    {
      id: "whatsapp",
      title: whatsappCompleted ? "Joined IPN on WhatsApp" : "Join IPN on WhatsApp",
      href: "/onboarding/whatsapp?motion=editorial",
      completed: whatsappCompleted,
    },
    {
      id: "profile",
      title: "Complete your profile",
      href: "/dashboard/profile",
      completed: Boolean(progress?.profile_completed_at),
    },
    {
      id: "event",
      title: "RSVP for an event",
      href: "/dashboard/events",
      completed: Boolean(progress?.event_rsvp_completed_at),
    },
    {
      id: "community",
      title: "Discover and connect with members",
      href: "/dashboard/directory",
      completed: Boolean(progress?.connection_request_completed_at),
    },
    {
      id: "invite",
      title: "Invite a friend",
      completed: Boolean(progress?.invite_completed_at),
    },
  ]

  const summary = activationSummary({
    whatsapp_completed_at: whatsappCompleted ? "complete" : null,
    whatsapp_current_step: progress?.whatsapp_current_step ?? null,
    profile_completed_at: progress?.profile_completed_at ?? null,
    event_rsvp_completed_at: progress?.event_rsvp_completed_at ?? null,
    connection_request_completed_at: progress?.connection_request_completed_at ?? null,
    invite_completed_at: progress?.invite_completed_at ?? null,
  })
  const completedCount = summary.completedCount

  function confirmWhatsAppMembership() {
    if (isConfirmingWhatsApp || whatsappCompleted) return
    setWhatsappConfirmationError(false)

    startWhatsAppConfirmation(async () => {
      const result = await saveOnboardingFlowProgress({
        flow: "whatsapp",
        currentStep: "self_attested",
        complete: true,
      })

      if (result.error) {
        setWhatsappConfirmationError(true)
        return
      }

      setWhatsappConfirmed(true)
      router.refresh()
    })
  }

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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ipn">Getting Started</p>
          <h2 id="activation-heading" className="mt-1 text-lg font-semibold text-[#1A1034]">
            Steps to get started
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
          const lead = (
            <>
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.completed
                    ? "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    : "bg-ipn-light text-ipn"
                }`}
                aria-label={item.completed ? "Completed" : `Milestone ${index + 1}`}
              >
                {item.completed ? <CheckIcon /> : index + 1}
              </span>
              {item.id === "whatsapp" ? (
                <Link
                  href={item.href!}
                  aria-label={item.completed ? "Review IPN WhatsApp groups" : "View IPN WhatsApp groups"}
                  data-analytics-event="curated_click"
                  data-analytics-id="dashboard-activation-whatsapp"
                  data-analytics-label="Join IPN on WhatsApp"
                  className="min-w-0 flex-1 text-sm font-semibold text-zinc-800 transition hover:text-ipn hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
                >
                  {item.title}
                  {isNext && !item.completed && <span className="sr-only"> (Next step)</span>}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-800">
                  {item.title}
                  {isNext && !item.completed && <span className="sr-only"> (Next step)</span>}
                </span>
              )}
            </>
          )

          return (
            <li
              key={item.id}
              className={`border-b border-[#EEE9F3] last:border-b-0 ${isNext && !item.completed ? "bg-[#FAF7FF]" : "bg-white"}`}
            >
              {item.id === "whatsapp" ? (
                <>
                  <div className="flex min-h-14 items-center gap-3 px-3 py-2">
                    {lead}
                    {!item.completed && (
                      <button
                        type="button"
                        onClick={confirmWhatsAppMembership}
                        disabled={isConfirmingWhatsApp}
                        data-analytics-event="curated_click"
                        data-analytics-id="dashboard-activation-whatsapp-self-attest"
                        data-analytics-label="Confirm WhatsApp membership"
                        className="shrink-0 rounded-lg border border-ipn/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-ipn transition hover:border-ipn/40 hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn disabled:cursor-wait disabled:opacity-60"
                      >
                        {isConfirmingWhatsApp ? "Saving…" : "I’m already in"}
                      </button>
                    )}
                  </div>
                  {whatsappConfirmationError && (
                    <p className="border-t border-[#EEE9F3] px-3 py-2 text-xs text-red-700" role="alert">
                      We couldn’t save that confirmation. Try again.
                    </p>
                  )}
                </>
              ) : item.id === "invite" ? (
                <button
                  type="button"
                  onClick={copyInvite}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[#FAF7FF] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ipn"
                >
                  {lead}
                  {inviteCopied && (
                    <span className="shrink-0 text-xs font-semibold text-ipn" role="status">
                      Copied
                    </span>
                  )}
                  <ArrowIcon />
                </button>
              ) : (
                <Link
                  href={item.href!}
                  aria-label={`Open ${item.title}`}
                  data-analytics-event="curated_click"
                  data-analytics-id={`dashboard-activation-${item.id}`}
                  data-analytics-label={item.title}
                  className="flex min-h-14 items-center gap-3 px-3 py-2 transition hover:bg-[#FAF7FF] focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ipn"
                >
                  {lead}
                  {item.id === "profile" && (
                    <span className="shrink-0 text-xs font-semibold text-ipn">
                      {profileCompletedCount}/{profileTotalCount}
                    </span>
                  )}
                  <ArrowIcon />
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
