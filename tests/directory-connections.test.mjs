import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import ts from "typescript"

function load(path, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  new Function("require", "exports", outputText)((name) => {
    if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`)
    return imports[name]
  }, exports)
  return exports
}
const { memberAffiliation, memberLocation } = load("src/lib/directory/presentation.ts")
const { directoryQueryKey, reconcileDirectoryMembers } = load("src/lib/directory/browsing-state.ts")
const member = { id: "m", affiliation: "Current organization", school: "Old school", persona: "Professional in another field", education: [{ institution: "University", status: "completed" }], contact: {email:"private@example.test"} }

test("explicit affiliation outranks education, and whitespace is absent", () => {
  assert.equal(memberAffiliation(member), "Current organization")
  assert.equal(memberAffiliation({...member,affiliation:" "}), null)
  assert.equal(memberAffiliation({...member,affiliation:null,education:[{institution:"Current school",status:"currently_enrolled"}]}), "Current school")
  assert.equal(memberAffiliation({...member,affiliation:null,education:[],persona:"Undergraduate student"}), "Old school")
})
test("location respects sharing", () => {
  assert.equal(memberLocation({...member, city:"Boston",state:"MA",share_location:false}),null)
  assert.equal(memberLocation({...member, city:"Boston",state:"MA",share_location:true}),"Boston, MA")
})
test("profile reopen rechecks the connection before reading contacts", async () => {
  const a = actions([ok([])])
  assert.deepEqual(await a.getConnectionDetails("other"), {entry:{status:"declined",amRequester:true},contact:null})
  assert.deepEqual(a.calls.map(c=>c.table), ["connections"])
  const b = actions([ok([{requester_id:"other",addressee_id:"self",status:"accepted"}]),ok({email:"other@example.test",whatsapp_url:null})])
  const result = await b.getConnectionDetails("other")
  assert.equal(result.entry.status,"accepted")
  assert.equal(result.contact.email,"other@example.test")
})
test("a same-query refresh retains later pages, updates by ID, and deduplicates", () => {
  const a={...member,id:"a"}, b={...member,id:"b"}, c={...member,id:"c"}
  const result=reconcileDirectoryMembers([a,b,c],[{...a,affiliation:"Updated"},b],{},"self")
  assert.deepEqual(result.map(m=>m.id),["a","b","c"])
  assert.equal(result[0].affiliation,"Updated")
})
test("refresh removes retained contact data when a connection is no longer accepted", () => {
  assert.equal(reconcileDirectoryMembers([member],[],{},"self")[0].contact,null)
  assert.equal(reconcileDirectoryMembers([member],[],{m:{status:"accepted"}},"self")[0].contact.email,"private@example.test")
})
test("query identity ignores array ordering but changes on filters or account", () => {
  const p={q:"",tab:"all",school:"",field:"",personas:["a","b"],tags:[]}
  assert.equal(directoryQueryKey(p,"list","u"),directoryQueryKey({...p,personas:["b","a"]},"list","u"))
  assert.notEqual(directoryQueryKey(p,"list","u"),directoryQueryKey({...p,q:"Alice"},"list","u"))
  assert.notEqual(directoryQueryKey(p,"list","u"),directoryQueryKey(p,"list","v"))
})
function actions(responses,user={id:"self"}) {
  const calls=[],notices=[]
  const db={auth:{getUser:async()=>({data:{user}})},from(table){
    const response=responses.shift()
    assert.ok(response,`Unexpected query ${table}`)
    const call={table,steps:[]};calls.push(call)
    const chain=new Proxy({}, {get(_,name){
      if(name==="then")return (resolve)=>Promise.resolve(response).then(resolve)
      return (...args)=>{call.steps.push([name,...args]);return chain}
    }});return chain
  }}
  const mod=load("src/lib/connections/actions.ts",{
    "@/lib/supabase/server":{createClient:async()=>db},
    "next/cache":{revalidatePath:()=>{}},
    "@/lib/onboarding/progress":{markOnboardingStepsComplete:async()=>{}},
    "@/lib/member-notifications/email-service":{
      notifyConnectionRequestReceived:async()=>notices.push("received"),
      notifyConnectionRequestAccepted:async()=>notices.push("accepted"),
    },
  })
  return {...mod,calls,notices}
}
const ok=(data)=>({data,error:null})
test("Connect returns pending and never reads contacts before acceptance",async()=>{
  const a=actions([ok(null),ok(null),ok({id:"connection",requester_id:"self",addressee_id:"other"})])
  assert.deepEqual(await a.sendConnectionRequest("other"),{entry:{status:"pending",amRequester:true},contact:null})
  assert.deepEqual(a.calls.map(c=>c.table),["connections","connections","connections"])
  assert.deepEqual(a.notices,["received"])
})
test("Connect auto-accepts incoming request and returns authorized contacts",async()=>{
  const a=actions([ok({status:"pending"}),ok({id:"c",requester_id:"other",addressee_id:"self"}),ok({email:"other@example.test",whatsapp_url:null})])
  const r=await a.sendConnectionRequest("other")
  assert.equal(r.entry.status,"accepted");assert.equal(r.entry.amRequester,false)
  assert.equal(r.contact.email,"other@example.test")
  assert.deepEqual(a.notices,["accepted"])
  assert.ok(a.calls[2].steps.some(s=>s[0]==="eq"&&s[1]==="user_id"&&s[2]==="other"))
})
test("already accepted returns accepted without sending another notification",async()=>{
  const a=actions([ok({status:"accepted"}),ok(null)])
  assert.equal((await a.sendConnectionRequest("other")).entry.status,"accepted")
  assert.deepEqual(a.notices,[])
})
test("failed connection read does not proceed to a mutation",async()=>{
  const a=actions([{data:null,error:{message:"offline"}}])
  assert.ok((await a.sendConnectionRequest("other")).error)
  assert.equal(a.calls.length,1)
})
test("accept does not report success for a withdrawn request",async()=>{
  const a=actions([ok(null),ok(null)])
  assert.ok((await a.acceptConnection("other")).error)
  assert.deepEqual(a.notices,[])
})
test("contact query failure preserves accepted status with an explicit warning",async()=>{
  const a=actions([ok({id:"c"}),{data:null,error:{message:"offline"}}])
  const r=await a.acceptConnection("other")
  assert.equal(r.entry.status,"accepted");assert.equal(r.contact,null);assert.ok(r.contactWarning)
})
test("removal clears contact data and mutation failure is returned",async()=>{
  const a=actions([ok(null)])
  assert.deepEqual(await a.removeConnection("other"),{entry:{status:"declined",amRequester:true},contact:null})
  const b=actions([{data:null,error:{message:"failed"}}])
  assert.equal((await b.removeConnection("other")).error,"failed")
})
test("unauthenticated requests never query tables",async()=>{
  const a=actions([],null)
  assert.ok((await a.sendConnectionRequest("other")).error)
  assert.equal(a.calls.length,0)
})
