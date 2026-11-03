import { Resend } from "resend"
import { createAdminClient } from "../supabase/admin"
import { buildGoogleCalendarUrl } from "../events/calendar"
import type { EventRecord } from "../events/types"
import type { GuestRegistration, GuestEmailKind } from "./domain"
import { guestRsvpAvailable, parseGuestInput, safeWebUrl } from "./domain"
import { rateKey, guestToken, readGuestToken } from "./tokens"
import { renderGuestEmail } from "./email-content"

export class GuestError extends Error { constructor(message:string,public status=400) { super(message) } }
export function guestFeatureEnabled() {
  return process.env.GUEST_EVENT_RSVP_ENABLED === "true"
}
export function guestLiveEmailEnabled() {
  // Netlify CONTEXT can be absent at runtime. Scope this mode to Production in Netlify.
  return process.env.GUEST_EVENT_EMAIL_MODE === "live" && (!process.env.CONTEXT || process.env.CONTEXT === "production")
}
export function guestSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
  if (!raw) throw new Error("Guest event site URL is missing")
  const url = new URL(raw)
  if (url.protocol !== "https:") throw new Error("Guest event site must use HTTPS")
  return url.origin
}
export async function readGuestEvent(slug: string): Promise<EventRecord | null> {
  const { data,error } = await createAdminClient().from("events").select("*").eq("slug",slug).eq("status","published").eq("is_recording",false).maybeSingle()
  if(error) throw error
  return data as EventRecord | null
}
export async function checkGuestRate(request: Request, email:string, scope:string) {
  const db=createAdminClient()
  const ip=request.headers.get("x-nf-client-connection-ip") ?? "unknown-proxy"
  for(const [bucket,limit] of [[scope+":"+email,5],["ip:"+ip,60]] as const) {
    const {data,error}=await db.rpc("guest_event_rate_limit",{p_bucket:rateKey(bucket),p_limit:limit})
    if(error) throw new GuestError("We couldn't accept your request. Please try again shortly.",503)
    if(!data) throw new GuestError("Too many requests. Please try again later.",429)
  }
}
export async function readGuestBody(request:Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new GuestError("Please submit the form again.",415)
  const origin=request.headers.get("origin")
  const allowedOrigins = new Set([new URL(request.url).origin, guestSiteUrl()])
  if(!origin || !allowedOrigins.has(origin)) throw new GuestError("Please submit the form from the event page.",403)
  if(Number(request.headers.get("content-length") ?? 0)>4096) throw new GuestError("Form is too large.",413)
  const text=await request.text()
  if(text.length>4096) throw new GuestError("Form is too large.",413)
  try { return JSON.parse(text) } catch { throw new GuestError("Please submit the form again.") }
}
export function guestResponseError(error:unknown) {
  const status=error instanceof GuestError ? error.status : 503
  const message=error instanceof GuestError ? error.message : "We couldn't save your request. Please try again."
  return Response.json({error:message},{status,headers:{"Cache-Control":"no-store"}})
}
export async function submitGuestRsvp(slug:string,input:unknown,request:Request) {
  if(!guestFeatureEnabled()) throw new GuestError("Guest RSVP is not available for this event.",404)
  let clean
  try { clean=parseGuestInput(input) } catch(e) { throw new GuestError((e as Error).message) }
  const event=await readGuestEvent(slug)
  if(!event || !guestRsvpAvailable(event)) throw new GuestError("This event is not accepting guest RSVPs.",409)
  if((!guestLiveEmailEnabled() || !process.env.RESEND_API_KEY))
    throw new GuestError("Registration is temporarily unavailable. Please try again shortly.",503)
  await checkGuestRate(request,clean.email,"rsvp:"+event.id)
  {
    // Check signing configuration before accepting a registration.
    guestToken(event.id)
    const {error}=await createAdminClient().rpc("register_guest_event",{
      p_event_id:event.id,p_first_name:clean.firstName,p_last_name:clean.lastName,p_email:clean.email,p_opt_in:clean.marketingOptIn
    })
    if(error) throw new GuestError("We couldn't save your RSVP. Please try again.",503)
  }
  return {ok:true,joinUrl:safeWebUrl(event.join_url),calendarUrl:buildGoogleCalendarUrl({...event,join_url:safeWebUrl(event.join_url)}),
    emailStatus:"queued"}
}
export async function readGuestAccess(token:string) {
  const id=readGuestToken(token)
  if(!id) return null
  const db=createAdminClient()
  const {data:guest,error}=await db.from("guest_event_registrations").select("*").eq("id",id).maybeSingle()
  if(error) throw error
  if(!guest) return null
  const {data:event}=await db.from("events").select("*").eq("id",guest.event_id).maybeSingle()
  return event ? {guest:guest as GuestRegistration,event:event as EventRecord} : null
}
export async function updateGuestPreference(token:string,action:"unsubscribe"|"cancel") {
  const access=await readGuestAccess(token)
  if(!access) throw new GuestError("This link is not valid.",404)
  const db=createAdminClient()
  const {error}=await db.rpc("update_guest_event_preference",{p_id:access.guest.id,p_action:action})
  if(error) throw error
}
export async function claimGuestRegistrations(userId:string) {
  if(!guestFeatureEnabled()) return
  const {error}=await createAdminClient().rpc("claim_guest_event_registrations",{p_user_id:userId})
  if(error) throw error
}
type GuestJob={id:string;registration_id:string;kind:GuestEmailKind;payload:Record<string,unknown>|null;locked_at:string;attempt_count:number}
export async function processGuestEventEmails() {
  if(!guestLiveEmailEnabled() || !guestFeatureEnabled()) return {sent:0,failed:0,skipped:0,disabled:true}
  if(!process.env.RESEND_API_KEY) throw new Error("Resend is not configured")
  const db=createAdminClient()
  const {data:jobs,error}=await db.rpc("claim_guest_event_emails",{p_limit:25})
  if(error) throw error
  const counts={sent:0,failed:0,skipped:0,disabled:false}
  for(const job of (jobs ?? []) as GuestJob[]) {
    const update=async(payload:Record<string,unknown>)=>{
      const {error:e}=await db.from("guest_event_email_deliveries").update(payload).eq("id",job.id).eq("locked_at",job.locked_at)
      if(e) throw e
    }
    let accepted=false
    try {
      const {data:guest,error:ge}=await db.from("guest_event_registrations").select("*").eq("id",job.registration_id).single()
      if(ge) throw ge
      const {data:event,error:ee}=await db.from("events").select("*").eq("id",guest.event_id).single()
      if(ee) throw ee
      const now=Date.now(),start=new Date(event.starts_at).getTime(),end=new Date(event.ends_at ?? event.starts_at).getTime()
      let skip=!!guest.cancelled_at || event.status!=="published" || event.is_recording || !event.guest_rsvp_enabled || event.requires_verified_ticket || !!event.registration_url
      if(job.kind==="membership_invitation") {
        skip ||= !guest.marketing_opt_in || !!guest.converted_user_id
        // Suppress invitations to people who already joined through another path.
        const {data:member,error:me}=await db.from("profiles").select("id").ilike("email",guest.email.replace(/[\\%_]/g,"\\$&")).limit(1)
        if(me) throw me
        skip ||= !!member?.length
      } else skip ||= now>=end
      if(job.kind==="reminder_24h") skip ||= now>=start-3600000
      if(skip) { await update({status:"skipped"});counts.skipped++;continue }
      const due=job.kind==="reminder_24h" ? start-86400000 : job.kind==="reminder_1h" ? start-3600000 : job.kind==="membership_invitation" ? end+86400000 : 0
      if(due>now && job.payload) { await update({status:"review",last_error:"Event timing changed during delivery; review before retry"});continue }
      if(due>now) { await update({status:"pending",due_at:new Date(due).toISOString(),locked_at:null,first_attempt_at:null,attempt_count:0,payload:null});continue }
      let payload=job.payload
      if(!payload) {
        payload={from:process.env.EVENT_EMAIL_FROM ?? "IPN Events <events@members.intercollegiatepsychedelics.net>",
          to:[guest.email],replyTo:process.env.EVENT_EMAIL_REPLY_TO ?? "info@intercollegiatepsychedelics.net",
          ...renderGuestEmail({kind:job.kind,event,guest,site:guestSiteUrl(),token:guestToken(guest.id)}),
          tags:[{name:"kind",value:job.kind},{name:"audience",value:"event_guest"}]}
        await update({payload})
      }
      const resend=new Resend(process.env.RESEND_API_KEY)
      const {data,error:sendError}=await resend.emails.send(payload as unknown as Parameters<typeof resend.emails.send>[0],{idempotencyKey:"guest-event/"+job.id})
      if(sendError) throw new Error(sendError.message)
      accepted=true
      await update({status:"sent",resend_email_id:data?.id ?? null,sent_at:new Date().toISOString(),last_error:null})
      counts.sent++
    } catch {
      counts.failed++
      // If accepted but the ledger write failed, leave the lease intact. Retry uses
      // the same persisted payload/key; after 23h it goes to manual review.
      if(!accepted) await update({status:"failed",due_at:new Date(Date.now()+300000).toISOString(),last_error:"Email delivery failed; queued for retry"}).catch(()=>{})
      console.error("[guest-event-email] delivery failed",job.id)
    }
  }
  return counts
}
