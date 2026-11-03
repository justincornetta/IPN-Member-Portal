"use client"
import { trackPortalEvent } from './client'
import { rsvpMetadata, type RsvpPath, type RsvpStage } from './event-rsvp'
export function trackRsvp(slug:string,stage:RsvpStage,path:RsvpPath) {
  const metadata=rsvpMetadata({flow:'event_rsvp',eventSlug:slug,stage,path})
  if(!metadata)return
  try {
    trackPortalEvent('curated_click',{pagePath:'/events/'+slug,pageTitle:'Event RSVP',referrer:'',targetId:null,targetLabel:null,metadata},{beacon:stage==='signup'||stage==='calendar'||stage==='join'})
  } catch { /* Storage/analytics failures must never block RSVP or navigation. */ }
}
