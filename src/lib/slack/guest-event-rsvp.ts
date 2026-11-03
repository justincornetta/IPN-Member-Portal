import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

// Best-effort alert, like member RSVP notifications. Claim before sending so
// concurrent submissions and retries cannot announce the same RSVP twice.
export async function sendGuestEventRsvpSlackNotification(registrationId: string | null) {
  const webhook = process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL
  if (!registrationId || !webhook || process.env.GUEST_EVENT_EMAIL_MODE !== "live" ||
      (process.env.CONTEXT && process.env.CONTEXT !== "production")) return
  try {
    const db = createAdminClient()
    const {data: guest,error} = await db.from("guest_event_registrations")
      .update({slack_notification_claimed_at: new Date().toISOString()})
      .eq("id",registrationId).is("slack_notification_claimed_at",null).is("cancelled_at",null)
      .select("event_id,first_name,last_name,email").maybeSingle()
    if(error) throw error
    if(!guest) return
    const {data: event,error: eventError} = await db.from("events")
      .select("title,event_type,registration_count").eq("id",guest.event_id).single()
    if(eventError || !event) throw eventError || new Error("Event not found")
    const escape = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    const field = (label: string,value: string) => ({type:"mrkdwn",text:`*${label}:*\n${escape(value)}`,verbatim:true})
    const response = await fetch(webhook,{
      method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),
      body:JSON.stringify({text:"New guest event RSVP",blocks:[
        {type:"header",text:{type:"plain_text",text:"New guest event RSVP"}},
        {type:"section",fields:[field("Attendee type","Guest (no IPN account)"),
          field("Guest",`${guest.first_name} ${guest.last_name}`),field("Email",guest.email),
          field("Event",event.title),field("RSVP type",event.event_type || "IPN Event"),
          field("Cumulative RSVPs",String(event.registration_count ?? 0))]}
      ]})
    })
    if(!response.ok) throw new Error(`Slack returned ${response.status}`)
  } catch {
    // Do not log webhook URLs, payloads or guest identity.
    console.error("Guest event RSVP Slack notification failed",registrationId)
  }
}
