import {Resend} from "resend"
import {randomUUID} from "node:crypto"
import {createAdminClient} from "@/lib/supabase/admin"
import {parseGuestInput} from "@/lib/guest-events/domain"
import {guestDemoEnabled} from "@/lib/guest-events/demo"
import {escapeHtml} from "@/lib/guest-events/email-content"
import {GuestError,guestFeatureEnabled,guestLiveEmailEnabled,guestSiteUrl,checkGuestRate,readGuestBody,guestResponseError} from "@/lib/guest-events/service"
export async function POST(request:Request) {
  try {
    if(!guestFeatureEnabled())throw new GuestError("Email signup is unavailable.",404)
    const body=await readGuestBody(request)
    let input
    try{input=parseGuestInput(body)}catch(e){throw new GuestError((e as Error).message)}
    await checkGuestRate(request,input.email,"membership")
    if(guestDemoEnabled())return Response.json({ok:true,demo:true})
    if(!guestLiveEmailEnabled() || !process.env.RESEND_API_KEY)throw new GuestError("Email signup is temporarily unavailable. Please try again.",503)
    const admin=createAdminClient()
    const {data,error}=await admin.auth.admin.generateLink({type:"magiclink",email:input.email,options:{data:{first_name:input.firstName,last_name:input.lastName,event_signup:true}}})
    if(error || !data.properties?.hashed_token)throw new Error("Link generation failed")
    const url=new URL("/auth/callback",guestSiteUrl())
    url.searchParams.set("token_hash",data.properties.hashed_token)
    url.searchParams.set("type",data.properties.verification_type)
    url.searchParams.set("next","/dashboard")
    url.searchParams.set("source","guest-signup")
    const link=url.href
    const resend=new Resend(process.env.RESEND_API_KEY)
    const {error:mailError}=await resend.emails.send({
      from:process.env.EVENT_EMAIL_FROM ?? "IPN Events <events@members.intercollegiatepsychedelics.net>",
      to:[input.email],subject:"Your secure IPN sign-in link",
      html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:28px;border:1px solid #e4e4e7;border-radius:12px"><h1 style="font-size:24px">Welcome to IPN</h1><p>Use this secure link to finish joining or sign in to your existing account.</p><p><a style="display:inline-block;background:#664fa1;color:white;padding:12px 18px;border-radius:8px;text-decoration:none" href="'+escapeHtml(link)+'">Continue to IPN</a></p><p>Any existing event RSVP stays confirmed. This link expires in one hour and can only be used once.</p><p>If you did not request this email, you can ignore it.</p></div>',
      text:"Finish joining or sign in to IPN: "+link+"\n\nAny existing event RSVP stays confirmed. This link expires in one hour and can only be used once. If you did not request it, ignore this email."
    },{idempotencyKey:"guest-membership/"+randomUUID()})
    if(mailError)throw new Error("Could not send sign-in link")
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}})
  }catch(error){return guestResponseError(error)}
}
