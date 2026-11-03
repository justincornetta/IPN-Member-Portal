"use client"
import {useState} from 'react'
import {RSVP_STAGES,type RsvpJourney,type RsvpStage} from '@/lib/portal-analytics/event-rsvp'
const labels:Record<RsvpStage,string>={view:'Visits',open:'Form opens',submit:'Submissions',confirmed:'Confirmations',error:'Errors',calendar:'Calendar clicks',join:'Join clicks',signup:'Signup clicks'}
const paths={visitor:'Visitor',guest:'Guest',member_login:'Member sign-in',member:'Signed-in member'}
export default function EventRsvpAnalytics({journeys}:{journeys:RsvpJourney[]}){
 const [from,setFrom]=useState(''),[to,setTo]=useState('')
 const groups=new Map<string,{event:string;path:RsvpJourney['path'];counts:Record<RsvpStage,number>;completed:number;attempted:number;accounts:number}>()
 for(const row of journeys){
  if((from && row.date<from)||(to && row.date>to))continue
  const key=JSON.stringify([row.eventSlug,row.path])
  const group=groups.get(key)??{event:row.eventSlug,path:row.path,counts:Object.fromEntries(RSVP_STAGES.map(s=>[s,0])) as Record<RsvpStage,number>,completed:0,attempted:0,accounts:0}
  for(const stage of row.stages)group.counts[stage]++
  if(row.stages.includes('submit')){group.attempted++;if(row.stages.includes('confirmed'))group.completed++}
  if(row.signupCompleted)group.accounts++
  groups.set(key,group)
 }
 return <section className="rounded-xl border border-zinc-200 bg-white p-5" aria-labelledby="event-rsvp-analytics-title">
  <h2 id="event-rsvp-analytics-title" className="text-lg font-semibold text-zinc-900">Event RSVP journey</h2>
  <p className="mt-2 text-sm leading-6 text-zinc-600">Public event pages, grouped by event and RSVP path. Each stage counts a browser session once per event and path. Visitor visits can lead to Guest or Member sign-in activity in separate rows. These are observed interactions, not unique attendees or the official RSVP total.</p>
  <div className="my-4 flex flex-wrap gap-4">
   <label className="text-sm text-zinc-700">Journey start from<input aria-label="RSVP journey from" className="mt-1 block min-h-11 rounded border border-zinc-300 px-2" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
   <label className="text-sm text-zinc-700">Through<input aria-label="RSVP journey through" className="mt-1 block min-h-11 rounded border border-zinc-300 px-2" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
  </div>
  {groups.size > 0 && <p className="mb-2 text-xs text-zinc-500">Scroll horizontally for more metrics.</p>}
  {groups.size ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="RSVP journey results"><table className="w-full text-left text-sm"><thead><tr>{['Event / path',...RSVP_STAGES.map(s=>labels[s]),'Submission success','Account creations'].map(h=><th key={h} className="whitespace-nowrap border-b p-3 font-medium text-zinc-600">{h}</th>)}</tr></thead><tbody>{[...groups.entries()].map(([key,g])=><tr key={key}><th className="min-w-60 border-b p-3 font-normal"><span className="block break-words text-zinc-900">{g.event.replaceAll('-',' ')}</span><span className="text-zinc-500">{paths[g.path]}</span></th>{RSVP_STAGES.map(s=><td key={s} className="border-b p-3 tabular-nums">{g.counts[s]}</td>)}<td className="border-b p-3">{g.attempted?`${Math.round(g.completed/g.attempted*100)}%`:'—'}</td><td className="border-b p-3">{g.accounts}</td></tr>)}</tbody></table></div>:<p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">No RSVP journey activity recorded for these dates. Tracking starts when this update is deployed; earlier RSVPs are not backfilled.</p>}
  <p className="mt-3 text-xs leading-5 text-zinc-500">This section uses its own date filters and the portal’s retained analytics window. Submission success is sessions recording both submission and confirmation ÷ sessions submitting. Repeat confirmations can include existing RSVPs. Account creations require a recorded registration success after the latest signup click in the same session; email verification and later sessions are not attributed. Join clicks do not establish attendance. Blocked analytics may undercount activity.</p>
 </section>
}
