import {notFound} from "next/navigation"
import type {Metadata} from "next"
import Link from "next/link"
import {readGuestAccess} from "@/lib/guest-events/service"
import {safeWebUrl} from "@/lib/guest-events/domain"
import {buildGoogleCalendarUrl,formatEventDateTime} from "@/lib/events/calendar"
import GuestPreferences from "@/components/events/GuestPreferences"
import MembershipForm from "@/components/events/MembershipForm"
export const dynamic="force-dynamic"
export const metadata:Metadata={robots:{index:false,follow:false},referrer:"no-referrer",title:"Your event RSVP | IPN"}
export default async function GuestAccess({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{action?:string;join?:string}>}){
 const {token}=await params;const query=await searchParams;const access=await readGuestAccess(token);if(!access)notFound()
 const {event,guest}=access
 const unavailable=guest.cancelled_at || event.status!=="published" || !event.guest_rsvp_enabled || event.requires_verified_ticket || !!event.registration_url
 const join=safeWebUrl(event.join_url)
 return <main className="min-h-screen bg-zinc-50 text-zinc-900 px-4 py-10"><div className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-6"><Link className="text-sm font-semibold text-ipn" href={"/events/"+event.slug}>IPN Member Portal</Link><h1 className="mt-5 text-2xl font-semibold">{query.action==="unsubscribe"?"Email preferences":unavailable?"Your event RSVP":"You’re registered"}</h1><h2 className="mt-4 font-semibold">{event.title}</h2><p className="mt-2 text-sm text-zinc-600">{formatEventDateTime(event.starts_at,event.ends_at,event.timezone)}</p>
 {query.action==="unsubscribe"?<div className="mt-6"><GuestPreferences token={token} action="unsubscribe"/></div>:unavailable?<p className="mt-5 text-sm">This RSVP or event is no longer available. Contact info@intercollegiatepsychedelics.net if you need help.</p>:<>
 <p className="mt-4 text-sm text-zinc-600">No portal login is needed to attend.</p><div className="mt-5 flex flex-wrap items-center gap-4">{join?<a href={join} rel="noreferrer" className="rounded-lg bg-ipn px-5 py-3 text-sm font-medium text-white">Join event</a>:<p className="text-sm">Joining details will appear here when available.</p>}<a className="text-sm font-medium text-ipn underline" href={buildGoogleCalendarUrl(event)} rel="noreferrer">Add to calendar</a></div>
 <div className="mt-6 border-t border-zinc-200 pt-5"><GuestPreferences token={token} action="cancel"/></div>
 {!guest.converted_user_id&&<div className="mt-6 border-t border-zinc-200 pt-5">{query.join==="1"?<MembershipForm initial={{firstName:guest.first_name,lastName:guest.last_name,email:guest.email}} eventSlug={event.slug}/>:<Link className="inline-flex min-h-11 items-center text-sm text-ipn" href={"?join=1"}>Join IPN free (optional) →</Link>}</div>}
 </>}
 </div></main>
}
