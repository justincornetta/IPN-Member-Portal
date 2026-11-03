import {createClient} from "@supabase/supabase-js"

// Netlify runs this before production builds. Never log credential values.
const required=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","RESEND_API_KEY","NEXT_PUBLIC_SITE_URL","GUEST_EVENT_TOKEN_SECRET"]
const missing=required.filter(key=>!process.env[key]?.trim())
if(missing.length)throw new Error("Guest RSVP release is missing: "+missing.join(", "))
if(process.env.GUEST_EVENT_RSVP_ENABLED!=="true" || process.env.GUEST_EVENT_EMAIL_MODE!=="live")
  throw new Error("Production guest RSVP and email delivery must be enabled before release.")
if(process.env.GUEST_EVENT_TOKEN_SECRET.length<32)throw new Error("Guest RSVP signing secret must contain at least 32 characters.")
if(new URL(process.env.NEXT_PUBLIC_SITE_URL).protocol!=="https:")throw new Error("Production site URL must use HTTPS.")
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
for(const [table,columns] of [["events","id,guest_rsvp_enabled"],["guest_event_registrations","id"],["guest_event_email_deliveries","id"],["guest_event_rate_limits","bucket"]]){
  const {error}=await db.from(table).select(columns).limit(0)
  if(error)throw new Error("Guest RSVP database setup is incomplete: "+table+". Apply the guest RSVP migration before release.")
}
console.log("Guest RSVP release prerequisites verified: configuration and database schema are ready.")
