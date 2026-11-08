import { state, userId, members, contact } from "./state"
type RecordRow = Record<string, unknown>
class Query {
  table:string; checks:((row:RecordRow)=>boolean)[]=[]; singleRow=false; start=0;end=Infinity; operation="read"; payload:RecordRow={}
  constructor(table:string){this.table=table}
  select(){return this}
  eq(key:string,value:unknown){this.checks.push(row=>row[key]===value);return this}
  in(key:string,values:unknown[]){this.checks.push(row=>values.includes(row[key]));return this}
  or(value:string){
    if(this.table==="connections"){
      const ids=[...value.matchAll(/[0-9a-f]{8}-[0-9a-f-]{27}/g)].map(match=>match[0])
      const other=ids.find(id=>id!==userId)
      this.checks.push(row=>other ? ((row.requester_id===userId&&row.addressee_id===other)||(row.addressee_id===userId&&row.requester_id===other)) : row.requester_id===userId||row.addressee_id===userId)
    }return this
  }
  ilike(key:string,value:string){this.checks.push(row=>String(row[key]??"").toLowerCase().includes(value.replaceAll("%","").toLowerCase()));return this}
  overlaps(key:string,values:unknown[]){this.checks.push(row=>values.some(value=>(row[key] as unknown[])?.includes(value)));return this}
  order(){return this} not(){return this}
  range(start:number,end:number){this.start=start;this.end=end;return this}
  single(){this.singleRow=true;return this} maybeSingle(){this.singleRow=true;return this}
  update(payload:RecordRow){this.operation="update";this.payload=payload;return this}
  upsert(payload:RecordRow){this.operation="upsert";this.payload=payload;return this}
  delete(){this.operation="delete";return this}
  async execute(){
    const data=state()
    if(this.table==="profiles"&&this.start>0&&data.loadMoreFailure){data.loadMoreFailure=false;return {data:null,count:null,error:{message:"Simulated read failure"}}}
    if(this.operation!=="read"&&this.table==="member_onboarding_progress")return {data:null,error:null}
    if(this.operation!=="read"){
      await new Promise(resolve=>setTimeout(resolve,180))
      if(data.failNext){data.failNext=false;return {data:null,error:{message:"Simulated connection failure. Please try again."}}}
    }
    if(this.table==="member_contacts"&&data.contactFailure)return {data:null,error:{message:"Contact service unavailable"}}
    let rows:RecordRow[]=[]
    if(this.table==="connections")rows=data.connections as unknown as RecordRow[]
    else if(this.table==="profiles")rows=[{id:userId,first_name:"Justin",last_name:"Cornetta",role:"admin",school:"Historical University"},...members.map(m=>({...m,is_discoverable:true}))]
    else if(this.table==="member_education")rows=members.flatMap(m=>(m.education??[]).map(e=>({...e,user_id:m.id})))
    else if(this.table==="member_contacts")rows=members.flatMap(m=>contact(m.id)?[{user_id:m.id,...contact(m.id)}]:[])
    else if(this.table==="member_onboarding_progress")rows=[{user_id:userId,product_tour_completed_at:"2026-11-01T00:00:00Z"}]
    else throw new Error(`Fixture does not support ${this.table}; no network fallback`)
    let found=rows.filter(row=>this.checks.every(check=>check(row)))
    if(this.operation==="upsert"){
      const existing=data.connections.find(r=>r.requester_id===this.payload.requester_id&&r.addressee_id===this.payload.addressee_id)
      const row={id:existing?.id??`connection-${data.writes}`,...this.payload}
      if(existing)Object.assign(existing,row);else data.connections.push(row as never)
      found=[row];data.writes++
    }else if(this.operation==="update") {found.forEach(row=>Object.assign(row,this.payload));data.writes++}
    else if(this.operation==="delete") {data.connections=data.connections.filter(row=>!found.includes(row as unknown as RecordRow));data.writes++}
    const count=found.length
    const selected=found.slice(this.start,this.end===Infinity?undefined:this.end+1)
    return {data:structuredClone(this.singleRow?selected[0]??null:selected),count,error:null}
  }
  then(resolve: (value: unknown)=>unknown,reject?: (error:unknown)=>unknown){return this.execute().then(resolve,reject)}
}
export async function createClient(){return {auth:{getUser:async()=>({data:{user:{id:userId,email:"preview@example.test"}}})},from:(table:string)=>new Query(table)}}
export const createAdminClient=createClient
