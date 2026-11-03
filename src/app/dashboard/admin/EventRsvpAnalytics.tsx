"use client"

import { useState } from 'react'
import { RSVP_STAGES, summarizeRsvpJourneys, type RsvpJourney, type RsvpStage } from '@/lib/portal-analytics/event-rsvp'

const labels: Record<RsvpStage, string> = {
  view: 'Visits', open: 'Form opens', submit: 'Submissions', confirmed: 'Confirmations',
  error: 'Errors', calendar: 'Calendar clicks', join: 'Join clicks', signup: 'Signup clicks',
}
const paths = { visitor: 'Visitor', guest: 'Guest', member_login: 'Member sign-in', member: 'Signed-in member' }
type Member = { userId: string; fullName: string; email: string }
type Summary = ReturnType<typeof summarizeRsvpJourneys>
const cell = 'border-b border-zinc-200 p-3 text-left text-sm'
const field = 'mt-1 block min-h-11 rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-900'

function MetricCells({ summary }: { summary: Summary }) {
  return <>
    {RSVP_STAGES.map(stage => <td key={stage} className={`${cell} tabular-nums`}>{summary.counts[stage]}</td>)}
    <td className={cell}>{summary.success === null ? '—' : `${summary.success}%`}</td>
    <td className={cell}>{summary.accounts}</td>
  </>
}
function MetricHeaders({ first }: { first: string }) {
  return <tr>{[first, ...RSVP_STAGES.map(stage => labels[stage]), 'Submission success', 'Account creations'].map(label =>
    <th scope="col" key={label} className={`${cell} whitespace-nowrap font-medium text-zinc-600`}>{label}</th>)}</tr>
}

