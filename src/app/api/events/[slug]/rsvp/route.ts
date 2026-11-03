import { after } from "next/server"
import { readGuestBody,submitGuestRsvp,guestResponseError,processGuestEventEmails } from "@/lib/guest-events/service"
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}) {
  try {
    const {slug}=await params
    const result=await submitGuestRsvp(slug,await readGuestBody(request),request)
    after(async()=>{ await processGuestEventEmails().catch(()=>console.error("[guest-events] queued delivery will retry")) })
    return Response.json(result,{headers:{"Cache-Control":"no-store"}})
  } catch(error) { return guestResponseError(error) }
}
