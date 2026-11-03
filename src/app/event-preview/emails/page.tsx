import {notFound} from "next/navigation"
import Link from "next/link"
import {guestDemoEnabled,demoEvent,previewGuest} from "@/lib/guest-events/demo"
import {renderGuestEmail} from "@/lib/guest-events/email-content"
import {guestSiteUrl} from "@/lib/guest-events/service"
import {guestToken} from "@/lib/guest-events/tokens"
import {hostedGuestPreview,previewEventSlug} from "@/lib/guest-events/preview-mode"
import {readPreviewGuest} from "@/lib/guest-events/preview-store"
import type {GuestEmailKind} from "@/lib/guest-events/domain"
export const dynamic="force-dynamic"
export default async function EmailPreview(){
 if(!guestDemoEnabled())notFound()
 const hosted=hostedGuestPreview()
 const guest=hosted ? await readPreviewGuest() ?? previewGuest : previewGuest
 const site=guestSiteUrl(),token=guestToken(guest.id)
 const kinds:GuestEmailKind[]=["rsvp_confirmation","reminder_24h","reminder_1h","membership_invitation"]
 return <main className="min-h-screen bg-zinc-50 text-zinc-900 px-5 py-8"><div className="mx-auto max-w-5xl">
 <h1 className="text-2xl font-semibold">{hosted?"Preview inbox":"Guest event emails"}</h1>
 <p className="mt-2 text-sm text-zinc-600">No email is sent. {hosted?"These previews use your latest test RSVP in this browser, or sample details before you RSVP. All reminder and invitation templates are shown immediately for review; this does not test scheduled delivery.":"Local preview."}</p>
 <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ipn">
 <Link className="inline-flex min-h-11 items-center" href={"/events/"+(hosted?previewEventSlug:"guest-rsvp-preview")}>Back to the event →</Link>
 {hosted&&<Link className="inline-flex min-h-11 items-center underline" href={"/events/rsvp/"+token}>View or cancel your test RSVP</Link>}
 </div>
 <div className="mt-6 grid gap-8 lg:grid-cols-2">{kinds.map(kind=>{const email=renderGuestEmail({kind,event:demoEvent,guest,site,token});return <section key={kind}><h2 className="mb-2 font-medium">{email.subject}</h2><iframe title={kind.replaceAll("_"," ")} srcDoc={email.html.replaceAll('<a ', '<a target="_top" ')} sandbox="allow-top-navigation-by-user-activation" className="h-[760px] w-full rounded-xl border border-zinc-200 bg-white"/></section>})}</div>
 </div></main>
}
