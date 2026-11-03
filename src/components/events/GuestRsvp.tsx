"use client"
import { useRef,useState } from "react"
import Link from "next/link"
import { CheckCircleIcon } from "@heroicons/react/24/solid"
import MembershipForm from "./MembershipForm"
type Props={slug:string;title:string;date:string;signedIn?:boolean;registered?:boolean;onMemberRsvp?:()=>Promise<{error?:string}>;memberJoinUrl?:string|null;memberCalendarUrl?:string|null}
export default function GuestRsvp({slug,title,date,signedIn=false,registered=false,onMemberRsvp,memberJoinUrl,memberCalendarUrl}:Props) {
  const [open,setOpen]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState("")
  const [identity,setIdentity]=useState({firstName:"",lastName:"",email:""})
  const [success,setSuccess]=useState<{joinUrl:string|null;calendarUrl:string;emailStatus?:string}|null>(registered ? {joinUrl:memberJoinUrl??null,calendarUrl:memberCalendarUrl??""}:null)
  const [joining,setJoining]=useState(false)
  const heading=useRef<HTMLHeadingElement>(null)
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(pending)return
    setPending(true);setError("")
    const data=new FormData(e.currentTarget)
    const who={firstName:String(data.get("firstName")??""),lastName:String(data.get("lastName")??""),email:String(data.get("email")??"")}
    setIdentity(who)
    try {
      const response=await fetch("/api/events/"+encodeURIComponent(slug)+"/rsvp",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...who,marketingOptIn:data.get("marketingOptIn")==="on",website:data.get("website")})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error)
      setSuccess(result);requestAnimationFrame(()=>heading.current?.focus())
    } catch(e) {setError(e instanceof Error ? e.message : "We couldn't save your RSVP. Please try again.")}
    finally {setPending(false)}
  }
  async function memberRsvp() {
    if(!onMemberRsvp)return
    setPending(true);setError("")
    try {const result=await onMemberRsvp();if(result.error)throw new Error(result.error);setSuccess({joinUrl:memberJoinUrl??null,calendarUrl:memberCalendarUrl??""})}
    catch(e){setError(e instanceof Error?e.message:"Please try again.")}
    finally{setPending(false)}
  }
  const button="min-h-11 rounded-lg bg-ipn px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:opacity-50"
  const field="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-ipn focus:outline-none focus:ring-2 focus:ring-ipn/20"
  return <section aria-label="Event RSVP" className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
    {success ? <>
      <div className="flex items-start gap-3"><CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true"/><div>
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold text-zinc-900 outline-none">You’re registered</h2>
        <p className="mt-1 text-sm text-zinc-600">Your RSVP is complete.{!signedIn && " No account needed."}</p>
      </div></div>
      <p className="mt-4 text-sm text-zinc-700">{date}</p>
      {!signedIn && <p className="mt-2 text-sm text-zinc-600">Check your email for confirmation and joining details. Keep the link to view or cancel your RSVP.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a className={button} href={success.calendarUrl} target="_blank" rel="noreferrer">Add to calendar</a>
        {success.joinUrl ? <a href={success.joinUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-ipn underline">Join event</a> : <p className="text-sm text-zinc-600">Joining details will be available in your event access link.</p>}
      </div>
      {!signedIn && <div className="mt-5 border-t border-zinc-200 pt-5">
        {joining ? <MembershipForm initial={identity} eventSlug={slug}/> : <>
          <h3 className="text-sm font-semibold">Want to stay connected?</h3>
          <p className="mt-1 text-sm text-zinc-600">Join IPN for upcoming events and a community of students and early-career professionals.</p>
          <button onClick={()=>setJoining(true)} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ipn">Join IPN free → <span className="ml-2 font-normal text-zinc-500">(optional)</span></button>
        </>}
      </div>}
      {signedIn && <Link className="mt-3 inline-flex min-h-11 items-center text-sm text-ipn" href={"/dashboard/events/"+slug}>Open in portal →</Link>}
    </> : signedIn ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-sm font-medium">RSVP for this event</h2><p className="mt-1 text-sm text-zinc-600">You’re signed in. Reserve your place with one click.</p></div>
      <button className={button} disabled={pending} onClick={memberRsvp}>{pending?"Saving…":"RSVP free"}</button>
    </div> : !open ? <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-base font-semibold">RSVP free</h2><p className="mt-1 text-sm text-zinc-600">No account required.</p></div>
      <div className="flex items-center gap-3"><Link className="inline-flex min-h-11 items-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-700" href={"/login?next="+encodeURIComponent("/events/"+slug)}>Sign in</Link>
      <button className={button} onClick={()=>{setOpen(true);requestAnimationFrame(()=>document.getElementById("guest-first-name")?.focus())}}>RSVP free</button></div>
    </div> : <form onSubmit={submit} className="space-y-4">
      <div><h2 className="text-lg font-semibold">RSVP for this event</h2><p className="mt-1 text-sm text-zinc-600">{title}</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">First name<input id="guest-first-name" name="firstName" autoComplete="given-name" maxLength={80} required className={field+" mt-1"}/></label>
        <label className="block text-sm font-medium">Last name<input name="lastName" autoComplete="family-name" maxLength={80} required className={field+" mt-1"}/></label>
      </div>
      <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="email" maxLength={254} required className={field+" mt-1"}/></label>
      <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
      <label className="flex min-h-11 items-start gap-3 text-sm text-zinc-600"><input name="marketingOptIn" type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#664fa1]"/>Email me about future IPN events and opportunities.</label>
      <p className="text-xs leading-5 text-zinc-500">We’ll email your confirmation and event reminders. An IPN account is optional.</p>
      <button disabled={pending} className={button+" w-full"}>{pending?"Saving your RSVP…":"Confirm RSVP"}</button>
      <p className="text-center text-sm text-zinc-500">Already a member? <Link className="font-medium text-ipn" href={"/login?next="+encodeURIComponent("/events/"+slug)}>Sign in</Link></p>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
  </section>
}
