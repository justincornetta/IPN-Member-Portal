import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const SLACK_SOURCE = readFileSync(
  new URL("../src/lib/slack/event-rsvp.ts", import.meta.url),
  "utf8",
)
const EVENT_ACTIONS_SOURCE = readFileSync(
  new URL("../src/lib/events/actions.ts", import.meta.url),
  "utf8",
)
const CONFERENCE_ACTIONS_SOURCE = readFileSync(
  new URL("../src/lib/conferences/actions.ts", import.meta.url),
  "utf8",
)

test("event RSVP notifications include the requested Slack fields", () => {
  assert.match(SLACK_SOURCE, /SLACK_EVENT_RSVPS_WEBHOOK_URL/)
  for (const label of [
    "RSVP type",
    "Event",
    "Conference",
    "Notification detail",
    "Member",
    "Email",
    "Cumulative RSVPs",
  ]) {
    assert.match(SLACK_SOURCE, new RegExp(`field\\(\"${label}\"`))
  }
})

test("meetup RSVP notifications are explicitly labeled for Slack", () => {
  assert.match(SLACK_SOURCE, /notification\.kind === "meetup"/)
  assert.match(SLACK_SOURCE, /"New IPN meetup RSVP"/)
  assert.match(SLACK_SOURCE, /rsvpType: meetup\.type \|\| "IPN Meetup"/)
  assert.match(SLACK_SOURCE, /parentConference: conference\.name/)
  assert.match(SLACK_SOURCE, /detail: "Conference meetup"/)
})

test("all three RSVP creation paths schedule non-blocking notifications", () => {
  assert.match(EVENT_ACTIONS_SOURCE, /kind: "event"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /kind: "conference"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /kind: "meetup"/)
  assert.match(EVENT_ACTIONS_SOURCE, /after\(\(\) => sendEventRsvpSlackNotification/)
  assert.equal(
    CONFERENCE_ACTIONS_SOURCE.match(/after\(\(\) => sendEventRsvpSlackNotification/g)?.length,
    2,
  )
})

test("duplicate RSVP retries do not schedule duplicate Slack alerts", () => {
  assert.match(EVENT_ACTIONS_SOURCE, /error\.code !== "23505"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /error\?\.code === "23505"/)
  assert.match(CONFERENCE_ACTIONS_SOURCE, /error\.code !== "23505"/)
  assert.equal(
    [EVENT_ACTIONS_SOURCE, CONFERENCE_ACTIONS_SOURCE]
      .reduce((total, source) => total + (source.match(/if \(isNewRsvp\)/g)?.length ?? 0), 0),
    3,
  )
})

test('member event alerts report combined count rather than member row count',async()=>{
 const ts=await import('typescript')
 const output=ts.default.transpileModule(SLACK_SOURCE,{compilerOptions:{module:ts.default.ModuleKind.CommonJS,target:ts.default.ScriptTarget.ES2022}}).outputText
 const loaded={exports:{}};let payload
 const db={from(table){assert.ok(['events','profiles'].includes(table));const chain={select(){return chain},eq(){return chain},async single(){return {data:table==='events'?{title:'Event',event_type:'Webinar',registration_count:23}:{first_name:'Member',last_name:'Test',email:'member@example.com'}}}};return chain}}
 new Function('require','module','exports',output)(name=>name==='server-only'?{}:{createAdminClient:()=>db},loaded,loaded.exports)
 const oldFetch=global.fetch,oldHook=process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL
 process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL='https://example.invalid';global.fetch=async(url,args)=>{payload=JSON.parse(args.body);return {ok:true}}
 try{await loaded.exports.sendEventRsvpSlackNotification({kind:'event',eventId:'event',userId:'member'});assert.ok(payload.blocks[1].fields.some(f=>f.text==='*Cumulative RSVPs:*\n23'))}
 finally{global.fetch=oldFetch;if(oldHook===undefined)delete process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL;else process.env.SLACK_EVENT_RSVPS_WEBHOOK_URL=oldHook}
})
