import { GuestError,readGuestBody,updateGuestPreference,guestResponseError } from "@/lib/guest-events/service"
export async function POST(request:Request) {
  try {
    const token=new URL(request.url).searchParams.get("token")
    // RFC 8058 one-click unsubscribe is intentionally cross-origin and POST-only.
    if(token && request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      const body=await request.text()
      if(body.length>256 || new URLSearchParams(body).get("List-Unsubscribe")!=="One-Click") throw new GuestError("Invalid request")
      await updateGuestPreference(token,"unsubscribe")
    } else {
      const body=await readGuestBody(request)
      if(typeof body.token!=="string" || !["cancel","unsubscribe"].includes(body.action)) throw new GuestError("Invalid request")
      await updateGuestPreference(body.token,body.action)
    }
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}})
  } catch(error) { return guestResponseError(error) }
}
