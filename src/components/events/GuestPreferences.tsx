"use client"
import {useState} from "react"
import {useRouter} from "next/navigation"
export default function GuestPreferences({token,action}:{token:string;action:"cancel"|"unsubscribe"}) {
 const router=useRouter()
 const [done,setDone]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState("")
 async function submit(){setPending(true);setError("");try{const r=await fetch("/api/events/guest-preferences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,action})});const data=await r.json();if(!r.ok)throw new Error(data.error);setDone(true);if(action==="cancel")router.refresh()}catch(e){setError(e instanceof Error?e.message:"Please try again.")}finally{setPending(false)}}
 if(done)return <p role="status" className="text-sm text-zinc-700">{action==="cancel"?"Your RSVP is cancelled. You won’t receive further emails for this event.":"You won’t receive the membership invitation for this event. Your RSVP and event reminders are unchanged."}</p>
 return <div><button disabled={pending} onClick={submit} className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50">{pending?"Saving…":action==="cancel"?"Cancel my RSVP":"Unsubscribe from invitations"}</button>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</div>
}
