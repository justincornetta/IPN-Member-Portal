import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import EventCard from "@/components/events/EventCard"
import type {
  EventRecord,
  EventSpeakerLink,
  EventSpeakerLinkType,
  EventSpeakerPaper,
  EventSpeakerResource,
  EventSpeakerResources,
  EventWithRegistration,
} from "@/lib/events/types"

type Props = {
  params: Promise<{ slug: string }>
}

type NormalizedSpeakerResources = {
  papers: EventSpeakerPaper[]
  resources: EventSpeakerResource[]
  speakerLinks: EventSpeakerLink[]
}

const SPEAKER_LINK_TYPES = new Set<EventSpeakerLinkType>([
  "website",
  "email",
  "profile",
  "social",
  "other",
])

const SPEAKER_LINK_PLACEHOLDERS: EventSpeakerLink[] = [
  { label: "Speaker website coming soon", type: "website" },
  { label: "Contact information coming soon", type: "email" },
  { label: "Research profile coming soon", type: "profile" },
]

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeSpeakerResources(
  value: EventSpeakerResources | unknown,
): NormalizedSpeakerResources {
  const payload = asRecord(value)
  if (!payload) return { papers: [], resources: [], speakerLinks: [] }

  const papers = Array.isArray(payload.papers)
    ? payload.papers.flatMap((item) => {
        const record = asRecord(item)
        const title = cleanString(record?.title)
        if (!record || !title) return []

        return {
          title,
          url: cleanString(record.url),
          citation: cleanString(record.citation),
          note: cleanString(record.note),
        }
      })
    : []

  const resources = Array.isArray(payload.resources)
    ? payload.resources.flatMap((item) => {
        const record = asRecord(item)
        const title = cleanString(record?.title)
        if (!record || !title) return []

        return {
          title,
          url: cleanString(record.url),
          source: cleanString(record.source),
          note: cleanString(record.note),
        }
      })
    : []

  const rawSpeakerLinks = payload.speakerLinks ?? payload.speaker_links
  const speakerLinks = Array.isArray(rawSpeakerLinks)
    ? rawSpeakerLinks.flatMap((item) => {
        const record = asRecord(item)
        const label = cleanString(record?.label)
        if (!record || !label) return []

        const type = cleanString(record.type)

        return {
          label,
          url: cleanString(record.url),
          type:
            type && SPEAKER_LINK_TYPES.has(type as EventSpeakerLinkType)
              ? (type as EventSpeakerLinkType)
              : "other",
        }
      })
    : []

  return { papers, resources, speakerLinks }
}

function isIpnLabEvent(event: EventRecord) {
  const eventType = event.event_type.trim().toLowerCase()
  return eventType === "ipn lab" || eventType === "ipn labs"
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6.75 6.75h3m-3 0A2.25 2.25 0 0 0 4.5 9v8.25a2.25 2.25 0 0 0 2.25 2.25H15a2.25 2.25 0 0 0 2.25-2.25v-3"
      />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-5.5a2 2 0 0 0-.59-1.41l-3.25-3.25a2 2 0 0 0-1.41-.59H6.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4.25ZM14.5 3.75v3.5a1.5 1.5 0 0 0 1.5 1.5h3.25M8 13h8M8 16h5"
      />
    </svg>
  )
}

function ResourceIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.75v11.5m0-11.5A5.25 5.25 0 0 0 6.75 4.5H4.5v12h2.25A5.25 5.25 0 0 1 12 18.25m0-11.5a5.25 5.25 0 0 1 5.25-2.25h2.25v12h-2.25A5.25 5.25 0 0 0 12 18.25"
      />
    </svg>
  )
}

function SpeakerLinkIcon({ type }: { type: EventSpeakerLinkType | null | undefined }) {
  const label = type === "email" ? "@" : type === "profile" ? "ID" : "Go"

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ipn-light text-xs font-semibold text-ipn">
      {label}
    </span>
  )
}

