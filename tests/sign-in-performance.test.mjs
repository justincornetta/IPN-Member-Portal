import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"
import { isSafeRedirectPath } from "../src/lib/auth/redirect.ts"

function harness({authError=null, claim=async()=>{}, record=async()=>{}}={}) {
  const queued=[],events=[],calls=[]
  const imports={
    "next/navigation":{redirect:path=>{throw Object.assign(new Error("redirect"),{destination:path})}},
    "next/server":{after:callback=>queued.push(callback)},
    "@/lib/supabase/server":{createClient:async()=>({auth:{signInWithPassword:async()=>{
      calls.push("authenticate");return {data:{user:authError?null:{id:"verified-user"}},error:authError}
    }}})},
    "@/lib/auth/redirect":{isSafeRedirectPath},
    "@/lib/guest-events/service":{claimGuestRegistrations:async id=>{calls.push("claim");await claim(id)}},
    "@/lib/portal-analytics/events":{recordPortalAnalyticsEvent:async payload=>{events.push(payload);await record(payload)}},
  }
  const exports={}
  const {outputText}=ts.transpileModule(readFileSync("src/lib/auth/actions.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}})
  new Function("require","exports",outputText)(name=>imports[name]??{},exports)
  return {signIn:exports.signIn,queued,events,calls}
}
const context={sessionId:"qa-session",anonymousId:"qa-anonymous",pagePath:"/login"}

test("successful login redirects before analytics starts and records the verified user afterwards",async()=>{
  let finish
  const pending=new Promise(resolve=>{finish=resolve})
  const h=harness({record:()=>pending})
  await assert.rejects(h.signIn("private@example.test","private-password",undefined,context),{destination:"/dashboard"})
  assert.deepEqual(h.calls,["authenticate","claim"])
  assert.equal(h.events.length,0);assert.equal(h.queued.length,1)
  const redirectedAt=Date.now()
  await new Promise(resolve=>setTimeout(resolve,10))
  const work=h.queued[0]()
  assert.equal(h.events[0].eventName,"sign_in_success");assert.equal(h.events[0].userId,"verified-user")
  assert.ok(Date.parse(h.events[0].occurredAt)<=redirectedAt)
  assert.ok(!JSON.stringify(h.events).includes("private"))
  finish();await work
})

test("invalid credentials return immediately and failure analytics runs after the response",async()=>{
  const h=harness({authError:new Error("Invalid login credentials")})
  assert.deepEqual(await h.signIn("member@example.test","wrong",undefined,context),{error:"Invalid login credentials"})
  assert.deepEqual(h.calls,["authenticate"]);assert.equal(h.events.length,0)
  await h.queued[0]();assert.equal(h.events[0].eventName,"sign_in_error");assert.equal(h.events[0].userId,null)
})

test("guest RSVP association still completes before redirecting to the event destination",async()=>{
  let finish
  const gate=new Promise(resolve=>{finish=resolve})
  const h=harness({claim:()=>gate})
  let completed=false
  const flow=h.signIn("member@example.test","password","/events/example",context).catch(e=>{completed=true;return e})
  await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false)
  finish();assert.equal((await flow).destination,"/dashboard/events/example")
})

test("unsafe destinations still fall back to Home and missing analytics context writes nothing",async()=>{
  const h=harness()
  await assert.rejects(h.signIn("member@example.test","password","https://outside.example"),{destination:"/dashboard"})
  await h.queued[0]();assert.deepEqual(h.events,[])
})


test("deferred analytics preserves the captured time and client payloads cannot supply it",async()=>{
  const inserted=[]
  const exports={}
  const {outputText}=ts.transpileModule(readFileSync("src/lib/portal-analytics/events.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}})
  new Function("require","exports",outputText)(name=>name.includes("supabase/admin")?{createAdminClient:()=>({from:()=>({insert:async row=>{inserted.push(row);return {error:null}}})})}:{},exports)
  const original=process.env.NODE_ENV
  process.env.NODE_ENV="production"
  try {
    await exports.recordPortalAnalyticsEvent({eventName:"sign_in_success",sessionId:"qa",userId:"verified",occurredAt:"2026-11-01T12:00:00.000Z"})
    assert.equal(inserted[0].occurred_at,"2026-11-01T12:00:00.000Z")
    assert.equal(inserted[0].user_id,"verified")
    const client=exports.sanitizePortalAnalyticsPayload({eventName:"page_view",sessionId:"qa",occurredAt:"fake",occurred_at:"fake"})
    assert.equal(client.occurred_at,undefined);assert.equal(client.occurredAt,undefined)
  } finally {
    if(original===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=original
  }
})
