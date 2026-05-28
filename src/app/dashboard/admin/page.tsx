import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-semibold text-zinc-900">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  )
}

function BreakdownList({
  title,
  items,
  total,
}: {
  title: string
  items: [string, number][]
  total: number
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map(([label, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-zinc-600">
                <span className="truncate pr-2">{label}</span>
                <span className="flex-shrink-0 tabular-nums">{count} ({pct}%)</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-ipn"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (currentProfile?.role !== "superadmin") redirect("/dashboard")

  const admin = createAdminClient()

  const { data: profiles } = await admin
    .from("profiles")
    .select("persona, field, interest_tags, school, country, is_discoverable, created_at")
    .order("created_at", { ascending: false })

  const allProfiles = profiles ?? []
  const total = allProfiles.length
  const discoverable = allProfiles.filter((p) => p.is_discoverable).length

  // Persona breakdown
  const personaCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.persona) personaCount[p.persona] = (personaCount[p.persona] ?? 0) + 1
  }
  const personaItems = Object.entries(personaCount).sort((a, b) => b[1] - a[1])

  // Field breakdown
  const fieldCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.field) fieldCount[p.field] = (fieldCount[p.field] ?? 0) + 1
  }
  const fieldItems = Object.entries(fieldCount).sort((a, b) => b[1] - a[1])

  // Interest tag frequency
  const tagCount: Record<string, number> = {}
  for (const p of allProfiles) {
    for (const tag of p.interest_tags ?? []) {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1
    }
  }
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Top schools
  const schoolCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.school) schoolCount[p.school] = (schoolCount[p.school] ?? 0) + 1
  }
  const topSchools = Object.entries(schoolCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Top countries
  const countryCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.country) countryCount[p.country] = (countryCount[p.country] ?? 0) + 1
  }
  const topCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // Recent signups (last 10)
  const { data: recentRows } = await admin
    .from("profiles")
    .select("first_name, last_name, email, persona, created_at")
    .order("created_at", { ascending: false })
    .limit(10)

  const recent = recentRows ?? []

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">Superadmin view — member data overview</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total members" value={total} />
        <StatCard label="Discoverable" value={discoverable} />
        <StatCard label="Hidden" value={total - discoverable} />
        <StatCard label="With interest tags" value={allProfiles.filter((p) => (p.interest_tags?.length ?? 0) > 0).length} />
      </div>

      {/* Breakdown grids */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownList title="Stage breakdown" items={personaItems} total={total} />
        <BreakdownList title="Field breakdown" items={fieldItems} total={total} />
        <BreakdownList title="Top interest tags" items={topTags} total={allProfiles.filter(p => (p.interest_tags?.length ?? 0) > 0).length} />
        <BreakdownList title="Top schools" items={topSchools} total={allProfiles.filter(p => p.school).length} />
        <BreakdownList title="Top countries" items={topCountries} total={allProfiles.filter(p => p.country).length} />
      </div>

      {/* Recent signups */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-800">Recent signups</h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {recent.map((m, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  {m.first_name} {m.last_name}
                </p>
                <p className="text-xs text-zinc-400">{m.email}</p>
              </div>
              <div className="text-right">
                {m.persona && (
                  <p className="text-xs text-zinc-500">{m.persona}</p>
                )}
                <p className="text-xs text-zinc-400">
                  {new Date(m.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
