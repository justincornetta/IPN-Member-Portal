"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { markGettingStartedSuccessSeen, saveOnboardingFlowProgress } from "@/lib/onboarding/actions"
import { useProductTour } from "@/components/product-tour/ProductTourProvider"
import type { OnboardingProgress } from "@/lib/onboarding/progress"
import { activationSummary, isProfileMilestoneComplete } from "./activation-model"

type MilestoneId = "whatsapp" | "profile" | "tour" | "participate"
type ActivationItem = { id: MilestoneId; title: string; description: string; href?: string; completed: boolean }

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
}

function ArrowIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-5-5 5 5-5 5" /></svg>
}

export default function ActivationChecklist({ progress, profileCompletedCount, profileTotalCount }: { progress: OnboardingProgress | null; profileCompletedCount: number; profileTotalCount: number }) {
  const router = useRouter()
  const { startOrResume } = useProductTour()
  const successRecorded = useRef(false)
  const [participationOpen, setParticipationOpen] = useState(false)
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false)
  const [whatsappConfirmationError, setWhatsappConfirmationError] = useState(false)
  const [completionError, setCompletionError] = useState(false)
  const [isConfirmingWhatsApp, startWhatsAppConfirmation] = useTransition()
  const [isDismissing, startDismissal] = useTransition()
  const whatsappCompleted = Boolean(progress?.whatsapp_completed_at) || whatsappConfirmed
  const profileCompleted = isProfileMilestoneComplete(progress?.profile_completed_at, profileCompletedCount, profileTotalCount)

  const items: ActivationItem[] = [
    { id: "whatsapp", title: whatsappCompleted ? "Joined IPN on WhatsApp" : "Join IPN on WhatsApp", description: whatsappCompleted ? "Community access confirmed" : "Choose groups or confirm you already joined", href: "/onboarding/whatsapp?motion=editorial", completed: whatsappCompleted },
    { id: "profile", title: "Complete your profile", description: `${profileCompletedCount} of ${profileTotalCount} profile requirements`, href: "/dashboard/profile", completed: profileCompleted },
    { id: "tour", title: "Complete the portal tour", description: "Learn where to find the essentials", completed: Boolean(progress?.product_tour_completed_at) },
    { id: "participate", title: "Participate in IPN", description: "Attend an event or connect with a member", completed: Boolean(progress?.event_rsvp_completed_at || progress?.connection_request_completed_at) },
  ]
  const summary = activationSummary({ whatsapp_completed_at: whatsappCompleted ? "complete" : null, whatsapp_current_step: progress?.whatsapp_current_step ?? null, profile_completed_at: profileCompleted ? "complete" : null, product_tour_completed_at: progress?.product_tour_completed_at ?? null, event_rsvp_completed_at: progress?.event_rsvp_completed_at ?? null, connection_request_completed_at: progress?.connection_request_completed_at ?? null })
  const allCompleted = summary.completedCount === summary.totalCount

  useEffect(() => {
    if (!allCompleted || successRecorded.current) return
    successRecorded.current = true
    void markGettingStartedSuccessSeen().then((result) => {
      if (result.error) setCompletionError(true)
    })
  }, [allCompleted])

  function confirmWhatsAppMembership() {
    if (isConfirmingWhatsApp || whatsappCompleted) return
    setWhatsappConfirmationError(false)
    startWhatsAppConfirmation(async () => {
      const result = await saveOnboardingFlowProgress({ flow: "whatsapp", currentStep: "self_attested", complete: true })
      if (result.error) { setWhatsappConfirmationError(true); return }
      setWhatsappConfirmed(true)
      router.refresh()
    })
  }

  function dismissSuccess() {
    setCompletionError(false)
    startDismissal(async () => {
      const result = await markGettingStartedSuccessSeen()
      if (result.error) { setCompletionError(true); return }
      router.refresh()
    })
  }

  if (allCompleted) {
    return (
      <section className="flex min-h-44 items-center rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5 shadow-sm sm:p-6" aria-labelledby="getting-started-success">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"><CheckIcon className="h-6 w-6" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Onboarding complete</p><h2 id="getting-started-success" className="mt-1 text-xl font-semibold text-zinc-900">You&apos;re all set</h2><p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">Your profile is ready and you know your way around IPN. Keep exploring events and meeting members.</p></div>
          </div>
          <button type="button" onClick={dismissSuccess} disabled={isDismissing} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60 sm:min-h-0">{isDismissing ? "Saving…" : "Continue to IPN"}</button>
        </div>
        {completionError && <p className="mt-2 text-xs text-red-700" role="alert">We couldn&apos;t save this completion yet. Please try again.</p>}
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-ipn/15 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="activation-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="activation-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-ipn">Getting Started</h2><p className="mt-1 text-sm text-zinc-500">Four quick steps to feel at home in the member portal.</p></div>
        <p className="whitespace-nowrap rounded-full bg-ipn-light px-2.5 py-1 text-xs font-semibold text-ipn">{summary.completedCount} of {items.length} complete</p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#EDE5F7]" aria-hidden="true"><div className="h-full rounded-full bg-ipn transition-[width]" style={{ width: `${(summary.completedCount / items.length) * 100}%` }} /></div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => {
          const lead = <><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${item.completed ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-ipn-light text-ipn"}`}>{item.completed ? <CheckIcon /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5 text-zinc-900">{item.title}</span><span className="mt-1 block text-xs leading-5 text-zinc-500">{item.description}</span></span></>
          const classes = `flex min-h-28 items-start gap-3 rounded-lg border p-3 text-left transition ${item.completed ? "border-emerald-100 bg-emerald-50/40" : "border-zinc-200 bg-white hover:border-ipn/30 hover:bg-[#FAF7FF]"}`
          if (item.id === "whatsapp") return <li key={item.id} className={`${classes} flex-col`}><Link href={item.href!} className="flex w-full items-start gap-3">{lead}</Link>{!item.completed && <button type="button" onClick={confirmWhatsAppMembership} disabled={isConfirmingWhatsApp} className="ml-11 inline-flex min-h-8 items-center self-start rounded-md border border-ipn/20 px-2.5 py-1 text-[11px] font-semibold text-ipn hover:bg-ipn-light">{isConfirmingWhatsApp ? "Saving…" : "I’m already in"}</button>}{whatsappConfirmationError && <span className="sr-only" role="alert">We couldn’t save that confirmation. Try again.</span>}</li>
          if (item.id === "tour") return <li key={item.id}><button type="button" onClick={startOrResume} className={`${classes} w-full`}>{lead}<ArrowIcon /></button></li>
          if (item.id === "participate") return <li key={item.id} className="relative"><button type="button" onClick={() => setParticipationOpen((open) => !open)} aria-expanded={participationOpen} className={`${classes} w-full`}>{lead}<ArrowIcon /></button>{participationOpen && <div className="absolute inset-x-0 top-full z-20 mt-1 grid gap-1 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg"><Link href="/dashboard/events" className="rounded-md px-3 py-2 text-xs font-semibold text-ipn hover:bg-ipn-light">RSVP for an event</Link><Link href="/dashboard/directory" className="rounded-md px-3 py-2 text-xs font-semibold text-ipn hover:bg-ipn-light">Connect with a member</Link></div>}</li>
          return <li key={item.id}><Link href={item.href!} className={classes}>{lead}<ArrowIcon /></Link></li>
        })}
      </ol>
    </section>
  )
}
