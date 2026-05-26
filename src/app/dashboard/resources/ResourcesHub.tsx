"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ResourceRecord, ResourceType } from "@/lib/resources/types"

const BLOG_IDEA_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdp2VmQ9wWNFQLfeOTnK4WTBbWBHq2rmBhoDaGRehfrenedgQ/viewform"

type ResourceTab = {
  id: ResourceType
  label: string
  countLabel: string
}

type Props = {
  resources: ResourceRecord[]
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

function SearchIcon() {
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
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
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

function resourcesByType(resources: ResourceRecord[], type: ResourceType) {
  return resources.filter((resource) => resource.resource_type === type)
}

function ResourceMedia({ resource }: { resource: ResourceRecord }) {
  const image = resourceImage(resource)
  const isBenefit = resource.resource_type === "affiliate_benefit"
  const isPartner = resource.resource_type === "partner"
  const wrapperClass = isBenefit
    ? "aspect-[4/3] overflow-hidden rounded-lg border border-zinc-200 bg-white"
    : isPartner
      ? "flex h-24 items-center justify-center rounded-lg border border-zinc-200 bg-white p-4"
      : "aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100"

  if (!image) {
    return (
      <div
        className={`${wrapperClass} flex items-center justify-center bg-ipn-light text-xl font-semibold text-ipn`}
      >
        {resource.title.charAt(0).toUpperCase()}
      </div>
    )
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
  const isBlog = resource.resource_type === "blog_post"
  const isBenefit = resource.resource_type === "affiliate_benefit"

  const body = (
    <article
      className={`flex h-full flex-col rounded-lg border bg-white p-4 shadow-sm transition ${
        isBlog
          ? "border-zinc-200 hover:-translate-y-0.5 hover:border-ipn/30 hover:shadow-md"
          : isBenefit
            ? "border-ipn/20 ring-1 ring-ipn/10"
            : "border-zinc-200"
      }`}
    >
      <ResourceMedia resource={resource} />

      <div className="mt-4 flex flex-1 flex-col">
        <span
          className={`w-fit rounded-md px-2 py-1 text-[11px] font-medium ${
            isBenefit ? "bg-ipn-light text-ipn" : "bg-zinc-100 text-zinc-500"
          }`}
        >
          {resource.category}
        </span>

        <h3 className="mt-3 text-base font-semibold leading-snug text-zinc-900">
          {resource.title}
        </h3>

        <ResourceMeta resource={resource} />

        {resource.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-500">
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
          {isBlog ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ipn">
              Read article
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

  if (isBlog) {
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
      <p className="text-sm font-medium text-ipn">Have an article idea?</p>
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

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">{body}</p>
    </div>
  )
}

export default function ResourcesHub({ resources }: Props) {
  const [activeTab, setActiveTab] = useState<ResourceType>("affiliate_benefit")
  const [blogQuery, setBlogQuery] = useState("")

  const benefits = resourcesByType(resources, "affiliate_benefit")
  const blogs = resourcesByType(resources, "blog_post")
  const partners = resourcesByType(resources, "partner")

  const tabs: ResourceTab[] = [
    {
      id: "affiliate_benefit",
      label: "Member Benefits",
      countLabel: `${benefits.length} ${benefits.length === 1 ? "benefit" : "benefits"}`,
    },
    {
      id: "blog_post",
      label: "IPN Blog",
      countLabel: `${blogs.length} articles`,
    },
    {
      id: "partner",
      label: "Partners",
      countLabel: `${partners.length} organizations`,
    },
  ]

  const filteredBlogs = useMemo(() => {
    const query = blogQuery.trim().toLowerCase()
    if (!query) return blogs

    return blogs.filter((blog) => blog.title.toLowerCase().includes(query))
  }, [blogQuery, blogs])

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-ipn/20 bg-ipn/5 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-medium text-ipn">What is included</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              Benefits, writing, and partner links in one member-only hub.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Browse approved member benefits, search IPN Blog articles, and
              learn more about partner and sponsor organizations supporting IPN.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="rounded-lg border border-white bg-white px-3 py-3 text-left shadow-sm transition hover:border-ipn/20"
              >
                <span className="block text-sm font-semibold text-zinc-900">
                  {tab.label}
                </span>
                <span className="mt-1 block text-xs text-zinc-400">
                  {tab.countLabel}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-ipn text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "affiliate_benefit" && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ipn">Member benefits</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              Approved member benefits
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Partner offers and training opportunities available to IPN
              members.
            </p>
          </div>
          {benefits.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <EmptyTab
              title="No member benefits published yet"
              body="Approved benefits will appear here once the leadership team adds them in Supabase."
            />
          )}
        </section>
      )}

      {activeTab === "blog_post" && (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-end">
            <div>
              <p className="text-sm font-medium text-ipn">Writing</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-900">
                IPN Blog
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Essays, interviews, and program writing from the IPN community.
              </p>
            </div>
            <label className="relative block">
              <span className="sr-only">Search blog posts by title</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <SearchIcon />
              </span>
              <input
                value={blogQuery}
                onChange={(event) => setBlogQuery(event.target.value)}
                placeholder="Search blog titles"
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn/40 focus:ring-2 focus:ring-ipn/10"
              />
            </label>
          </div>

          {blogs.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <BlogIdeaCard />
              {filteredBlogs.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <EmptyTab
              title="No blog posts published yet"
              body="Published IPN Blog articles will appear here once they are added in Supabase."
            />
          )}

          {blogs.length > 0 && filteredBlogs.length === 0 && (
            <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
              No blog posts match that title search.
            </p>
          )}
        </section>
      )}

      {activeTab === "partner" && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-ipn">Partners</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900">
              Partners and sponsors
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              Organizations that support IPN&apos;s work and help expand access
              to psychedelic education, research, and community.
            </p>
          </div>
          {partners.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <EmptyTab
              title="No partners published yet"
              body="Partner and sponsor links will appear here once they are added in Supabase."
            />
          )}
        </section>
      )}
    </div>
  )
}
