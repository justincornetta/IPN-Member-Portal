import { after } from "next/server"
import { readGuestBody,submitGuestRsvp,guestResponseError,processGuestEventEmails } from "@/lib/guest-events/service"
import { sendGuestEventRsvpSlackNotification } from "@/lib/slack/guest-event-rsvp"
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}) {
  try {
    const {slug}=await params
    const {registrationId,...result}=await submitGuestRsvp(slug,await readGuestBody(request),request)
    after(async()=>{ await Promise.allSettled([sendGuestEventRsvpSlackNotification(registrationId),processGuestEventEmails().catch(()=>console.error("[guest-events] queued delivery will retry"))]) })
    return Response.json(result,{headers:{"Cache-Control":"no-store"}})
  } catch(error) { return guestResponseError(error) }
}