function ResourceRow({
  title,
  label,
  url,
  detail,
  note,
  kind,
}: {
  title: string
  label: string
  url?: string | null
  detail?: string | null
  note?: string | null
  kind: "paper" | "resource"
}) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ipn-light text-ipn">
        {kind === "paper" ? <DocumentIcon /> : <ResourceIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </span>
        <span className="mt-0.5 block text-sm font-medium leading-5 text-zinc-900">
          {title}
        </span>
        {detail && (
          <span className="mt-1 block text-xs leading-5 text-zinc-500">
            {detail}
          </span>
        )}
        {note && (
          <span className="mt-1 block text-xs leading-5 text-zinc-500">
            {note}
          </span>
        )}
      </span>
      {url ? (
        <span className="shrink-0 text-zinc-400 transition group-hover:text-ipn">
          <ExternalLinkIcon />
        </span>
      ) : (
        <span className="shrink-0 rounded-md border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-400">
          Coming soon
        </span>
      )}
    </>
  )

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 transition hover:border-ipn/30 hover:bg-ipn/5"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-3">
      {content}
    </div>
  )
}

function SpeakerLinksPanel({ links }: { links: EventSpeakerLink[] }) {
  const visibleLinks = links.length ? links : SPEAKER_LINK_PLACEHOLDERS

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Speaker Links
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        {visibleLinks.map((link) => {
          const row = (
            <>
              <SpeakerLinkIcon type={link.type} />
              <span className="min-w-0 flex-1 text-sm font-medium text-zinc-700">
                {link.label}
              </span>
              {link.url ? (
                <span className="text-zinc-400 transition group-hover:text-ipn">
                  <ExternalLinkIcon />
                </span>
              ) : (
                <span className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-400">
                  Soon
                </span>
              )}
            </>
          )

          if (link.url) {
            const isEmail = link.url.startsWith("mailto:")

            return (
              <a
                key={`${link.type}-${link.label}`}
                href={link.url}
                target={isEmail ? undefined : "_blank"}
                rel={isEmail ? undefined : "noreferrer"}
                className="group flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-3 transition hover:border-ipn/30 hover:bg-ipn/5"
              >
                {row}
              </a>
            )
          }

          return (
            <div
              key={`${link.type}-${link.label}`}
              className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-3"
            >
              {row}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpeakerResourcesSection({
  resources,
}: {
  resources: NormalizedSpeakerResources
}) {
  const hasResourceRows = resources.papers.length > 0 || resources.resources.length > 0

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              IPN Lab materials
            </p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-900">
              Relevant Papers and Event Resources
            </h2>
          </div>
          <span className="w-fit rounded-md bg-ipn-light px-2.5 py-1.5 text-xs font-medium text-ipn">
            Event chat prep
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {hasResourceRows ? (
            <>
              {resources.papers.map((paper) => (
                <ResourceRow
                  key={`paper-${paper.title}`}
                  title={paper.title}
                  label="Relevant paper"
                  url={paper.url}
                  detail={paper.citation}
                  note={paper.note}
                  kind="paper"
                />
              ))}
              {resources.resources.map((resource) => (
                <ResourceRow
                  key={`resource-${resource.title}`}
                  title={resource.title}
                  label="Event resource"
                  url={resource.url}
                  detail={resource.source}
                  note={resource.note}
                  kind="resource"
                />
              ))}
            </>
          ) : (
            <>
              <ResourceRow
                title="Paper title coming soon"
                label="Relevant paper"
                kind="paper"
              />
              <ResourceRow
                title="Event resource coming soon"
                label="Event resource"
                kind="resource"
              />
            </>
          )}
        </div>
      </div>

      <SpeakerLinksPanel links={resources.speakerLinks} />
    </section>
  )
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (!event) notFound()

  const eventRecord = event as EventRecord
  const { data: registration } = await supabase
    .from("event_registrations")
    .select("event_id")
    .eq("event_id", eventRecord.id)
    .eq("user_id", user.id)
    .maybeSingle()

  const eventWithRegistration: EventWithRegistration = {
    ...eventRecord,
    is_registered: Boolean(registration),
  }
  const speakerResources = normalizeSpeakerResources(eventRecord.speaker_resources)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/dashboard/events"
        className="text-sm font-medium text-ipn hover:underline"
      >
        Back to events
      </Link>

      <EventCard event={eventWithRegistration} />

      {(eventRecord.description || eventRecord.location_details) && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          {eventRecord.description && (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                About this event
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-600">
                {eventRecord.description.split("\n").map((paragraph, index) => (
                  <p key={`${index}-${paragraph}`}>{paragraph}</p>
                ))}
              </div>
            </>
          )}

          {eventRecord.location_details && (
            <div className={eventRecord.description ? "mt-6" : ""}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Location
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {eventRecord.location_details}
              </p>
            </div>
          )}
        </section>
      )}

      {isIpnLabEvent(eventRecord) && (
        <SpeakerResourcesSection resources={speakerResources} />
      )}
    </div>
  )
}
