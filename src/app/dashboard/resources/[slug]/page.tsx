import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ResourceRecord } from "@/lib/resources/types"

type Props = {
  params: Promise<{ slug: string }>
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

function formatResourceDate(value: string | null) {
  if (!value) return null

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

function resourceImage(resource: ResourceRecord) {
  return resource.thumbnail_url ?? resource.image_url
}

function metadata(resource: ResourceRecord) {
  return [
    formatResourceDate(resource.published_at),
    resource.author,
    resource.source_name,
  ].filter(Boolean)
}

export default async function ResourceDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data } = await supabase
    .from("resources")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single()

  if (!data) notFound()

  const resource = data as ResourceRecord
  const image = resourceImage(resource)
  const resourceMetadata = metadata(resource)
  const isBenefit = resource.resource_type === "affiliate_benefit"
  const isBlog = resource.resource_type === "blog_post"
  const showRecommendation =
    resource.detail_body &&
    resource.detail_body.trim() !== resource.description?.trim()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/dashboard/resources"
        className="text-sm font-medium text-ipn hover:underline"
      >
        Back to resources
      </Link>

      <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {image && (
          isBenefit ? (
            <div className="w-full bg-zinc-50 px-4 py-5 sm:px-6 sm:py-6">
              <div className="mx-auto aspect-[4/5] max-h-[32rem] max-w-sm overflow-hidden rounded-lg border border-zinc-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={resource.image_alt ?? ""}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="aspect-video w-full bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={resource.image_alt ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
          )
        )}

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ipn-light px-2 py-1 text-xs font-medium text-ipn">
              {resource.category}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-semibold leading-tight text-zinc-900">
            {resource.title}
          </h1>

          {resourceMetadata.length > 0 && (
            <p className="mt-3 text-sm text-zinc-500">
              {resourceMetadata.join(" · ")}
            </p>
          )}

          {resource.description && (
            <div className="mt-6 space-y-4 text-sm leading-7 text-zinc-600">
              {resource.description.split("\n").map((paragraph, index) => (
                <p key={`${index}-${paragraph}`}>{paragraph}</p>
              ))}
            </div>
          )}

          {showRecommendation && (
            <section className="mt-7 rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-ipn">
                IPN Recommendation
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-700">
                {resource.detail_body!.split("\n").map((paragraph, index) => (
                  <p key={`${index}-${paragraph}`}>{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {resource.benefit_note && (
            <div className="mt-6 rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ipn">
                Benefit
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">
                {resource.benefit_note}
              </p>
            </div>
          )}

          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
          >
            {isBlog ? "Read More" : "Learn More"}
            <ExternalLinkIcon />
          </a>
        </div>
      </article>
    </div>
  )
}
