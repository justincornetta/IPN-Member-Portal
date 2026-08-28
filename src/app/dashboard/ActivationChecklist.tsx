"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  CheckIcon,
  GlobeAltIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline"
import {
  markGettingStartedSuccessSeen,
  saveOnboardingFlowProgress,
} from "@/lib/onboarding/actions"
import { useProductTour } from "@/components/product-tour/ProductTourProvider"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import {
  activationSummary,
  isProfileMilestoneComplete,
} from "./activation-model"

type MilestoneId = "whatsapp" | "profile" | "tour" | "participate"
type ActivationItem = {
  id: MilestoneId
  title: string
  description: string
  href?: string
  completed: boolean
}

export default function ActivationChecklist({
  userId,
  progress,
  profileCompletedCount,
  profileTotalCount,
  participationCompleted,
}: {
  userId: string
  progress: OnboardingProgress | null
  profileCompletedCount: number
  profileTotalCount: number
  participationCompleted?: boolean
}) {
  const router = useRouter()
  const { progress: productTourProgress, startOrResume } = useProductTour()
  const successRecorded = useRef(false)
  const [completionError, setCompletionError] = useState(false)
  const successStorageKey = `ipn_getting_started_success_seen_${userId}`
  const [successDismissed, setSuccessDismissed] = useState(
    Boolean(progress?.getting_started_success_seen_at),
  )
  const [whatsappChoice, setWhatsappChoice] = useState<
    "self_attested" | "not_interested" | null
  >(null)
  const [whatsappConfirmationError, setWhatsappConfirmationError] = useState(false)
  const [participationExpanded, setParticipationExpanded] = useState(false)
  const [isDismissing, startDismissal] = useTransition()
  const [isConfirmingWhatsApp, startWhatsAppConfirmation] = useTransition()
  const profileCompleted = isProfileMilestoneComplete(
    progress?.profile_completed_at,
    profileCompletedCount,
    profileTotalCount,
  )
  const participationMilestoneComplete = participationCompleted ?? Boolean(
    progress?.event_rsvp_completed_at || progress?.connection_request_completed_at,
  )

  const items: ActivationItem[] = [
    {
      id: "whatsapp",
      title: "Join IPN on WhatsApp",
      description: "Choose the groups that match your interests.",
      href: "/onboarding/whatsapp?motion=editorial",
      completed: Boolean(progress?.whatsapp_completed_at) || whatsappChoice !== null,
    },
    {
      id: "profile",
      title: "Complete your profile",
      description: "Add your background and interests to connect with the right people and events.",
      href: "/dashboard/profile",
      completed: profileCompleted,
    },
    {
      id: "tour",
      title: "Take the portal tour",
      description: "Learn where to find the community, events, and resources.",
      completed:
        Boolean(progress?.product_tour_completed_at) ||
        productTourProgress?.status === "completed",
    },
    {
      id: "participate",
      title: "Participate in IPN",
      description: "Attend an event, RSVP to a conference, or connect with another member.",
      completed: participationMilestoneComplete,
    },
  ]
  const summary = activationSummary({
    whatsapp_completed_at:
      progress?.whatsapp_completed_at ?? (whatsappChoice ? "complete" : null),
    whatsapp_current_step: progress?.whatsapp_current_step ?? null,
    profile_completed_at: profileCompleted ? "complete" : null,
    product_tour_completed_at:
      progress?.product_tour_completed_at ??
      (productTourProgress?.status === "completed" ? "complete" : null),
    event_rsvp_completed_at:
      progress?.event_rsvp_completed_at ??
      (participationMilestoneComplete ? "complete" : null),
    connection_request_completed_at:
      progress?.connection_request_completed_at ?? null,
    participation_completed: participationMilestoneComplete,
  })
  const allCompleted = summary.completedCount === summary.totalCount
  const nextItem = items.find((item) => !item.completed) ?? items[items.length - 1]
  const displayedItem = nextItem
  const displayedItemIndex = items.findIndex((item) => item.id === displayedItem.id)
  const displayedItemNumber = displayedItemIndex + 1

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        progress?.getting_started_success_seen_at ||
        window.localStorage.getItem(successStorageKey) === "true"
      ) {
        setSuccessDismissed(true)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [progress?.getting_started_success_seen_at, successStorageKey])

  useEffect(() => {
    if (!allCompleted || successRecorded.current) return
    successRecorded.current = true
    void markGettingStartedSuccessSeen().then((result) => {
      if (result.error) setCompletionError(true)
      else if (result.fallback) window.localStorage.setItem(successStorageKey, "true")
    })
  }, [allCompleted, successStorageKey])

  function dismissSuccess() {
    setCompletionError(false)
    startDismissal(async () => {
      const result = await markGettingStartedSuccessSeen()
      if (result.error) {
        setCompletionError(true)
        return
      }
      window.localStorage.setItem(successStorageKey, "true")
      setSuccessDismissed(true)
      router.refresh()
    })
  }

  function completeWhatsAppChoice(
    choice: "self_attested" | "not_interested",
  ) {
    if (isConfirmingWhatsApp || whatsappChoice) return
    setWhatsappConfirmationError(false)
    startWhatsAppConfirmation(async () => {
      const result = await saveOnboardingFlowProgress({
        flow: "whatsapp",
        currentStep: choice,
        complete: true,
      })
      if (result.error) {
        setWhatsappConfirmationError(true)
        return
      }
      setWhatsappChoice(choice)
      router.refresh()
    })
  }

  // Keep the guided tour as the only onboarding surface while it is active.
  // This prevents a resumed or retaken tour from reopening the checklist behind
  // the tour dialog, without changing any durable milestone completion state.
  if (productTourProgress?.status === "active") return null

  if (allCompleted && successDismissed) return null

  if (allCompleted) {
    return (
      <section
        className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
        aria-labelledby="getting-started-success"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Onboarding complete
            </p>
            <h2
              id="getting-started-success"
              className="mt-1 text-xl font-semibold text-zinc-900"
            >
              You&apos;re all set
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
              Your profile is ready and you know your way around IPN.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissSuccess}
            disabled={isDismissing}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {isDismissing ? "Saving…" : "Continue to IPN"}
          </button>
        </div>
        {completionError && (
          <p className="mt-2 text-xs text-red-700" role="alert">
            We couldn&apos;t save this completion yet. Please try again.
          </p>
        )}
      </section>
    )
  }

  const actionClass =
    "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ipn px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ipn-dark sm:w-auto"

  return (
      <section
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      aria-labelledby="activation-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="activation-heading"
          className="text-lg font-semibold text-zinc-900 sm:text-xl"
        >
          Continue getting started
        </h2>
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-ipn">{summary.completedCount}</span>
          {" "}of {items.length} complete
        </p>
      </div>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EDE5F7]"
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={summary.completedCount}
      >
        <div
          className="h-full rounded-full bg-ipn transition-[width]"
          style={{ width: `${(summary.completedCount / items.length) * 100}%` }}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              displayedItem.completed ? "bg-ipn text-white" : "bg-ipn-light text-ipn"
            }`}
            aria-label={`${displayedItemNumber}. ${displayedItem.title}: ${displayedItem.completed ? "completed" : "current"}`}
          >
            {displayedItem.completed ? (
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
            ) : (
              displayedItemNumber
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-zinc-900">{displayedItem.title}</h3>
            <p className="mt-0.5 text-xs leading-5 text-zinc-500 sm:text-sm">
              {displayedItem.description}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {displayedItem.id === "tour" ? (
              <button type="button" onClick={startOrResume} className={actionClass}>
                Continue setup
              </button>
            ) : displayedItem.id === "participate" ? (
              <button
                type="button"
                onClick={() => setParticipationExpanded((expanded) => !expanded)}
                aria-expanded={participationExpanded}
                aria-controls="participation-options"
                className={actionClass}
              >
                {participationExpanded ? "Hide options" : "Continue setup"}
              </button>
            ) : (
              <Link href={displayedItem.href ?? "/dashboard"} className={actionClass}>
                Continue setup
              </Link>
            )}
          </div>
          {displayedItem.id === "whatsapp" && !displayedItem.completed && (
            <div className="flex min-h-9 items-center justify-center gap-3 text-xs font-semibold sm:justify-end">
              <button
                type="button"
                onClick={() => completeWhatsAppChoice("self_attested")}
                disabled={isConfirmingWhatsApp}
                className="text-ipn hover:underline disabled:opacity-60"
              >
                {isConfirmingWhatsApp ? "Saving…" : "I’m already in"}
              </button>
              <span className="text-zinc-300" aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => completeWhatsAppChoice("not_interested")}
                disabled={isConfirmingWhatsApp}
                className="text-zinc-500 hover:text-ipn hover:underline disabled:opacity-60"
              >
                Not interested
              </button>
            </div>
          )}
        </div>
      </div>
      {displayedItem.id === "participate" && participationExpanded && (
        <div
          id="participation-options"
          className="mt-4 border-t border-zinc-100 pt-4"
        >
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-zinc-900">Choose how you’d like to participate</h3>
            <p className="mt-0.5 text-xs leading-5 text-zinc-500">
              Completing any one of these actions finishes getting started.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href="/dashboard/events"
              className="group flex min-h-20 items-start gap-3 rounded-lg border border-zinc-200 p-3 transition hover:border-ipn/30 hover:bg-ipn-light/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
            >
              <CalendarDaysIcon className="mt-0.5 h-5 w-5 flex-none text-ipn" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-zinc-900 group-hover:text-ipn">Attend an event</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500">Browse events and RSVP.</span>
              </span>
            </Link>
            <Link
              href="/dashboard/conferences"
              className="group flex min-h-20 items-start gap-3 rounded-lg border border-zinc-200 p-3 transition hover:border-ipn/30 hover:bg-ipn-light/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
            >
              <GlobeAltIcon className="mt-0.5 h-5 w-5 flex-none text-ipn" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-zinc-900 group-hover:text-ipn">RSVP to a conference</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500">See upcoming conferences.</span>
              </span>
            </Link>
            <Link
              href="/dashboard/directory"
              className="group flex min-h-20 items-start gap-3 rounded-lg border border-zinc-200 p-3 transition hover:border-ipn/30 hover:bg-ipn-light/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
            >
              <UserPlusIcon className="mt-0.5 h-5 w-5 flex-none text-ipn" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold text-zinc-900 group-hover:text-ipn">Connect with a member</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500">Explore the community.</span>
              </span>
            </Link>
          </div>
        </div>
      )}
      {whatsappConfirmationError && (
        <p className="mt-3 text-right text-xs text-red-700" role="alert">
          We couldn’t save that confirmation. Try again.
        </p>
      )}
    </section>
  )
}
