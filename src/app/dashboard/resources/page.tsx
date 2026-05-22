import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ResourceRecord, ResourceType } from "@/lib/resources/types"

const BLOG_IDEA_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdp2VmQ9wWNFQLfeOTnK4WTBbWBHq2rmBhoDaGRehfrenedgQ/viewform"

const RESOURCE_SECTIONS: {
  type: ResourceType
  eyebrow: string
  title: string
  description: string
  columns?: string
}[] = [
  {
    type: "affiliate_benefit",
    eyebrow: "Member benefit",
    title: "Featured member benefit",
    description:
      "Approved partner offers and training opportunities for IPN members.",
    columns: "grid-cols-1 sm:grid-cols-[minmax(0,26rem)]",
  },
  {
    type: "ipn_lab_recording",
    eyebrow: "Recordings",
    title: "IPN Labs Recordings",
    description:
      "Member-facing recordings from IPN Labs seminars and educational sessions.",
  },
  {
    type: "psychedelx_recording",
    eyebrow: "Recordings",
    title: "PsychedelX Recordings",
    description:
      "Archived PsychedelX talks and conference sessions from IPN members and invited speakers.",
  },
  {
    type: "blog_post",
    eyebrow: "Writing",
    title: "IPN Blog",
    description:
      "Essays, interviews, and program writing from the IPN community.",
  },
  {
    type: "partner",
    eyebrow: "Partners",
    title: "Partners and sponsors",
    description:
      "Organizations that support IPN's work and help expand access to psychedelic education, research, and community.",
  },
]

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

function ArrowIcon() {
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
        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
      />
    </svg>
  )
}

function formatResourceDate(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function resourceImage(resource: ResourceRecord) {
  return resource.thumbnail_url ?? resource.image_url
}

function FallbackImage({ title, className }: { title: string; className: string }) {
  return (
    <div
      className={`${className} flex items-center justify-center bg-ipn-light text-xl font-semibold text-ipn`}
    >
      {title.charAt(0).toUpperCase()}
    </div>
  )
}

function ResourceMedia({ resource }: { resource: ResourceRecord }) {
  const image = resourceImage(resource)
  const isBenefit = resource.resource_type === "affiliate_benefit"
  const isPartner = resource.resource_type === "partner"
  const wrapperClass = isBenefit
    ? "aspect-[4/5] overflow-hidden rounded-lg border border-zinc-200 bg-white"
    : isPartner
      ? "flex h-24 items-center justify-center rounded-lg border border-zinc-200 bg-white p-4"
      : "aspect-video overflow-hidden rounded-lg bg-zinc-100"

  if (!image) {
    return <FallbackImage title={resource.title} className={wrapperClass} />
  }

  return (
    <div className={wrapperClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={resource.image_alt ?? ""}
        className={
          isBenefit || isPartner
            ? "h-full w-full object-contain"
            : "h-full w-full object-cover"
        }
      />
    </div>
  )
}

function ResourceMeta({ resource }: { resource: ResourceRecord }) {
  const date = formatResourceDate(resource.published_at)
  const metadata = [date, resource.author, resource.source_name].filter(Boolean)

  if (!metadata.length) return null

  return (
    <p className="mt-2 line-clamp-1 text-xs text-zinc-400">
      {metadata.join(" · ")}
    </p>
  )
}

function ResourceCard({ resource }: { resource: ResourceRecord }) {
  const isDetailResource =
    resource.resource_type === "ipn_lab_recording" ||
    resource.resource_type === "psychedelx_recording" ||
    resource.resource_type === "blog_post"
  const isBenefit = resource.resource_type === "affiliate_benefit"

  const body = (
    <article
      className={`flex h-full flex-col rounded-lg border bg-white p-4 shadow-sm transition ${
        isDetailResource
          ? "border-zinc-200 hover:-translate-y-0.5 hover:border-ipn/30 hover:shadow-md"
          : isBenefit
            ? "border-ipn/20 ring-1 ring-ipn/10"
            : "border-zinc-200"
      }`}
    >
      <ResourceMedia resource={resource} />

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              isBenefit ? "bg-ipn-light text-ipn" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {resource.category}
          </span>
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug text-zinc-900">
          {resource.title}
        </h3>

        <ResourceMeta resource={resource} />

        {resource.description && (
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-zinc-500">
            {resource.description}
          </p>
        )}

        {resource.benefit_note && (
          <div className="mt-4 rounded-lg border border-ipn/20 bg-ipn/5 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ipn">
              Benefit
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-700">
              {resource.benefit_note}
            </p>
          </div>
        )}

        <div className="mt-auto pt-5">
          {isDetailResource ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ipn">
              Learn More
              <ArrowIcon />
            </span>
          ) : (
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
            >
              Learn More
              <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>
    </article>
  )

  if (isDetailResource) {
    return (
      <Link href={`/dashboard/resources/${resource.slug}`} className="block h-full">
        {body}
      </Link>
    )
  }

  return body
}

function BlogIdeaCard() {
  return (
    <article className="flex h-full flex-col rounded-lg border border-dashed border-ipn/30 bg-ipn/5 p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-ipn shadow-sm">
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.7}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3 .378a6.036 6.036 0 0 0 2.25-1.5m-5.25 1.5a6.036 6.036 0 0 1-2.25-1.5m9 0a6 6 0 1 0-10.5 0m10.5 0a5.977 5.977 0 0 1-1.5 1.5m-9-1.5a5.977 5.977 0 0 0 1.5 1.5m4.5 3.75h-3m3 0a1.5 1.5 0 0 1-3 0m3 0v1.5a1.5 1.5 0 0 1-3 0v-1.5"
          />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-ipn">Have an article idea?</p>
      <h3 className="mt-1 text-base font-semibold text-zinc-900">
        Submit a blog pitch
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600">
        Share a topic, draft, interview idea, or essay proposal with the IPN
        blog team.
      </p>
      <a
        href={BLOG_IDEA_FORM_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ipn"
      >
        Open intake form
        <ExternalLinkIcon />
      </a>
    </article>
  )
}

function ResourceSection({
  section,
  resources,
}: {
  section: (typeof RESOURCE_SECTIONS)[number]
  resources: ResourceRecord[]
}) {
  if (!resources.length) return null

  const showBlogIdeaCard = section.type === "blog_post"

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-ipn">{section.eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900">
          {section.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {section.description}
        </p>
      </div>

      <div
        className={`grid gap-4 ${
          section.columns ?? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {showBlogIdeaCard && <BlogIdeaCard />}
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </div>
    </section>
  )
}

function groupResources(resources: ResourceRecord[], type: ResourceType) {
  return resources.filter((resource) => resource.resource_type === type)
}

export default async function ResourcesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  const resources = (data ?? []) as ResourceRecord[]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-medium text-ipn">Resources</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          Member resources
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          A member-only home for IPN recordings, writing, partner organizations,
          and approved benefits.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-red-900">
            Resources could not be loaded
          </h2>
          <p className="mt-1 text-sm leading-6 text-red-700">
            Check that the resources table has been created in Supabase and try
            again.
          </p>
        </div>
      ) : resources.length > 0 ? (
        <>
          {RESOURCE_SECTIONS.map((section) => (
            <ResourceSection
              key={section.type}
              section={section}
              resources={groupResources(resources, section.type)}
            />
          ))}
        </>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">
            No resources published yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Published resources will appear here once the leadership team adds
            them in Supabase.
          </p>
        </div>
      )}
    </div>
  )
}
