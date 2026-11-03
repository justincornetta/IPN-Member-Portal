import {notFound} from "next/navigation"
import Link from "next/link"
import {guestDemoEnabled,demoEvent,previewGuest} from "@/lib/guest-events/demo"
import {renderGuestEmail} from "@/lib/guest-events/email-content"
import type {GuestEmailKind} from "@/lib/guest-events/domain"
export const dynamic="force-dynamic"
export default function EmailPreview(){
 if(!guestDemoEnabled())notFound()
 const kinds:GuestEmailKind[]=["rsvp_confirmation","reminder_24h","reminder_1h","membership_invitation"]
 return <main className="min-h-screen bg-zinc-50 text-zinc-900 px-5 py-8"><div className="mx-auto max-w-5xl"><h1 className="text-2xl font-semibold">Guest event emails</h1><p className="mt-2 text-sm text-zinc-600">Local preview. No email is sent.</p><Link href="/events/guest-rsvp-preview" className="mt-3 inline-flex min-h-11 items-center text-sm text-ipn">Back to the event →</Link><div className="mt-6 grid gap-8 lg:grid-cols-2">{kinds.map(kind=>{const email=renderGuestEmail({kind,event:demoEvent,guest:previewGuest,site:"http://127.0.0.1:4331",token:"preview-only"});return <section key={kind}><h2 className="mb-2 font-medium">{email.subject}</h2><iframe title={kind.replaceAll("_"," ")} srcDoc={email.html} sandbox="" className="h-[760px] w-full rounded-xl border border-zinc-200 bg-white"/></section>})}</div></div></main>
}
