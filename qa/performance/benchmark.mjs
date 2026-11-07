import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import ts from "typescript"
import { makeClient, sampleData, previewUser } from "./fixtures/data.ts"
import { loadDirectory } from "../../src/lib/directory/load.ts"
import { loadEventsHub } from "../../src/lib/events/load-hub.ts"
import * as queries from "../../src/lib/directory/queries.ts"
import * as search from "../../src/lib/directory/search.ts"
import * as location from "../../src/lib/directory/location.ts"
import * as education from "../../src/lib/members/education.ts"
import * as tickets from "../../src/lib/events/tickets.ts"
const require=createRequire(import.meta.url)
const base="209730a2401b34abbd2339cf5bc4cfd065fbdcd2"
function baseline(path,client) {
  const source=execFileSync("git",["show",`${base}:${path}`],{encoding:"utf8"})
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
  const dependencies={"@/lib/supabase/server":{createClient:async()=>client},"next/navigation":{redirect:()=>{throw new Error("Unexpected auth redirect")}},
    "@/lib/directory/queries":queries,"@/lib/directory/search":search,"@/lib/directory/location":location,"@/lib/members/education":education,"@/lib/events/tickets":tickets}
  const compiled={exports:{}}
  new Function("require","module","exports",js)((name)=>dependencies[name]??(["next/link","./DirectoryClient","./EventsHub"].includes(name)?()=>null:require(name)),compiled,compiled.exports)
  return compiled.exports.default
}
const data=sampleData(125), latencyMs=150
const runs=[]
for(let i=0;i<3;i++) for(const route of ["Community","Events"]) for(const mode of ["before","after"]){
  const records=[],client=makeClient(data,{latencyMs,records})
  const run=mode==="before"?baseline(`src/app/dashboard/${route==="Community"?"directory/":"events/"}page.tsx`,client):null
  const start=performance.now()
  if(run) await run({searchParams:Promise.resolve({})})
  else if(route==="Community") await loadDirectory(client,previewUser.id,{})
  else await loadEventsHub(client,previewUser,false)
  runs.push({route,mode,durationMs:Math.round(performance.now()-start),queries:records.length})
}
console.log(JSON.stringify({baselineCommit:base,conditions:{members:125,latencyPerQueryMs:latencyMs,authLatencyMs:0,note:"Controlled synthetic server-data benchmark; excludes network, hosting cold starts, browser rendering and real database cost. Baseline page code uses current enrichment helpers, with identical query counts for these 60-member list fixtures."},runs},null,2))
