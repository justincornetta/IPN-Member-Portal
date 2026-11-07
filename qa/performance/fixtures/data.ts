/* eslint-disable @typescript-eslint/no-explicit-any -- Disposable fake PostgREST query builder. */
import type { SupabaseClient } from "@supabase/supabase-js"
type Row = Record<string, any>
export const previewUser = { id: "preview-user", email: "preview@example.test", user_metadata: {} }
export function member(index: number, overrides: Row = {}): Row {
  return { id: `member-${index}`, first_name: `Member ${String(index).padStart(4, "0")}`, last_name: "Example",
    persona: "Graduate student (Master's or PhD)", school: "Example University", affiliation: null,
    field: "Neuroscience", city: "Boston", state: "Massachusetts", country: "United States",
    city_lat: 42.36, city_lng: -71.06, share_location: true, bio: "Interested in community research",
    interest_tags: ["Neuroscience"], linkedin_url: null, avatar_url: null, admin_role: null, team: null,
    is_discoverable: true, ...overrides }
}
export function sampleData(count = 125): Record<string, Row[]> {
  const profiles = Array.from({length: count}, (_, i) => member(i, i >= 60 ? { city: "London", state: null, country: "United Kingdom", city_lat: 51.5, city_lng: -0.12 } : {}))
  profiles.push(member(-1, { ...previewUser, first_name: "Preview", last_name: "Member", role: "member", is_discoverable: false, is_banned: false }))
  const event = {id:"event-1",slug:"community-research-preview",title:"Community research conversation",event_type:"IPN Lab",
    starts_at:"2027-04-15T18:00:00Z",ends_at:"2027-04-15T19:00:00Z",timezone:"America/New_York",summary:"An illustrative community conversation.",
    description:"A sample event for local preview.",speakers:"Example Speaker",location_label:"Online",location_details:null,
    join_url:"https://example.test/join",thumbnail_url:null,registration_url:null,registration_provider:null,external_event_id:null,
    requires_verified_ticket:false,chat_platform:null,chat_external_url:null,chat_status:null,is_recording:false,recording_url:null,
    recording_provider:null,recording_category:null,recording_source_id:null,recording_published_at:null,speaker_resources:null,
    status:"published",registration_count:12,registration_reminder_enabled:false}
  return {profiles, member_education: profiles.map((p,i)=>({id:`education-${i}`,user_id:p.id,institution:"Example University",education_level:"graduate",
    degree_credential:"MSc",area_of_study:"Neuroscience",status:"currently_enrolled",graduation_year:2027,sort_order:0})),
    member_contacts: [], connections: [], member_onboarding_progress:[{user_id:previewUser.id,product_tour_completed_at:"2026-11-01T00:00:00Z"}],
    events:[event,{...event,id:"recording-1",slug:"recording-preview",title:"Research methods recording",is_recording:true,recording_provider:"YouTube",recording_url:"https://example.test/video",recording_published_at:"2026-10-01T12:00:00Z",starts_at:"2026-10-01T12:00:00Z"}],
    conferences:[{id:"conference-1",slug:"conference-preview",name:"Community science gathering",organizer:"Example organization",category:"Conference",
      summary:"A sample conference",description:"Illustrative only",starts_at:"2027-05-01T12:00:00Z",ends_at:"2027-05-02T18:00:00Z",timezone:"UTC",city:"London",state:null,country:"United Kingdom",venue:null,website_url:null,registration_url:null,whatsapp_url:null,meetups:[],discounts:[],rsvp_count:2,status:"published"}],
    event_registrations:[],event_ticket_access:[],conference_meetup_rsvps:[],resources:[],past_conferences:[],conference_rsvps:[]}
}
export type QueryRecord = {table:string; fields:string; started:number; ended?:number; filters:string[]}
export function makeClient(data = sampleData(), options: {latencyMs?:number; failTable?:string; missingTable?:string; missingCode?:string; records?:QueryRecord[]} = {}) {
  class Query {
    private predicates: ((row:Row)=>boolean)[] = []
    private ordering: {key:string; asc:boolean}[] = []
    private start = 0
    private end = Infinity
    private fields = "*"
    private one = false
    private head = false
    private filters: string[] = []
    private table: string
    constructor(table:string) { this.table = table }
    select(fields="*", options?:{head?:boolean}) {this.fields=fields;this.head=!!options?.head;return this}
    eq(key:string,value:unknown){this.predicates.push(r=>r[key]===value);this.filters.push(`${key}=${value}`);return this}
    in(key:string,values:unknown[]){this.predicates.push(r=>values.includes(r[key]));return this}
    ilike(key:string,pattern:string){const regex=new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replaceAll("%",".*").replaceAll("_","."),"i");this.predicates.push(r=>regex.test(r[key]??""));return this}
    overlaps(key:string,values:unknown[]){this.predicates.push(r=>values.some(v=>(r[key]??[]).includes(v)));return this}
    gte(key:string,value:string){this.predicates.push(r=>r[key]>=value);return this}
    not(key:string,_op:string,value:unknown){this.predicates.push(r=>r[key]!==value);return this}
    or(expression:string){this.predicates.push(r=>expression.split(",").some(part=>{const [key,op,...rest]=part.split(".");const value=rest.join(".");return op==="eq"?r[key]===value:op==="gte"?r[key]>=value:false}));return this}
    order(key:string,options?:{ascending?:boolean}){this.ordering.push({key,asc:options?.ascending!==false});return this}
    range(from:number,to:number){this.start=from;this.end=to;return this}
    limit(count:number){this.end=count-1;return this}
    single(){this.one=true;return this}
    maybeSingle(){this.one=true;return this}
    then(resolve: (result:any)=>unknown,reject?: (error:unknown)=>unknown){return this.execute().then(resolve,reject)}
    private async execute(){
      const record={table:this.table,fields:this.fields,started:Date.now(),filters:this.filters} as QueryRecord
      options.records?.push(record)
      await new Promise(resolve=>setTimeout(resolve,options.latencyMs??0))
      record.ended=Date.now()
      if(options.missingTable===this.table)return {data:null,error:{code:options.missingCode??"PGRST205",message:"Table not found in schema cache"},count:null}
      if(options.failTable===this.table)return {data:null,error:{message:"Simulated query failure"},count:null}
      const all=(data[this.table]??[]).filter(r=>this.predicates.every(p=>p(r))).sort((a,b)=>{
        for(const {key,asc} of this.ordering){const c=String(a[key]??"").localeCompare(String(b[key]??""));if(c)return asc?c:-c}return 0})
      let selected=all.slice(this.start,this.end+1).map(r=>({...r}))
      if(this.fields.includes("requester:profiles"))selected=selected.map(r=>({...r,requester:data.profiles.find(p=>p.id===r.requester_id),addressee:data.profiles.find(p=>p.id===r.addressee_id)}))
      else if(this.fields!=="*")selected=selected.map(r=>Object.fromEntries(this.fields.split(",").map(k=>k.trim()).map(k=>[k,r[k]])))
      return {data:this.head?null:this.one?(selected[0]??null):selected,error:null,count:all.length}
    }
  }
  return {from:(table:string)=>new Query(table),auth:{getUser:async()=>({data:{user:previewUser},error:null})}} as unknown as SupabaseClient
}
