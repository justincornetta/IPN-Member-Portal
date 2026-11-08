import DirectoryClient from "@/app/dashboard/directory/DirectoryClient"
import { connectionMap, visibleMembers, userId } from "@/lib/directory-fixtures/state"
import { summarizeDirectory } from "@/lib/directory/summary"
import { memberMatchesDirectorySearch } from "@/lib/directory/search"
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const p=await searchParams
  const array=(key:string)=>Array.isArray(p[key])?p[key] as string[]:p[key]?[String(p[key])]:[]
  const params={q:String(p.q??""),tab:String(p.tab??"all"),school:String(p.school??""),field:String(p.field??""),personas:array("persona"),tags:array("tag")}
  const all=visibleMembers().filter(m=>memberMatchesDirectorySearch(m,params.q)&&(!params.personas.length||params.personas.includes(m.persona??""))&&(!params.school||m.affiliation?.includes(params.school))&&(!params.tags.length||params.tags.some(t=>m.interest_tags?.includes(t))))
  const map=connectionMap()
  return <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-10"><DirectoryClient members={all.slice(0,params.q?all.length:60)} hasMore={!params.q&&all.length>60} directorySummary={summarizeDirectory(all)} totalMemberCount={all.length} mapCities={[]} showSchoolTab currentParams={params} schools={["Community Research Lab","Historical University"]} availableTags={["Advocacy","Neuroscience"]} connectionMap={map} currentUserId={userId} pendingRequestCount={0}/></div>
}
