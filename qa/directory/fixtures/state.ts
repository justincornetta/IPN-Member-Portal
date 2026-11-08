import type { DirectoryMember, ConnectionEntry } from "@/lib/directory/types"
export const userId = "00000000-0000-4000-8000-000000000001"
export const idFor = (index: number) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`
const samples = [
  ["Maya", "Chen", "Community Research Lab", "Graduate student (Master's or PhD)", "Boston", "MA"],
  ["Daniel", "Rivera", "University of Washington", "Undergraduate student", "Seattle", "WA"],
  ["Amara", "Okafor", "Independent practitioner", "Professional in another field", "London", "UK"],
  ["Sofia", "Martinez", "Open Science Network", "Professional in another field", "Madrid", "Spain"],
  ["Alexander", "Thompson", "University of Edinburgh", "Graduate student (Master's or PhD)", "Edinburgh", "UK"],
  ["Priya", "Shah", "Community Health Collective", "Professional in another field", "New York", "NY"],
]
export const members: DirectoryMember[] = Array.from({ length: 125 }, (_, index) => {
  const sample = samples[index % samples.length]
  return {
    id: idFor(index), first_name: index < 6 ? sample[0] : `Member ${String(index + 1).padStart(3, "0")}`,
    last_name: index < 6 ? sample[1] : "Example", affiliation: sample[2], persona: sample[3],
    school: "Historical University", field: "Neuroscience", city: sample[4], state: sample[5], country: "Sample country",
    city_lat: 42, city_lng: -71, share_location: true, bio: "Interested in connecting with others working in research, education, and community health.",
    interest_tags: ["Neuroscience", "Advocacy"], linkedin_url: null, avatar_url: null, admin_role: null, team: null,
    education: [{id:`education-${index}`,institution:"Historical University",status:"completed",education_level:"graduate",degree_credential:"MSc",area_of_study:"Psychology",graduation_year:2020,sort_order:0}],
  }
})
members[7] = {...members[7], first_name:"Alexandria-Catherine",last_name:"Montgomery-Wellington",affiliation:"International Collaborative Research and Community Education Institute"}
members[8] = {...members[8], affiliation:null,persona:null,school:null,education:[],share_location:false}
export type Row = { id:string;requester_id:string;addressee_id:string;status:string;updated_at?:string }
type State = { connections:Row[];failNext:boolean;loadMoreFailure:boolean;contactFailure:boolean;writes:number }
const root = globalThis as typeof globalThis & {directoryFixture?:State}
export function state(): State { return root.directoryFixture ??= {connections:[],failNext:false,loadMoreFailure:false,contactFailure:false,writes:0} }
export function reset() { root.directoryFixture={connections:[],failNext:false,loadMoreFailure:false,contactFailure:false,writes:0} }
export function connectionMap(): Record<string,ConnectionEntry> {
  return Object.fromEntries(state().connections.map(row=>[row.requester_id===userId?row.addressee_id:row.requester_id,{status:row.status,amRequester:row.requester_id===userId}])) as Record<string,ConnectionEntry>
}
export function contact(id:string) {
  return connectionMap()[id]?.status === "accepted" ? {email:`member-${id.slice(-3)}@example.test`,whatsapp_url:"https://wa.me/15555550100"} : null
}
export function visibleMembers() { return members.map(member=>({...member,contact:contact(member.id)})) }