function EventDetail({ title, rows, members }: { title: string; rows: RsvpJourney[]; members: Member[] }) {
  const [query, setQuery] = useState('')
  const summary = summarizeRsvpJourneys(rows)
  const profiles = new Map(members.map(member => [member.userId, member]))
  const memberRows = summary.members.map(activity => ({
    ...activity, profile: profiles.get(activity.userId),
  })).sort((a, b) => b.lastAt.localeCompare(a.lastAt) || a.userId.localeCompare(b.userId))
  const filtered = memberRows.filter(member =>
    `${member.profile?.fullName ?? ''} ${member.profile?.email ?? ''} ${member.userId}`.toLowerCase().includes(query.trim().toLowerCase()))
  const identifiedSessions = new Set(summary.members.flatMap(member => [...member.sessions]))
  return <section id="event-rsvp-detail" aria-label={`Member activity for ${title}`} className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
    <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-zinc-600">
      {summary.members.length} identified members across {summary.sessions} observed sessions.
      {' '}{summary.sessions - identifiedSessions.size} sessions have no activity linked to a member.
      Guest and logged-out actions stay in the event totals; they are not assigned to a member by email or shared browser session.
    </p>
    <details className="my-4 rounded-lg border border-zinc-200 bg-white p-3">
      <summary className="cursor-pointer py-2 text-sm font-medium text-ipn">View RSVP path breakdown</summary>
      <p className="my-2 text-xs leading-5 text-zinc-600">A session can use several paths. Path rows may overlap; the event total deduplicates across them. Scroll horizontally for all metrics.</p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="RSVP path results">
        <table className="w-full"><thead><MetricHeaders first="RSVP path"/></thead><tbody>
          {(Object.keys(paths) as RsvpJourney['path'][]).filter(path => rows.some(row => row.path === path)).map(path =>
            <tr key={path}><th scope="row" className={`${cell} whitespace-nowrap font-medium`}>{paths[path]}</th>
              <MetricCells summary={summarizeRsvpJourneys(rows.filter(row => row.path === path))}/></tr>)}
        </tbody></table>
      </div>
    </details>
    <h4 className="font-semibold text-zinc-900">Member activity</h4>
    <p className="mt-1 text-sm leading-6 text-zinc-600">Actions are linked using server-recorded account IDs, including newly created accounts. Earlier guest actions are not attributed. Each action counts once per member and session. This is observed activity, not the current RSVP roster. Times are UTC.</p>
    <label className="my-3 block text-sm text-zinc-700">Find a member
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} className={`${field} w-full sm:max-w-sm`} placeholder="Search name or email"/>
    </label>
    <p className="mb-2 text-xs text-zinc-500">{filtered.length} of {memberRows.length} members · Scroll horizontally for more details.</p>
    {filtered.length ? <div className="overflow-x-auto rounded bg-white" tabIndex={0} role="region" aria-label="Event member results">
      <table className="w-full"><thead><tr>{['Member', 'Sessions', 'RSVP paths', 'Observed actions', 'Account created', 'Last activity (UTC)'].map(label =>
        <th scope="col" className={`${cell} whitespace-nowrap font-medium text-zinc-600`} key={label}>{label}</th>)}</tr></thead>
        <tbody>{filtered.map(member => <tr key={member.userId}>
          <th scope="row" className={`${cell} min-w-60 font-normal`}>
            <span className="block font-medium text-zinc-900">{member.profile?.fullName || 'Member profile unavailable'}</span>
            <span className="block break-all text-zinc-500">{member.profile?.email || member.userId}</span>
          </th>
          <td className={cell}>{member.sessions.size}</td>
          <td className={`${cell} min-w-40`}>{[...member.paths].map(path => paths[path]).join(', ')}</td>
          <td className={`${cell} min-w-64`}>{RSVP_STAGES.filter(stage => member.stages.has(stage)).map(stage =>
            <span className="mr-3 inline-block" key={stage}>{labels[stage]}: {member.stages.get(stage)!.size}</span>)}
            {member.stages.size === 0 && 'No authenticated RSVP actions recorded'}</td>
          <td className={cell}>{member.accountCreated ? 'Yes' : '—'}</td>
          <td className={`${cell} whitespace-nowrap`}>{member.lastAt ? new Date(member.lastAt).toISOString().slice(0, 16).replace('T', ' ') : '—'}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="rounded bg-white p-4 text-sm text-zinc-600">{memberRows.length ? 'No members match this search.' : 'No identified member activity recorded for this event in the selected dates. Guest activity remains in the totals above.'}</p>}
  </section>
}

export default function EventRsvpAnalytics({ journeys, members = [], eventTitles = {} }: {
  journeys: RsvpJourney[]; members?: Member[]; eventTitles?: Record<string, string>
}) {
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const groups = new Map<string, RsvpJourney[]>()
  for (const row of journeys) {
    if ((from && row.date < from) || (to && row.date > to)) continue
    const rows = groups.get(row.eventSlug) ?? []
    rows.push(row)
    groups.set(row.eventSlug, rows)
  }
  const titleFor = (slug: string) => eventTitles[slug] || slug.replaceAll('-', ' ')
  return <section className="rounded-xl border border-zinc-200 bg-white p-5" aria-labelledby="event-rsvp-analytics-title">
    <h2 id="event-rsvp-analytics-title" className="text-lg font-semibold text-zinc-900">Event RSVP journey</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-600">One row per event. Each stage counts a browser session once across all RSVP paths. Open an event to see its path breakdown and identified member activity. These observations are not unique attendees or the official RSVP total.</p>
    <div className="my-4 flex flex-wrap gap-4">
      <label className="text-sm text-zinc-700">Journey start from<input aria-label="RSVP journey from" className={field} type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label className="text-sm text-zinc-700">Through<input aria-label="RSVP journey through" className={field} type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
    </div>
    {groups.size > 0 && <p className="mb-2 text-xs text-zinc-500">Scroll horizontally for more metrics.</p>}
    {groups.size ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="RSVP journey results">
      <table className="w-full"><thead><MetricHeaders first="Event"/></thead><tbody>
        {[...groups.entries()].sort(([a], [b]) => titleFor(a).localeCompare(titleFor(b))).map(([slug, rows]) => {
          const summary = summarizeRsvpJourneys(rows)
          return <tr key={slug}><th scope="row" className={`${cell} min-w-64 max-w-sm font-normal`}>
            <span className="block text-zinc-900">{titleFor(slug)}</span>
            <button type="button" aria-expanded={selected === slug} aria-controls="event-rsvp-detail"
              className="mt-1 min-h-11 text-left font-medium text-ipn underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
              onClick={() => setSelected(selected === slug ? null : slug)}>
              {selected === slug ? 'Hide details' : 'View members & paths'} ({summary.members.length} members)
            </button>
          </th><MetricCells summary={summary}/></tr>
        })}
      </tbody></table>
    </div> : <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">No RSVP journey activity recorded for these dates. Tracking starts when this update is deployed; earlier RSVPs are not backfilled.</p>}
    {selected && groups.has(selected) && <EventDetail key={selected} title={titleFor(selected)} rows={groups.get(selected)!} members={members}/>}
    <p className="mt-3 text-xs leading-5 text-zinc-500">This section uses its own date filters and the portal’s retained analytics window. Dates filter the first retained session observation per event (UTC). Submission success is sessions recording both submission and confirmation ÷ sessions submitting. Repeat confirmations can include existing RSVPs. Account creations require registration success after the latest signup click in the same session; email verification and later sessions are not attributed. Join clicks do not establish attendance. Blocked analytics may undercount activity.</p>
  </section>
}
