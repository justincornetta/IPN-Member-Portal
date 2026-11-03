import rows from '../../src/lib/resources/newsletter-snapshot.json'
// Only copied into a disposable local QA app. No production access.
const profile = {id:'qa-reader',first_name:'Alex',last_name:'Reader',role:'member',is_banned:false,persona:'professional',bio:'QA reader',interest_tags:[],role_and_goals:'Learn',inspiration:'Community',is_discoverable:false}
function query(table:string) {
 let single=false; let records: unknown[] = table==='resources'?rows:table==='profiles'?[profile]:table==='member_onboarding_progress'?[{product_tour_completed_at:'2026-11-01',getting_started_completed_at:'2026-11-01',getting_started_success_seen_at:'2026-11-01'}]:[]
 const q={
 select(){return q},eq(key:string,value:unknown){if(table==='resources')records=records.filter(row=>(row as Record<string,unknown>)[key]===value);return q},
 in(){return q},or(){return q},gte(){return q},neq(){return q},not(){return q},is(){return q},order(){return q},limit(n:number){records=records.slice(0,n);return q},
 single(){single=true;return q},maybeSingle(){single=true;return q},
 then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:single?records[0]??null:records,error:null,count:0}).then(resolve)}
 };return q
}
export async function createClient(){return {from:query,auth:{getUser:async()=>({data:{user:{id:'qa-reader',email:'reader@example.com'}}})}}}
export function createAdminClient(){throw new Error('Admin writes disabled in newsletter browser QA')}
