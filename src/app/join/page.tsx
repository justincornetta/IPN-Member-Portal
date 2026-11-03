import Image from "next/image"
import {notFound} from "next/navigation"
import MembershipForm from "@/components/events/MembershipForm"
import {guestFeatureEnabled} from "@/lib/guest-events/service"
import icon from "../../../assets/purple_icon.png"
export const dynamic="force-dynamic"
export default async function JoinPage({searchParams}:{searchParams:Promise<{expired?:string}>}){
 const {expired}=await searchParams
 if(!guestFeatureEnabled())notFound()
 return <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-900 px-4 py-10"><div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8"><div className="mb-8 text-center"><Image src={icon} alt="IPN" width={40} height={40} className="mx-auto"/><p className="mt-3 text-sm font-semibold text-ipn">Intercollegiate Psychedelics Network</p></div>{expired&&<p role="alert" className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">That link has expired or was already used. Request a new link below.</p>}<MembershipForm/></div></main>
}
