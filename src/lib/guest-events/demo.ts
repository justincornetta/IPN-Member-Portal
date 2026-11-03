import type { EventRecord } from "../events/types"
import type { GuestRegistration, GuestInput } from "./domain"
import { randomUUID } from "node:crypto"
import { hostedGuestPreview, previewEventSlug } from "./preview-mode"

export function guestDemoEnabled() { return hostedGuestPreview() || (process.env.NODE_ENV !== "production" && process.env.GUEST_EVENT_LOCAL_DEMO === "1") }
export const demoSlug = "guest-rsvp-preview"
export function demoEventSlug(slug: string) { return slug === demoSlug || (hostedGuestPreview() && slug === previewEventSlug) }
export const demoEvent = {
  id: "11111111-1111-4111-8111-111111111111", slug: demoSlug,
  title: "Global Psychedelic Week: So you want to be a psychedelic professional?",
  event_type: "Webinar", starts_at: "2026-11-04T00:45:00.000Z", ends_at: "2026-11-04T01:45:00.000Z",
  timezone: "America/New_York", speakers: "Shyam Dhulashia",
  location_label: "Zoom and In-Person at the University of Central Florida",
  summary: "IPN Labs Director Shyam Dhulashia explores pathways into psychedelic science, therapy, and community.",
  description: "IPN is proud to be a part of Global Psychedelic Week 2026. This event takes place at the University of Central Florida, alongside The Central Florida Psychedelic Society, and attendees can join virtually from anywhere. This talk follows Shyam's winding, yet interconnected journey through various fields in psychedelic science, ultimately leading him toward a Master's in Mental Health Counseling. Embodying IPN's ethos, Shyam hopes to inspire a new generation of psychedelic professionals.\nBefore his involvement in IPN and counselor education at UCF, Shyam served as a study coordinator in Dr. Justin Riddle's lab at FSU where he explored the neural dynamics of psychedelic-like experiences during Fire Kasina advanced meditation retreats. Nowadays, he is the founder of Liminal Space, a harm-reduction and integration service at local raves and festivals, a yoga instructor at UCF, and an integration facilitator for the Central Florida Psychedelic Society. He envisions applying his expertise in cognitive neuroscience to help clients understand the functional brain dynamics underlying the changes experienced via consciousness exploration and therapy. He seeks to help clients integrate their experiences and heal through trauma through the strength of community support and ancient mind-body practices.",
  thumbnail_url: "/events/guest-rsvp-preview.jpg", join_url: "https://example.com/zoom-preview",
  location_details: null, registration_url: null, requires_verified_ticket: false, is_recording: false,
  status: "published", guest_rsvp_enabled: true, registration_count: 12, registration_reminder_enabled: true,
} as EventRecord
type DemoState = { registrations: Map<string,GuestRegistration>; retries: Set<string> }
const globalDemo = globalThis as typeof globalThis & { guestEventDemo?: DemoState }
function state() { return globalDemo.guestEventDemo ??= { registrations: new Map(), retries: new Set() } }
export function demoRegister(input: GuestInput) {
  if (!guestDemoEnabled()) throw new Error("Preview unavailable")
  if (input.email === "retry@example.com" && !state().retries.has(input.email)) {
    state().retries.add(input.email); throw new Error("We couldn't save your RSVP. Please try again.")
  }
  const existing = [...state().registrations.values()].find(r => r.email === input.email && !r.cancelled_at)
  if (existing) return existing
  const row: GuestRegistration = { id: randomUUID(),event_id: demoEvent.id,first_name:input.firstName,last_name:input.lastName,email:input.email,marketing_opt_in:input.marketingOptIn,cancelled_at:null,converted_user_id:null,created_at:new Date().toISOString() }
  state().registrations.set(row.id,row); return row
}
export function demoFind(id: string) {
 if(id===previewGuest.id && !state().registrations.has(id))state().registrations.set(id,{...previewGuest})
 return state().registrations.get(id) ?? null
}
export function demoUpdate(id: string, change: Partial<GuestRegistration>) { const r=demoFind(id); if(r) Object.assign(r,change); return r }
export const previewGuest: GuestRegistration = { id:"22222222-2222-4222-8222-222222222222",event_id:demoEvent.id,first_name:"Alex",last_name:"Rivera",email:"alex@example.com",marketing_opt_in:true,cancelled_at:null,converted_user_id:null,created_at:"2026-11-03T02:00:00Z" }
