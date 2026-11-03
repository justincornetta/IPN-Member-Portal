"use client"
import {useState} from "react"
import Link from "next/link"
import {hostedGuestPreview} from "@/lib/guest-events/preview-mode"
export default function MembershipForm({initial={firstName:"",lastName:"",email:""},eventSlug=""}:{initial?:{firstName:string;lastName:string;email:string};eventSlug?:string}) {
  const [values,setValues]=useState(initial)
  const [pending,setPending]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState("")
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();if(pending)return;setPending(true);setError("")
    const d=new FormData(e.currentTarget)
    setValues({firstName:String(d.get("firstName")??""),lastName:String(d.get("lastName")??""),email:String(d.get("email")??"")})
    try {
      const r=await fetch("/api/events/membership",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:d.get("firstName"),lastName:d.get("lastName"),email:d.get("email"),eventSlug,website:d.get("website")})})
      const result=await r.json();if(!r.ok)throw new Error(result.error);setSent(true)
    }catch(e){setError(e instanceof Error?e.message:"Please try again.")}finally{setPending(false)}
  }
  const cls="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
  if(sent)return <div role="status"><h2 className="text-xl font-semibold">Check your email</h2><p className="mt-3 text-sm leading-6 text-zinc-600">{hostedGuestPreview()?"Test complete: no email was sent and no account was created. In the live flow, the email link would verify your address and finish account setup.":"Use the secure link we sent to finish joining or sign in to your existing account."} {eventSlug ? "Your event RSVP is already confirmed." : "You can add your profile details after signing in."}</p>{!hostedGuestPreview()&&<p className="mt-2 text-sm text-zinc-500">The link expires in one hour.</p>}<button type="button" onClick={()=>setSent(false)} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-ipn underline">Request another link</button></div>
  return <form onSubmit={submit} className="space-y-4">
    <div><h2 className="text-xl font-semibold">Join IPN — it’s free</h2><p className="mt-2 text-sm text-zinc-600">Connect with the community and discover upcoming events.</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">First name<input name="firstName" defaultValue={values.firstName} autoComplete="given-name" maxLength={80} required className={cls}/></label><label className="text-sm font-medium">Last name<input name="lastName" defaultValue={values.lastName} autoComplete="family-name" maxLength={80} required className={cls}/></label></div>
    <label className="block text-sm font-medium">Email<input name="email" defaultValue={values.email} type="email" autoComplete="email" maxLength={254} required className={cls}/></label>
    <div className="hidden" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" aria-label="Website"/></div>
    <button disabled={pending} className="min-h-11 w-full rounded-lg bg-ipn px-4 py-2.5 text-sm font-medium text-white hover:bg-ipn-dark disabled:opacity-50">{pending?"Sending…":"Email me a sign-up link"}</button>
    <p className="text-sm leading-6 text-zinc-600">Verify your email to activate your account. Add profile details later.</p>
    <p className="text-sm text-zinc-500">Already have an account? <Link href="/login" className="font-medium text-ipn">Sign in</Link></p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>
}
