import assert from "node:assert/strict"
import test from "node:test"
import { loadDirectory } from "../src/lib/directory/load.ts"
import { summarizeDirectory } from "../src/lib/directory/summary.ts"
import { loadEventsHub } from "../src/lib/events/load-hub.ts"
import { makeClient, sampleData, previewUser } from "../qa/performance/fixtures/data.ts"

test("list and map summaries cover all results, including later pages, with location privacy", async () => {
  const data=sampleData(125)
  data.profiles[124].share_location=false
  data.profiles[123].city_lat=999
  data.profiles[122].country=" United Kingdom "
  const list=await loadDirectory(makeClient(data),previewUser.id,{})
  const map=await loadDirectory(makeClient(data),previewUser.id,{view:"map"})
  assert.equal(list.members.length,60)
  assert.equal(list.hasMore,true)
  assert.deepEqual(list.directorySummary,{totalMembers:125,mappedMembers:123,cities:2,countries:2})
  assert.deepEqual(list.directorySummary,map.directorySummary)
  assert.equal(map.mapCities.reduce((n,c)=>n+c.memberCount,0),123)
  assert.ok(map.mapCities.every(city=>city.members.every(m=>m.share_location)))
})

test("search reaches beyond a database page, including education and reversed accented names", async () => {
  const data=sampleData(1005)
  Object.assign(data.profiles[1004],{first_name:"José",last_name:"Rivera"})
  data.member_education.find(r=>r.user_id==="member-1004").institution="Rare Institute"
  const result=await loadDirectory(makeClient(data),previewUser.id,{q:"rivera jose rare"})
  assert.deepEqual(result.members.map(m=>m.id),["member-1004"])
  assert.equal(result.directorySummary.totalMembers,1)
  assert.equal(result.hasMore,false)
})

test("school, persona, field and tag filters use the same population in both views", async () => {
  const data=sampleData()
  data.member_education[80].institution="Special School"
  const params={school:"Special School",persona:"Graduate student (Master's or PhD)",field:"Neuro",tag:"Neuroscience"}
  const list=await loadDirectory(makeClient(data),previewUser.id,params)
  const map=await loadDirectory(makeClient(data),previewUser.id,{...params,view:"map"})
  assert.equal(list.totalMemberCount,1)
  assert.deepEqual(list.directorySummary,map.directorySummary)
  assert.equal(list.members[0].id,"member-80")
})

test("ordinary browsing launches independent reads together and enrichment together", async () => {
  const records=[]
  await loadDirectory(makeClient(sampleData(),{latencyMs:20,records}),previewUser.id,{})
  const initial=records.filter(r=>r.table!=="member_contacts" && !r.fields.includes("degree_credential"))
  assert.ok(Math.max(...initial.map(r=>r.started)) < Math.min(...initial.map(r=>r.ended)))
  const contacts=records.find(r=>r.table==="member_contacts")
  const education=records.find(r=>r.fields.includes("degree_credential"))
  assert.ok(contacts.started < education.ended && education.started < contacts.ended)
})

test("query failures propagate instead of inventing empty members or contacts", async () => {
  for(const failTable of ["profiles","member_education","connections","member_contacts"])
    await assert.rejects(loadDirectory(makeClient(sampleData(),{failTable}),previewUser.id,{}),/could not be loaded/)
  assert.deepEqual(summarizeDirectory([]),{totalMembers:0,mappedMembers:0,cities:0,countries:0})
})

test("connections retain pending counts and skip missing joined profiles", async () => {
  const data=sampleData()
  data.connections=[{id:"connection-1",requester_id:"member-1",addressee_id:previewUser.id,status:"pending",created_at:"2026-01-01"},
    {id:"deleted",requester_id:"deleted",addressee_id:previewUser.id,status:"accepted",created_at:"2026-01-01"}]
  const result=await loadDirectory(makeClient(data),previewUser.id,{tab:"connections"})
  assert.equal(result.pendingRequestCount,1)
  assert.equal(result.connections.incoming.length,1)
  assert.equal(result.connections.accepted.length,0)
})

test("Events requests only the selected section and parallelizes registration lookups", async () => {
  const records=[]
  const data=sampleData()
  const event=data.events[0]
  event.requires_verified_ticket=true
  event.chat_platform="whatsapp";event.chat_status="active";event.chat_external_url="https://example.test/private-chat"
  data.event_registrations=[{event_id:event.id,user_id:previewUser.id}]
  const upcoming=await loadEventsHub(makeClient(data,{latencyMs:20,records}),previewUser,false)
  assert.equal(upcoming.upcomingEvents[0].is_registered,false)
  assert.equal(upcoming.upcomingEvents[0].join_url,null)
  assert.equal(upcoming.upcomingEvents[0].chat_external_url,"available")
  assert.equal(upcoming.recordings.length,0)
  assert.ok(records.filter(r=>r.table==="events").every(r=>r.filters.includes("is_recording=false")))
  const stateReads=records.filter(r=>["event_registrations","event_ticket_access","conference_meetup_rsvps"].includes(r.table))
  assert.equal(stateReads.length,3)
  assert.ok(Math.max(...stateReads.map(r=>r.started))<Math.min(...stateReads.map(r=>r.ended)))
  const recordingReads=[]
  const recordings=await loadEventsHub(makeClient(data,{records:recordingReads}),previewUser,true)
  assert.equal(recordings.recordings.length,1)
  assert.deepEqual(recordingReads.map(r=>r.table),["events"])
  assert.equal(recordings.recordings[0].chat_external_url,null)
  data.event_ticket_access=[{event_id:event.id,attendee_email_normalized:previewUser.email}]
  const ticketed=await loadEventsHub(makeClient(data),previewUser,false)
  assert.equal(ticketed.upcomingEvents[0].is_registered,true)
  assert.equal(ticketed.upcomingEvents[0].join_url,event.join_url)
})

test("Events failures do not present the empty-state message", async()=>{
  await assert.rejects(loadEventsHub(makeClient(sampleData(),{failTable:"events"}),previewUser,false),/could not be loaded/)
})
