import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
function load(path,deps={}){const loaded={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>deps[name]??{},loaded,loaded.exports);return loaded.exports}
const core=load('src/lib/portal-analytics/event-rsvp.ts')
const event=(stage,path='guest',slug='event-one',time='2026-11-03T10:00:00Z')=>({event_name:'curated_click',session_id:'s1',occurred_at:time,metadata:{flow:'event_rsvp',eventSlug:slug,stage,path}})
test('RSVP observations deduplicate sessions and keep event/path boundaries',()=>{
 const rows=core.buildRsvpJourneys([event('view','visitor'),event('submit'),event('submit'),event('error'),event('confirmed'),event('submit','member'),event('submit','guest','event-two')])
 assert.equal(rows.length,4);assert.deepEqual(rows.find(r=>r.path==='guest'&&r.eventSlug==='event-one').stages,['submit','error','confirmed'])
})
test('account creation attributes only to latest preceding signup in same session',()=>{
 const rows=core.buildRsvpJourneys([event('signup'),event('signup','guest','event-two','2026-11-03T10:01:00Z'),{event_name:'registration_success',session_id:'s1',occurred_at:'2026-11-03T10:02:00Z',metadata:{}},event('join','guest','event-two','2026-11-03T10:03:00Z')])
 assert.equal(rows.find(r=>r.eventSlug==='event-one').signupCompleted,false);assert.equal(rows.find(r=>r.eventSlug==='event-two').signupCompleted,true)
 assert.equal(core.buildRsvpJourneys([event('signup')])[0].signupCompleted,false)
})
test('server RSVP sanitizer discards identity, URLs, raw errors and unexpected metadata',()=>{
 const {sanitizePortalAnalyticsPayload:sanitize}=load('src/lib/portal-analytics/events.ts',{'./event-rsvp':core})
 const safe=sanitize({eventName:'curated_click',sessionId:'s1',pagePath:'/events/rsvp/private-token',referrer:'https://example.com/?email=person@example.com',errorCode:'private failure',metadata:{...event('confirmed').metadata,email:'person@example.com',firstName:'Private',password:'password',rawError:'private failure'}})
 assert.deepEqual(safe.metadata,event('confirmed').metadata);assert.equal(safe.page_path,'/events/event-one');assert.equal(safe.referrer,null);assert.equal(safe.error_code,null)
 assert.equal(sanitize({eventName:'curated_click',sessionId:'s',metadata:{...event('open').metadata,eventSlug:'event?email=person@example.com'}}),null)
})
test('analytics failures never interrupt RSVP and navigation uses beacon with canonical URL',()=>{
 let captured
 const client=load('src/lib/portal-analytics/event-rsvp-client.ts',{'./event-rsvp':core,'./client':{trackPortalEvent(...args){captured=args}}})
 client.trackRsvp('event-one','signup','guest');assert.equal(captured[0],'curated_click');assert.equal(captured[1].referrer,'');assert.equal(captured[2].beacon,true)
 const blocked=load('src/lib/portal-analytics/event-rsvp-client.ts',{'./event-rsvp':core,'./client':{trackPortalEvent(){throw Error('storage blocked')}}})
 assert.doesNotThrow(()=>blocked.trackRsvp('event-one','submit','guest'))
})

test('event totals deduplicate path switches and repeated actions in a session', () => {
 const rows=core.buildRsvpJourneys([
  event('view','visitor'),event('submit','guest'),event('submit','member_login'),
  event('confirmed','member_login'),event('confirmed','member_login'),
  {...event('submit','member'),session_id:'s2'}, {...event('confirmed','member'),session_id:'s2'},
 ])
 const summary=core.summarizeRsvpJourneys(rows)
 assert.equal(summary.sessions,2)
 assert.equal(summary.counts.submit,2)
 assert.equal(summary.counts.confirmed,2)
 assert.equal(summary.success,100)
 assert.equal(summary.counts.view,1)
})
test('member drilldown attributes only authenticated observations, even in shared sessions', () => {
 const rows=core.buildRsvpJourneys([
  event('submit','guest'),
  {...event('confirmed','member_login'),user_id:'member-one'},
  {...event('join','member'),user_id:'member-two'},
  {...event('confirmed','member'),session_id:'s2',user_id:'member-one'},
 ])
 const summary=core.summarizeRsvpJourneys(rows)
 assert.equal(summary.members.length,2)
 const first=summary.members.find(m=>m.userId==='member-one')
 assert.equal(first.sessions.size,2)
 assert.equal(first.stages.get('confirmed').size,2)
 assert.equal(first.stages.has('submit'),false)
 assert.equal(first.stages.has('join'),false)
 const second=summary.members.find(m=>m.userId==='member-two')
 assert.equal(second.stages.get('join').size,1)
 assert.equal(second.stages.has('confirmed'),false)
 assert.equal(JSON.stringify(rows).includes('"session_id"'),false)
})
test('same-session account creation identifies its account without relabeling guest actions', () => {
 const rows=core.buildRsvpJourneys([
  event('signup'),
  {event_name:'registration_success',session_id:'s1',user_id:'new-member',occurred_at:'2026-11-03T11:00:00Z',metadata:{}},
 ])
 const summary=core.summarizeRsvpJourneys(rows)
 assert.equal(summary.accounts,1)
 assert.equal(summary.members[0].accountCreated,true)
 assert.equal(summary.members[0].stages.size,0)
})
test('event cohorts use first retained session observation across paths and keep events separate', () => {
 const rows=core.buildRsvpJourneys([
  event('view','visitor','event-one','2026-11-03T23:59:00Z'),
  event('submit','member_login','event-one','2026-11-04T00:01:00Z'),
  event('submit','guest','event-two','2026-11-04T00:02:00Z'),
 ])
 assert.equal(rows[0].date,rows[1].date)
 assert.equal(rows[1].date,'2026-11-03')
 assert.equal(rows[0].sessionGroup,rows[1].sessionGroup)
 assert.notEqual(rows[0].sessionGroup,rows[2].sessionGroup)
})
