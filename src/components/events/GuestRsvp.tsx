"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/solid"
import type { PublicRsvpResult } from "@/lib/events/public-rsvp-actions"
import GuestRegistrationLink from "./GuestRegistrationLink"

type Props = {
  slug: string; title: string; date: string
  signedIn?: boolean; registered?: boolean; allowGuestRsvp?: boolean
  onMemberRsvp: () => Promise<PublicRsvpResult>
  onSignInRsvp: (credentials: { email: string; password: string }) => Promise<PublicRsvpResult>
  memberJoinUrl?: string | null; memberCalendarUrl?: string | null
}
type Mode = "guest" | "login" | null

export default function GuestRsvp({ slug, title, date, signedIn = false, registered = false,
  allowGuestRsvp = true, onMemberRsvp, onSignInRsvp, memberJoinUrl, memberCalendarUrl }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [authenticated, setAuthenticated] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const member = (signedIn || authenticated) && !sessionExpired
  const [identity, setIdentity] = useState({ firstName: "", lastName: "", email: "" })
  const [optIn, setOptIn] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [success, setSuccess] = useState<{ joinUrl: string | null; calendarUrl: string } | null>(
    registered ? { joinUrl: memberJoinUrl ?? null, calendarUrl: memberCalendarUrl ?? "" } : null)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusConfirmation = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const firstNameInput = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!mode) return
    const element = dialog.current
    if (!element?.open) element?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    if (mode === "guest") firstNameInput.current?.focus()
    else emailInput.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [mode])

  useEffect(() => {
    if (success && focusConfirmation.current) {
      heading.current?.focus(); focusConfirmation.current = false
    }
  }, [success])

  function openModal(next: Exclude<Mode, null>) {
    if (!mode) opener.current = document.activeElement as HTMLElement | null
    setError(""); setPassword(""); setMode(next)
  }
  function closeModal() {
    dialog.current?.close()
    setMode(null); setPassword("")
    opener.current?.focus()
  }
  function confirm(result: { joinUrl: string | null; calendarUrl: string }) {
    closeModal(); setError(""); focusConfirmation.current = true; setSuccess(result)
  }
  function acceptMemberResult(result: PublicRsvpResult) {
    if (result.needsSignIn) {
      setSessionExpired(true); setAuthenticated(false); openModal("login"); setError(result.error ?? "Please sign in again."); return
    }
    if (result.signedIn) { setAuthenticated(true); setSessionExpired(false) }
    if (result.ok && result.calendarUrl) {
      confirm({ joinUrl: result.joinUrl ?? null, calendarUrl: result.calendarUrl })
    } else {
      if (result.signedIn) closeModal()
      setError(result.error ?? "We couldn’t save your RSVP. Please try again.")
    }
  }
  async function submitGuest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (pending) return
    setPending(true); setError("")
    const form = new FormData(e.currentTarget)
    try {
      const response = await fetch("/api/events/" + encodeURIComponent(slug) + "/rsvp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...identity, marketingOptIn: optIn, website: form.get("website") }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      confirm(result)
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn’t save your RSVP. Please try again.") }
    finally { setPending(false) }
  }
  async function submitLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (pending) return
    setPending(true); setError("")
    try { acceptMemberResult(await onSignInRsvp({ email, password })) }
    catch { setError("We couldn’t sign you in and confirm your RSVP. Please try again.") }
    finally { setPassword(""); setPending(false) }
  }
  async function memberRsvp() {
    if (pending) return
    setPending(true); setError("")
    try { acceptMemberResult(await onMemberRsvp()) }
    catch { setError("We couldn’t save your RSVP. Please try again.") }
    finally { setPending(false) }
  }
  const button = "min-h-11 rounded-lg bg-ipn px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ipn-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn disabled:opacity-50"
  const secondary = "min-h-11 rounded-lg border border-ipn px-5 py-2.5 text-sm font-medium text-ipn hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn disabled:opacity-50"
  const field = "mt-1 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-ipn focus:outline-none focus:ring-2 focus:ring-ipn/20"

  return <section aria-label="Event RSVP" className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
    {success ? <>
      <div className="flex items-start gap-3"><CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true"/><div>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold text-zinc-900 outline-none">You’re registered</h2>
        <p className="mt-1 text-sm text-zinc-600">Your RSVP is complete.{!member && " No account needed."}</p>
      </div></div>
      <p className="mt-4 text-sm text-zinc-700">{date}</p>
      {!member && <p className="mt-2 text-sm text-zinc-600">Check your email for confirmation and joining details. Keep the link to view or cancel your RSVP.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a className={button} href={success.calendarUrl} target="_blank" rel="noreferrer">Add to calendar</a>
        {success.joinUrl ? <a href={success.joinUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn underline">Join event</a> : <p className="text-sm text-zinc-600">Joining details will be available in your event access link.</p>}
      </div>
      {!member && <div className="mt-5 border-t border-zinc-200 pt-5">
          <h3 className="text-sm font-semibold">Want to stay connected?</h3>
          <p className="mt-1 text-sm text-zinc-600">Join IPN for upcoming events and a community of students and early-career professionals.</p>
          <GuestRegistrationLink identity={identity} slug={slug}/>
      </div>}
      {member && <Link className="mt-3 inline-flex min-h-11 items-center text-sm text-ipn" href={"/dashboard/events/" + slug}>Open in portal →</Link>}
    </> : member ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-base font-semibold">RSVP for this event</h2><p className="mt-1 text-sm text-zinc-600">You’re signed in. Reserve your place with one click.</p></div>
      <button className={button} disabled={pending} onClick={memberRsvp}>{pending ? "Saving…" : "RSVP"}</button>
    </div> : <>
      <h2 className="text-base font-semibold">RSVP for this event</h2>
      <p className="mt-1 text-sm text-zinc-600">{allowGuestRsvp ? "Have an IPN account? Sign in and we’ll confirm your RSVP. You can also RSVP without an account." : "Sign in to your IPN account and we’ll confirm your RSVP."}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button className={button} onClick={() => openModal("login")}>Sign in &amp; RSVP</button>
        {allowGuestRsvp && <button className={secondary} onClick={() => openModal("guest")}>RSVP without an account</button>}
      </div>
    </>}
    {error && !mode && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

    <dialog ref={dialog} aria-labelledby={mode === "login" ? "member-rsvp-title" : "guest-rsvp-title"}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/50"
      onCancel={e => { e.preventDefault(); if (!pending) closeModal() }}
      onClick={e => {
        const bounds = e.currentTarget.getBoundingClientRect()
        const outside = e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom
        if (e.target === e.currentTarget && outside && !pending) closeModal()
      }}
      onKeyDown={e => {
        if (e.key !== "Tab") return
        const controls = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')].filter(el => el.tabIndex >= 0 && el.getClientRects().length)
        const first = controls[0], last = controls.at(-1)
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }}>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h2 id={mode === "login" ? "member-rsvp-title" : "guest-rsvp-title"} className="text-xl font-semibold">{mode === "login" ? "Sign in & RSVP" : "RSVP for this event"}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{title}</p></div>
          <button type="button" aria-label="Close RSVP dialog" disabled={pending} onClick={closeModal} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-ipn disabled:opacity-50"><XMarkIcon className="h-5 w-5" aria-hidden="true"/></button>
        </div>
        {mode === "login" ? <form onSubmit={submitLogin} className="space-y-4">
          <p id="member-rsvp-explanation" className="text-sm leading-6 text-zinc-600">Sign in with your IPN account. We’ll automatically RSVP you for this event.</p>
          <label className="block text-sm font-medium">Email<input ref={emailInput} name="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={pending} className={field}/></label>
          <label className="block text-sm font-medium">Password<input name="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={1024} required disabled={pending} className={field}/></label>
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-medium text-ipn underline">Forgot password?</Link>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={pending} className={button + " w-full"}>{pending ? "Signing in & confirming…" : "Sign in & RSVP"}</button>
          {allowGuestRsvp && <p className="text-center text-sm text-zinc-600">No account needed. <button type="button" disabled={pending} onClick={() => openModal("guest")} className="inline-flex min-h-11 items-center font-medium text-ipn underline">RSVP without an account</button></p>}
        </form> : mode === "guest" ? <form onSubmit={submitGuest} className="space-y-4">
          <p className="text-sm text-zinc-600">Reserve your place. No IPN account is required.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">First name<input ref={firstNameInput} name="firstName" autoComplete="given-name" maxLength={80} required disabled={pending} value={identity.firstName} onChange={e => setIdentity({ ...identity, firstName: e.target.value })} className={field}/></label>
            <label className="block text-sm font-medium">Last name<input name="lastName" autoComplete="family-name" maxLength={80} required disabled={pending} value={identity.lastName} onChange={e => setIdentity({ ...identity, lastName: e.target.value })} className={field}/></label>
          </div>
          <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} value={identity.email} onChange={e => setIdentity({ ...identity, email: e.target.value })} className={field}/></label>
          <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
          <label className="flex min-h-11 items-start gap-3 text-sm text-zinc-600"><input name="marketingOptIn" type="checkbox" disabled={pending} checked={optIn} onChange={e => setOptIn(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#664fa1]"/>Email me an invitation to join IPN after this event.</label>
          <p className="text-xs leading-5 text-zinc-500">We’ll email your confirmation and event reminders. An IPN account is optional.</p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={pending} className={button + " w-full"}>{pending ? "Saving your RSVP…" : "Confirm RSVP"}</button>
          <p className="text-center text-sm text-zinc-600">Already have an IPN account? <button type="button" disabled={pending} onClick={() => openModal("login")} className="inline-flex min-h-11 items-center font-medium text-ipn underline">Sign in &amp; RSVP</button></p>
        </form> : null}
      </div>
    </dialog>
  </section>
}
