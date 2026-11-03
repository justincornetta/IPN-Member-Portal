import AnalyticsDashboardShell from '@/app/dashboard/admin/AnalyticsDashboardShell'
import { buildAnalyticsReviewFixture } from '@/lib/admin/analytics/review-fixture'
import { buildRsvpJourneys } from '@/lib/portal-analytics/event-rsvp'

const slug = 'global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional'
const observation = (session_id: string, stage: string, path: string, user_id: string | null = null, eventSlug = slug) => ({
  event_name: 'curated_click', session_id, user_id, occurred_at: '2026-11-03T10:00:00Z',
  metadata: { flow: 'event_rsvp', eventSlug, stage, path },
})
export default function Review() {
  const fixture = buildAnalyticsReviewFixture()
  fixture.portalUtilization.eventRsvpJourneys = buildRsvpJourneys([
    observation('s1','view','visitor'), observation('s1','submit','guest'), observation('s1','error','guest'), observation('s1','confirmed','member_login','m1'),
    observation('s2','view','member','m1'), observation('s2','submit','member','m1'), observation('s2','confirmed','member','m1'), observation('s2','calendar','member','m1'),
    observation('s3','submit','guest'), observation('s3','confirmed','guest'), observation('s3','signup','guest'),
    {event_name:'registration_success',session_id:'s3',user_id:'m2',occurred_at:'2026-11-03T10:02:00Z',metadata:{}},
    observation('s4','submit','guest',null,'community-roundtable'), observation('s4','confirmed','guest',null,'community-roundtable'),
    observation('s5','view','visitor',null,'excluded-event'),
  ])
  const member = fixture.portalUtilization.members[0]
  fixture.portalUtilization.members = [
    {...member,userId:'m1',fullName:'Taylor Example',email:'taylor@example.com'},
    {...member,userId:'m2',fullName:'Casey Example',email:'casey@example.com'},
  ]
  const event = fixture.portalEvents[0]
  fixture.portalEvents = [
    {...event,id:'rsvp-event-1',title:'Global Psychedelic Week: So you want to be a psychedelic professional?',slug,startsAt:'2026-11-04T00:45:00Z',eventType:'labs'},
    {...event,id:'rsvp-event-2',title:'Community roundtable',slug:'community-roundtable',startsAt:'2026-11-10T18:00:00Z',eventType:'psychedelx'},
    {...event,id:'rsvp-event-3',title:'Excluded event',slug:'excluded-event',startsAt:'2026-11-10T18:00:00Z'},
  ]
  fixture.portalUtilization.eventRsvpTitles = Object.fromEntries(fixture.portalEvents.map(event => [event.slug!,event.title]))
  fixture.analyticsSnapshot.events.zoom.events = []
  fixture.analyticsSnapshot.events.zoom.upcomingEvents = []
  const override = {event_topic:null,event_date:null,note:null,updated_at:null}
  return <main className="min-h-screen bg-zinc-50 p-4 sm:p-6">
    <AnalyticsDashboardShell {...fixture} analyticsRefresh={null} isSuperadmin={false} eventLabelOverrides={[
      {...override,event_id:'rsvp-event-2',program_label:'PsychedelX',event_type:'internal',include_in_analytics:true},
      {...override,event_id:'rsvp-event-3',program_label:'Other',event_type:'public',include_in_analytics:false},
    ]}/>
  </main>
}
