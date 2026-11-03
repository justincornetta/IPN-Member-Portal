import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {createRequire} from "node:module"
import {resolve,dirname} from "node:path"
import ts from "typescript"
import {PGlite} from "@electric-sql/pglite"
import {parseGuestInput,guestRsvpAvailable,emailSchedule,safeWebUrl} from "../src/lib/guest-events/domain.ts"
import {guestPreviewBuild} from "../scripts/guest-preview-build.mjs"
import {guestToken,readGuestToken} from "../src/lib/guest-events/tokens.ts"

const root=resolve(import.meta.dirname,"..")
const nativeRequire=createRequire(import.meta.url)
function load(relative,mocks={},cache=new Map()){
 const filename=resolve(root,relative)
 if(cache.has(filename))return cache.get(filename).exports
 const loadedModule={exports:{}};cache.set(filename,loadedModule)
 const compiled=ts.transpileModule(readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 new Function("require","module","exports",compiled)(name=>{
   if(name in mocks)return mocks[name]
   if(name.endsWith(".json")){return JSON.parse(readFileSync(resolve(dirname(filename),name),"utf8"))}
   if(name.startsWith(".")){return load(resolve(dirname(filename),name+".ts"),mocks,cache)}
   return nativeRequire(name)
 },loadedModule,loadedModule.exports)
 return loadedModule.exports
}
const event={id:"11111111-1111-4111-8111-111111111111",slug:"test",title:"Research & <community>",starts_at:"2030-01-03T18:00:00Z",ends_at:"2030-01-03T19:00:00Z",timezone:"UTC",status:"published",is_recording:false,requires_verified_ticket:false,registration_url:null,guest_rsvp_enabled:true,join_url:"https://example.com/meeting",summary:null,description:null,location_label:"Online",location_details:null,speakers:"Test speaker"}
const guest={id:"22222222-2222-4222-8222-222222222222",event_id:event.id,first_name:"Alex <script>",last_name:"Rivera",email:"alex@example.com",marketing_opt_in:true,cancelled_at:null,converted_user_id:null}

test("guest validation rejects invalid identity and bot fields; consent requires explicit true",()=>{
 assert.deepEqual(parseGuestInput({firstName:" Alex ",lastName:"Rivera",email:" ALEX@EXAMPLE.COM ",marketingOptIn:"true"}),{firstName:"Alex",lastName:"Rivera",email:"alex@example.com",marketingOptIn:false})
 for(const values of [{email:"bad"},{firstName:"<script>"},{lastName:""},{website:"spam"}])
   assert.throws(()=>parseGuestInput({firstName:"Alex",lastName:"Rivera",email:"alex@example.com",...values}))
 assert.equal(safeWebUrl("javascript:alert(1)"),null)
 for(const override of [{requires_verified_ticket:true},{registration_url:"https://tickets.example"},{status:"draft"},{is_recording:true},{guest_rsvp_enabled:false}])
  assert.equal(guestRsvpAvailable({...event,...override},Date.parse("2030-01-01")),false)
})
test("reminders do not backfill already-passed windows; optional invitation follows event end",()=>{
 assert.deepEqual(emailSchedule(event,false,Date.parse("2030-01-03T17:30:00Z")).map(x=>x.kind),["rsvp_confirmation"])
 const jobs=emailSchedule(event,true,Date.parse("2030-01-01"))
 assert.deepEqual(jobs.map(x=>x.kind),["rsvp_confirmation","reminder_24h","reminder_1h","membership_invitation"])
 assert.equal(jobs[3].due_at,"2030-01-04T19:00:00.000Z")
})
test("guest access tokens cannot be modified or used as auth credentials",()=>{
 const previous=process.env.GUEST_EVENT_TOKEN_SECRET;process.env.GUEST_EVENT_TOKEN_SECRET="test-secret-long-enough-for-guest-tokens"
 try{const token=guestToken(guest.id);assert.equal(readGuestToken(token),guest.id);assert.equal(readGuestToken(token+"x"),null);assert.equal(readGuestToken("bad"),null);assert.equal(readGuestToken(event.id+"."+token.split(".")[1]),null)}finally{if(previous===undefined)delete process.env.GUEST_EVENT_TOKEN_SECRET;else process.env.GUEST_EVENT_TOKEN_SECRET=previous}
})
test("email templates provide direct joining, escape content, and separate marketing unsubscribe",()=>{
 const {renderGuestEmail}=load("src/lib/guest-events/email-content.ts")
 for(const kind of ["rsvp_confirmation","reminder_24h","reminder_1h","membership_invitation"]){
  const content=renderGuestEmail({kind,event,guest,site:"https://portal.example",token:"signed-token"})
  assert.doesNotMatch(content.html,/<script>/)
  assert.match(content.html,/&lt;script&gt;/)
  assert.doesNotMatch(content.html,/\/dashboard/)
  if(kind==="membership_invitation"){assert.match(content.html,/Unsubscribe/);assert.ok(content.headers["List-Unsubscribe-Post"]);assert.match(content.html,/signed-token\?join=1/)}
  else{assert.match(content.text,/https:\/\/example.com\/meeting/);assert.equal(content.headers,undefined);assert.match(content.text,/cancel RSVP/)}
 }
})
async function database(){
 const db=new PGlite()
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create table public.events(id uuid primary key,starts_at timestamptz,ends_at timestamptz,status text,is_recording boolean default false,requires_verified_ticket boolean default false,registration_url text,registration_count integer default 0);
 create table public.profiles(id uuid primary key,email text,is_discoverable boolean default true,share_location boolean default true);
 create table public.event_registrations(event_id uuid references events,user_id uuid references auth.users on delete cascade,created_at timestamptz default now(),primary key(event_id,user_id));
 grant usage on schema public,auth to service_role;
 grant all on all tables in schema public,auth to service_role;
 create function public.test_member_count() returns trigger language plpgsql as $$ begin
 if tg_op='INSERT' then update events set registration_count=registration_count+1 where id=new.event_id;return new;end if;
 update events set registration_count=greatest(0,registration_count-1) where id=old.event_id;return old;end $$;
 create trigger member_count after insert or delete on event_registrations for each row execute function test_member_count();
 `)
 await db.exec(readFileSync(resolve(root,"supabase/migrations/20261103033258_guest_event_rsvp.sql"),"utf8"))
 await db.query("insert into events(id,starts_at,ends_at,status,guest_rsvp_enabled) values($1,now()+interval '3 days',now()+interval '3 days 1 hour','published',true)",[event.id])
 return db
}
async function register(db,optIn=true,email="alex@example.com"){return (await db.query("select register_guest_event($1,'Alex','Rivera',$2,$3) as id",[event.id,email,optIn])).rows[0].id}
test("SQL RSVP and outbox are atomic, deduplicate, preserve consent and protect private rows",async()=>{
 const db=await database();try{
  await db.exec("set role service_role")
  const id=await register(db,false)
  assert.equal(await register(db,true),id)
  assert.equal((await db.query("select * from guest_event_registrations")).rows[0].marketing_opt_in,false)
  assert.equal((await db.query("select count(*)::int as n from guest_event_email_deliveries")).rows[0].n,3)
  assert.equal((await db.query("select registration_count from events")).rows[0].registration_count,1)
  await db.exec("set role anon")
  await assert.rejects(()=>db.query("select * from guest_event_registrations"),/permission denied/)
  await assert.rejects(()=>register(db),/permission denied/)
  await db.exec("reset role")
  await db.query("update events set requires_verified_ticket=true where id=$1",[event.id])
  await assert.rejects(()=>register(db,false,"other@example.com"),/Event unavailable/)
 }finally{await db.close()}
})
test("SQL links only verified email owners; converts without double counting; syncs member cancellation",async()=>{
 const db=await database();try{
  const id=await register(db)
  const user="33333333-3333-4333-8333-333333333333"
  await db.query("insert into auth.users(id,email) values($1,$2)",[user,guest.email])
  assert.equal((await db.query("select claim_guest_event_registrations($1) as n",[user])).rows[0].n,0)
  await db.query("update auth.users set email_confirmed_at=now() where id=$1",[user])
  assert.equal((await db.query("select claim_guest_event_registrations($1) as n",[user])).rows[0].n,1)
  assert.equal((await db.query("select claim_guest_event_registrations($1) as n",[user])).rows[0].n,0)
  assert.equal((await db.query("select registration_count from events")).rows[0].registration_count,1)
  assert.equal(await register(db),null)
  await db.query("delete from event_registrations where user_id=$1",[user])
  assert.ok((await db.query("select cancelled_at from guest_event_registrations where id=$1",[id])).rows[0].cancelled_at)
  assert.equal((await db.query("select registration_count from events")).rows[0].registration_count,0)
 }finally{await db.close()}
})
test("SQL email leases are exclusive, retry window is bounded, and rate limit is durable",async()=>{
 const db=await database();try{
  await register(db)
  const first=(await db.query("select * from claim_guest_event_emails(25)")).rows
  assert.equal(first.length,1)
  assert.equal((await db.query("select * from claim_guest_event_emails(25)")).rows.length,0)
  await db.query("update guest_event_email_deliveries set first_attempt_at=now()-interval '24 hours',locked_at=now()-interval '11 minutes' where id=$1",[first[0].id])
  assert.equal((await db.query("select * from claim_guest_event_emails(25)")).rows.length,0)
  assert.equal((await db.query("select status from guest_event_email_deliveries where id=$1",[first[0].id])).rows[0].status,"review")
  assert.equal((await db.query("select guest_event_rate_limit('test',1) as ok")).rows[0].ok,true)
  assert.equal((await db.query("select guest_event_rate_limit('test',1) as ok")).rows[0].ok,false)
 }finally{await db.close()}
})

test("SQL unsubscribe preserves RSVP; cancellation rolls back if linked member removal fails",async()=>{
 const db=await database();try{
  const id=await register(db)
  await db.query("select update_guest_event_preference($1,'unsubscribe')",[id])
  let row=(await db.query("select * from guest_event_registrations where id=$1",[id])).rows[0]
  assert.equal(row.marketing_opt_in,false);assert.equal(row.cancelled_at,null)
  const user="33333333-3333-4333-8333-333333333333"
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[user,guest.email])
  await db.query("select claim_guest_event_registrations($1)",[user])
  await db.exec("create function stop_member_delete() returns trigger language plpgsql as $$ begin raise exception 'test rollback'; end $$; create trigger stop_delete before delete on event_registrations for each row execute function stop_member_delete();")
  await assert.rejects(()=>db.query("select update_guest_event_preference($1,'cancel')",[id]),/test rollback/)
  row=(await db.query("select * from guest_event_registrations where id=$1",[id])).rows[0]
  assert.equal(row.cancelled_at,null)
  await db.exec("drop trigger stop_delete on event_registrations")
  await db.query("select update_guest_event_preference($1,'cancel')",[id])
  assert.equal((await db.query("select count(*)::int as n from event_registrations")).rows[0].n,0)
  assert.equal((await db.query("select registration_count from events")).rows[0].registration_count,0)
 }finally{await db.close()}
})
function workerHarness({kind="rsvp_confirmation",guestChange={},eventChange={},members=[],payload=null,failLedger=false}={}){
 const job={id:"job-1",registration_id:guest.id,kind,payload,locked_at:"lease-1",attempt_count:1}
 const activeEvent={...event,starts_at:new Date(Date.now()+1800000).toISOString(),ends_at:new Date(Date.now()+5400000).toISOString(),...eventChange}
 const activeGuest={...guest,...guestChange}
 const writes=[],sent=[]
 const db={rpc:async()=>({data:[job],error:null}),from(table){
   let patch
   const query={select(){return query},eq(){return query},ilike(){return query},limit(){return query},single(){return query},update(value){patch=value;return query},then(resolve){
     if(patch){writes.push(patch);if(patch.payload)job.payload=patch.payload;return resolve({data:null,error:failLedger&&patch.status==="sent"?new Error("ledger failed"):null})}
     return resolve({data:table==="guest_event_registrations"?activeGuest:table==="events"?activeEvent:members,error:null})
   }};return query
 }}
 const {processGuestEventEmails}=load("src/lib/guest-events/service.ts",{
  "../supabase/admin":{createAdminClient:()=>db},"./demo":{guestDemoEnabled:()=>false},
  resend:{Resend:class{emails={send:async(body,options)=>{sent.push({body,options});return {data:{id:"resend-1"},error:null}}}}}
 })
 return {run:processGuestEventEmails,writes,sent,job}
}
async function liveTest(fn){
 const values={GUEST_EVENT_RSVP_ENABLED:"true",GUEST_EVENT_EMAIL_MODE:"live",CONTEXT:"production",RESEND_API_KEY:"fake-test-key",GUEST_EVENT_TOKEN_SECRET:"test-secret-long-enough-for-guest-tokens",NEXT_PUBLIC_SITE_URL:"https://portal.example"}
 const prior=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values)
 try{await fn()}finally{for(const [k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
}
test("sender checks current cancellation, eligibility and invitation consent before delivery",()=>liveTest(async()=>{
 for(const config of [{guestChange:{cancelled_at:new Date().toISOString()}},{eventChange:{status:"draft"}},{eventChange:{requires_verified_ticket:true}},{eventChange:{guest_rsvp_enabled:false}},{kind:"membership_invitation",guestChange:{marketing_opt_in:false}},{kind:"membership_invitation",guestChange:{converted_user_id:"member"}},{kind:"membership_invitation",members:[{id:"member"}]}]){
  const h=workerHarness(config);assert.equal((await h.run()).skipped,1);assert.equal(h.sent.length,0)
 }
}))
test("sender persists immutable payload before sending and reuses its key after ledger failure",()=>liveTest(async()=>{
 const h=workerHarness({failLedger:true});await h.run()
 assert.ok(h.writes[0].payload)
 assert.equal(h.sent.length,1)
 assert.equal(h.writes.some(w=>w.status==="failed"),false)
 await h.run()
 assert.deepEqual(h.sent[0],h.sent[1])
 assert.equal(h.sent[0].options.idempotencyKey,"guest-event/job-1")
}))
test("sender postpones fresh reminders after reschedule, but flags uncertain delivery for review",()=>liveTest(async()=>{
 const eventChange={starts_at:new Date(Date.now()+86400000*3).toISOString()}
 const fresh=workerHarness({kind:"reminder_1h",eventChange});await fresh.run()
 assert.equal(fresh.sent.length,0);assert.equal(fresh.writes[0].status,"pending")
 const uncertain=workerHarness({kind:"reminder_1h",eventChange,payload:{subject:"original"}});await uncertain.run()
 assert.equal(uncertain.sent.length,0);assert.equal(uncertain.writes[0].status,"review")
}))
test("preview contexts cannot deliver guest emails even with live mode configured",()=>liveTest(async()=>{
 process.env.CONTEXT="deploy-preview"
 const h=workerHarness();assert.equal((await h.run()).disabled,true);assert.equal(h.sent.length,0)
}))

function memberActionHarness({eventChange={},authError=false,session=false,registrationError=false,unavailableAfterLogin=false,banned=false}={}){
 const calls=[];let signedIn=session;let reads=0
 const active={...event,starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+90000000).toISOString(),...eventChange}
 const service=load("src/lib/events/public-rsvp-actions.ts",{
  "../supabase/server":{createClient:async()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{is_banned:banned},error:null})})})}),auth:{
    signInWithPassword:async()=>{calls.push("login");signedIn=!authError;return {data:{user:signedIn?{id:"verified-member"}:null},error:authError?new Error("private auth error"):null}},
    getUser:async()=>({data:{user:signedIn?{id:"verified-member"}:null},error:null})
  }})},
  "../guest-events/service":{readGuestEvent:async()=>{reads++;return unavailableAfterLogin&&reads>1?null:active}},
  "../guest-events/demo":{guestDemoEnabled:()=>false},
  "./actions":{registerForEvent:async(id,slug)=>{calls.push({id,slug});return registrationError?{error:"database internal detail"}:{}}}
 })
 return {calls,...service}
}
test("event-specific login automatically RSVPs the verified member for the server-resolved event",async()=>{
 const h=memberActionHarness({eventChange:{guest_rsvp_enabled:false}})
 const result=await h.signInAndRsvpForEvent("test",{email:"member@example.com",password:"test-password"})
 assert.equal(result.ok,true);assert.equal(result.signedIn,true)
 assert.deepEqual(h.calls,["login",{id:event.id,slug:"test"}])
 assert.equal(result.joinUrl,event.join_url)
})
test("failed login never creates an RSVP or exposes joining details; invalid events reject before auth",async()=>{
 const h=memberActionHarness({authError:true})
 const result=await h.signInAndRsvpForEvent("test",{email:"member@example.com",password:"wrong"})
 assert.equal(result.ok,undefined);assert.equal(result.joinUrl,undefined);assert.deepEqual(h.calls,["login"])
 assert.doesNotMatch(result.error,/private auth/)
 for(const change of [{requires_verified_ticket:true},{registration_url:"https://tickets.example"},{status:"draft"},{is_recording:true},{ends_at:"2000-01-01"}]){
  const unavailable=memberActionHarness({eventChange:change});assert.ok((await unavailable.signInAndRsvpForEvent("test",{email:"member@example.com",password:"password"})).error);assert.equal(unavailable.calls.length,0)
 }
})
test("member RSVP requires a verified session and is independent of guest enrollment",async()=>{
 const out=memberActionHarness();assert.equal((await out.rsvpFromEventPage("test")).needsSignIn,true);assert.equal(out.calls.length,0)
 const member=memberActionHarness({session:true,eventChange:{guest_rsvp_enabled:false}});assert.equal((await member.rsvpFromEventPage("test")).ok,true);assert.equal(member.calls.length,1)
})
test("login success with RSVP failure keeps the member signed in and rechecks event eligibility",async()=>{
 for(const config of [{registrationError:true},{unavailableAfterLogin:true}]){
  const h=memberActionHarness(config);const result=await h.signInAndRsvpForEvent("test",{email:"member@example.com",password:"password"})
  assert.equal(result.signedIn,true);assert.equal(result.ok,undefined);assert.match(result.error,/signed in.*couldn’t save/);assert.equal(result.joinUrl,undefined)
 }
})

test("public member RSVP preserves the portal account-ban restriction",async()=>{
 const h=memberActionHarness({session:true,banned:true})
 const result=await h.rsvpFromEventPage("test")
 assert.equal(result.ok,undefined);assert.equal(result.joinUrl,undefined);assert.equal(h.calls.length,0)
})

test("hosted sandbox is compiled only for PR 70 on its approved branch",()=>{
 const keys=["CONTEXT","REVIEW_ID","BRANCH"]
 const saved=keys.map(k=>process.env[k])
 try {
  for(const [context,id,branch,expected] of [["production","70","feature/guest-event-rsvp","0"],["deploy-preview","71","feature/guest-event-rsvp","0"],["deploy-preview","70","main","0"],["deploy-preview","70","feature/guest-event-rsvp","1"]]){
   [process.env.CONTEXT,process.env.REVIEW_ID,process.env.BRANCH]=[context,id,branch]
   assert.equal(String(Number(guestPreviewBuild(process.env).enabled)),expected)
  }
 }finally{keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i])}
})

test("hosted sandbox refuses database/auth clients before accessing credentials",async()=>{
 const saved=process.env.IPN_GUEST_SANDBOX_ENABLED;process.env.IPN_GUEST_SANDBOX_ENABLED="1"
 const fail=()=>{throw new Error("LIVE CLIENT REACHED")}
 try {
  assert.throws(()=>load("src/lib/supabase/admin.ts",{"../guest-events/preview-mode":{hostedGuestPreview:()=>true},"@supabase/supabase-js":{createClient:fail}}).createAdminClient(),/disabled in/)
  await assert.rejects(()=>load("src/lib/supabase/server.ts",{"../guest-events/preview-mode":{hostedGuestPreview:()=>true},"@supabase/ssr":{createServerClient:fail},"next/headers":{cookies:async()=>({})}}).createClient(),/disabled in/)
  assert.throws(()=>load("src/lib/supabase/client.ts",{"../guest-events/preview-mode":{hostedGuestPreview:()=>true},"@supabase/ssr":{createBrowserClient:fail}}).createClient(),/disabled in/)
 }finally{if(saved===undefined)delete process.env.IPN_GUEST_SANDBOX_ENABLED;else process.env.IPN_GUEST_SANDBOX_ENABLED=saved}
})

test("hosted guest RSVP uses per-browser state and cannot deliver even if live flags are inherited",async()=>{
 const keys=["IPN_GUEST_SANDBOX_ENABLED","GUEST_EVENT_EMAIL_MODE","CONTEXT"]
 const saved=keys.map(k=>process.env[k]);[process.env.IPN_GUEST_SANDBOX_ENABLED,process.env.GUEST_EVENT_EMAIL_MODE,process.env.CONTEXT]=["1","live","production"]
 let writes=0
 try {
  const svc=load("src/lib/guest-events/service.ts",{"./preview-mode":{hostedGuestPreview:()=>true,previewEventSlug:"global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional"},"../supabase/admin":{createAdminClient:()=>{throw new Error("LIVE DATABASE REACHED")}},"resend":{Resend:class{constructor(){throw new Error("LIVE EMAIL REACHED")}}},"./preview-store":{registerPreviewGuest:async()=>writes++}})
  const result=await svc.submitGuestRsvp("global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional",{firstName:"Test",lastName:"Guest",email:"guest@example.com"},new Request("https://preview.example"))
  assert.equal(writes,1);assert.equal(result.demo,true);assert.equal(result.emailStatus,"preview")
  assert.equal((await svc.processGuestEventEmails()).disabled,true)
 }finally{keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i])}
})

test("sandbox cookies survive fresh module instances but remain separate between browsers",async()=>{
 const saved=process.env.IPN_GUEST_SANDBOX_ENABLED;process.env.IPN_GUEST_SANDBOX_ENABLED="1"
 const a=new Map(),b=new Map();let jar=a
 const mocks={"./preview-mode":{hostedGuestPreview:()=>true,previewEventSlug:"global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional"},"next/headers":{cookies:async()=>({get:k=>jar.has(k)?{value:jar.get(k)}:undefined,set:(k,v,opts)=>{assert.equal(opts.httpOnly,true);assert.equal(opts.sameSite,"lax");jar.set(k,v)}})}}
 try {
  const one=load("src/lib/guest-events/preview-store.ts",mocks)
  const first=await one.registerPreviewGuest({firstName:"Test",lastName:"Guest",email:"guest@example.com",marketingOptIn:true})
  const two=load("src/lib/guest-events/preview-store.ts",mocks)
  assert.equal((await two.readPreviewGuest()).id,first.id)
  jar=b;assert.equal(await two.readPreviewGuest(),null)
  jar=a;await two.savePreviewGuest({...first,cancelled_at:new Date().toISOString()});assert.ok((await one.readPreviewGuest()).cancelled_at)
  jar.set("ipn-rsvp-sandbox","invalid");assert.equal(await one.readPreviewGuest(),null)
 }finally{if(saved===undefined)delete process.env.IPN_GUEST_SANDBOX_ENABLED;else process.env.IPN_GUEST_SANDBOX_ENABLED=saved}
})

test("sandbox route allowlist rejects portal, callbacks, analytics and unrelated APIs",()=>{
 const {previewPathAllowed}=load("src/lib/guest-events/preview-mode.ts")
 for(const path of ["/dashboard","/api/analytics/track","/auth/callback","/login","/api/events/other-event/rsvp","/api/events/membership/extra"])assert.equal(previewPathAllowed(path),false,path)
 for(const path of ["/join","/event-preview/emails","/api/events/membership","/events/guest-rsvp-preview"])assert.equal(previewPathAllowed(path),true,path)
})

test("all Netlify background handlers stop at the platform's deploy-preview boundary",async()=>{
 const {readdirSync}=nativeRequire("node:fs")
 for(const name of readdirSync(resolve(root,"netlify/functions"))){
  if(!/\.(mts|ts)$/.test(name))continue
  const source=readFileSync(resolve(root,"netlify/functions",name),"utf8")
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const handlerModule={exports:{}}
  const fail=()=>{throw new Error("BACKGROUND SIDE EFFECT REACHED: "+name)}
  new Function("require","module","exports",compiled)(()=>new Proxy({},{get:()=>fail}),handlerModule,handlerModule.exports)
  const result=await handlerModule.exports.default(new Request("https://preview.example"),{deploy:{context:"deploy-preview"}})
  assert.equal(result.status,403,name)
 }
})
