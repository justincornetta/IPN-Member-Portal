import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

const EVENTS = [
  {
    id: 1,
    title: "Intro to Psychedelic Therapy Research",
    date: "May 20, 2026",
    type: "Webinar",
    location: "Online",
  },
  {
    id: 2,
    title: "Advanced Research Methods Workshop",
    date: "Jun 3, 2026",
    type: "Workshop",
    location: "Denver, CO",
  },
  {
    id: 3,
    title: "PsychedelX 2026",
    date: "Jun 28, 2026",
    type: "Conference",
    location: "In Person",
  },
]

const RESOURCES = [
  { id: 1, title: "Intro to Psychedelic Therapy", type: "video", source: "PsychedelX" },
  { id: 2, title: "Research Methods in Psychedelic Science", type: "video", source: "IPN Webinar" },
  { id: 3, title: "Psilocybin & Mental Health: A Review", type: "article", source: "IPN Blog" },
]

const TYPE_ICON: Record<string, React.ReactNode> = {
  video: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  article: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
    </svg>
  ),
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-2xl font-semibold text-zinc-900">{value}</p>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <p className="text-xs text-zinc-400">{sub}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, persona, affiliation")
    .eq("id", user!.id)
    .single()

  const firstName = profile?.first_name ?? user!.email?.split("@")[0] ?? "there"
  const subtitle = [profile?.persona, profile?.affiliation].filter(Boolean).join(" · ")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  return (
    <div className="flex flex-col gap-6 p-4 sm:gap-8 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {greeting}, {firstName}
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
        </div>
        <button className="relative rounded-lg border border-zinc-200 bg-white p-2 text-zinc-400 hover:text-zinc-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming Events" value="3" sub="Next: May 20" />
        <StatCard label="Members" value="1,200+" sub="Across 80+ schools" />
        <StatCard label="New Resources" value="12" sub="Added this month" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Events — spans 2 cols on large screens */}
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Upcoming Events</h2>
            <Link
              href="/dashboard/events"
              className="text-xs font-medium text-ipn hover:underline"
            >
              All events →
            </Link>
          </div>

          <div className="flex flex-col divide-y divide-zinc-100">
            {EVENTS.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-zinc-800">{e.title}</p>
                  <p className="text-xs text-zinc-400">
                    {e.date} · {e.type} · {e.location}
                  </p>
                </div>
                <button className="ml-4 flex-shrink-0 rounded-lg bg-ipn-light px-3 py-1.5 text-xs font-medium text-ipn hover:bg-ipn hover:text-white transition">
                  RSVP
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Resources */}
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">Resources</h2>
              <Link
                href="/dashboard/resources"
                className="text-xs font-medium text-ipn hover:underline"
              >
                Browse →
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              {RESOURCES.map((r) => (
                <div key={r.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 text-zinc-400">{TYPE_ICON[r.type]}</span>
                  <div>
                    <p className="text-sm text-zinc-800 leading-snug">{r.title}</p>
                    <p className="text-xs text-zinc-400">{r.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Directory */}
          <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-800">Member Directory</h2>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-400">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Search members…
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-zinc-400">Filter by</p>
              <div className="flex flex-wrap gap-2">
                {["Field", "School", "Location"].map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/dashboard/directory"
              className="text-center rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition"
            >
              Browse all members →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
