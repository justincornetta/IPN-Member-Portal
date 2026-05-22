import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ResourceRecord, ResourceType } from "@/lib/resources/types"

const SECTION_COPY: Record<
  ResourceType,
  { eyebrow: string; title: string; description: string }
> = {
  affiliate_benefit: {
    eyebrow: "Member benefit",
    title: "Featured member benefit",
    description:
      "Approved partner offers and training opportunities for IPN members.",
  },
  content: {
    eyebrow: "Library",
    title: "IPN content library",
    description:
      "Recordings, writing, and public resources from IPN programs in one place.",
  },
  partner: {
    eyebrow: "Partners",
    title: "Partners and sponsors",
    description:
      "Organizations that support IPN's work and help expand access to psychedelic education, research, and community.",
  },
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

function ResourceLogo({ resource }: { resource: ResourceRecord }) {
  if (resource.image_url) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border border-zinc-200 bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resource.image_url}
          alt={resource.image_alt ?? ""}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    )
  }

  const initial = resource.title.charAt(0).toUpperCase()

  return (
    <div className="flex h-20 items-center justify-center rounded-lg bg-ipn-light text-xl font-semibold text-ipn">
      {initial}
    </div>
  )
}

function ResourceCard({
  resource,
  variant = "default",
}: {
  resource: ResourceRecord
  variant?: "default" | "featured"
}) {
  const featured = variant === "featured"

  return (
    <article
      className={`flex h-full flex-col rounded-lg border bg-white p-4 shadow-sm ${
        featured ? "border-ipn/20 ring-1 ring-ipn/10" : "border-zinc-200"
      }`}
    >
      <ResourceLogo resource={resource} />

      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              featured ? "bg-ipn-light text-ipn" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {resource.category}
          </span>
          {resource.featured && (
            <span className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white">
              Featured
            </span>
          )}
        </div>

        <h3 className="mt-3 text-base font-semibold leading-snug text-zinc-900">
          {resource.title}
        </h3>

        {resource.description && (
          <p className="mt-2 text-sm leading-6 text-zinc-500">
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
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            Open resource
            <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </article>
  )
}

function ResourceSection({
  type,
  resources,
}: {
  type: ResourceType
  resources: ResourceRecord[]
}) {
  if (!resources.length) return null

  const copy = SECTION_COPY[type]

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-ipn">{copy.eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {copy.description}
        </p>
      </div>

      <div
        className={`grid gap-4 ${
          type === "affiliate_benefit"
            ? "grid-cols-1"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {resources.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            variant={type === "affiliate_benefit" ? "featured" : "default"}
          />
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
          <ResourceSection
            type="affiliate_benefit"
            resources={groupResources(resources, "affiliate_benefit")}
          />
          <ResourceSection
            type="content"
            resources={groupResources(resources, "content")}
          />
          <ResourceSection
            type="partner"
            resources={groupResources(resources, "partner")}
          />
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
