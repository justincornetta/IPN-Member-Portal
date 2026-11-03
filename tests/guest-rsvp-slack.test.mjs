import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const source=readFileSync('src/lib/slack/guest-event-rsvp.ts','utf8')
function load(db){
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const loaded={exports:{}}
 new Function('require','module','exports',output)(name=>name==='server-only'?{}:{createAdminClient:()=>db},loaded,loaded.exports)
 return loaded.exports.sendGuestEventRsvpSlackNotification
}
test('guest alerts claim once, escape input, include combined count and tolerate Slack failure',async()=>{
 const originalFetch=global.fetch,env={...process.env};let claimed=false,calls=0,payload
 process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL='https://example.invalid/hook'
 process.env.GUEST_EVENT_EMAIL_MODE='live';process.env.CONTEXT='production'
 const db={from(){const chain={update(){return chain},eq(){return chain},is(){return chain},select(){return chain},async maybeSingle(){if(claimed)return {data:null};claimed=true;return {data:{event_id:'event',first_name:'<@here>',last_name:'Guest',email:'guest@example.com'}}},async single(){return {data:{title:'Event & talk',event_type:'Webinar',registration_count:7}}}};return chain}}
 global.fetch=async(_url,args)=>{calls++;payload=JSON.parse(args.body);return {ok:true}}
 try{
  const send=load(db)
  await Promise.all([send('guest-id'),send('guest-id')])
  assert.equal(calls,1)
  assert.match(JSON.stringify(payload),/Guest \(no IPN account\)/)
  assert.match(JSON.stringify(payload),/&lt;@here&gt;/)
  assert.match(JSON.stringify(payload),/Cumulative RSVPs/)
  assert.match(JSON.stringify(payload),/7/)
  process.env.CONTEXT='deploy-preview';claimed=false;await send('another-id');assert.equal(claimed,false)
  process.env.CONTEXT='production';await send(null);assert.equal(calls,1)
  global.fetch=async()=>{calls++;throw Error('timeout')}
  await assert.doesNotReject(()=>send('failure-id'))
  await send('failure-id');assert.equal(calls,2)
 }finally{global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env)}
})
