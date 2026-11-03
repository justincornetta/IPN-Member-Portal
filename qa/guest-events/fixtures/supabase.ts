import { cookies } from "next/headers"
import { demoEvent } from "./demo"

// Used only in the disposable QA application. Never imported by production.
function query(table: string) {
  let otherEvents = false
  const builder = {
    select() { return builder }, eq() { return builder }, ilike() { return builder },
    neq() { otherEvents = true; return builder }, gte() { return builder }, order() { return builder },
    limit() { return Promise.resolve({data: []}) },
    async single() { return builder.maybeSingle() },
    async maybeSingle() {
      const jar = await cookies()
      if (table === "events") return {data: otherEvents ? [] : {...demoEvent, guest_rsvp_enabled: !jar.has("qa-guest-disabled")}}
      if (table === "profiles") return {data: {id: "qa-member", is_banned: false}}
      if (table === "event_registrations") return {data: jar.has("qa-registered") ? {event_id: demoEvent.id} : null}
      return {data: null}
    },
  }
  return builder
}
export function createAdminClient() {
  return {from: query, rpc: async (name: string) => {
    if (name === "claim_guest_event_emails") return {data: []}
    if (["register_guest_event", "guest_event_rate_limit"].includes(name)) return {data: true}
    throw new Error("Unexpected QA RPC: " + name)
  }}
}
export async function createClient() {
  const jar = await cookies()
  return {from: query, auth: {
    getUser: async () => ({data: {user: jar.has("qa-member") ? {id:"qa-member"} : null}}),
    signInWithPassword: async ({email, password}: {email: string; password: string}) => {
      if (password !== "preview-password") return {data: {}, error: {message:"Invalid QA password"}}
      jar.set("qa-member", "1")
      if (email === "rsvp-retry@example.com") jar.set("qa-retry", "1")
      return {data: {user: {id:"qa-member"}}}
    },
  }}
}
