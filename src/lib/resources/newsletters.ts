import type { ResourceRecord } from "./types"

export const MAILCHIMP_NEWSLETTER_ARCHIVE_URL =
  "https://us10.campaign-archive.com/home/?u=7c3bc2754f93c026395a7a78e&id=e7bcf08ab8"

const NEWSLETTER_COVERS: Record<
  string,
  Pick<ResourceRecord, "image_url" | "image_alt" | "thumbnail_url">
> = {
  "newsletter-september-2026": {
    image_url: "/newsletters/2026/september.png",
    image_alt: "IPN Members Newsletter cover for September 2026",
    thumbnail_url: "/newsletters/2026/september-square.png",
  },
  "newsletter-august-2026": {
    image_url: "/newsletters/2026/august.png",
    image_alt: "IPN Members Newsletter cover for August 2026",
    thumbnail_url: "/newsletters/2026/august-square.png",
  },
  "newsletter-july-2026": {
    image_url: "/newsletters/2026/july.png",
    image_alt: "IPN Members Newsletter cover for July 2026",
    thumbnail_url: "/newsletters/2026/july-square.png",
  },
  "newsletter-june-2026": {
    image_url: "/newsletters/2026/june.png",
    image_alt: "IPN Members Newsletter cover for June 2026",
    thumbnail_url: "/newsletters/2026/june-square.png",
  },
  "newsletter-may-2026": {
    image_url: "/newsletters/2026/may.png",
    image_alt: "IPN Members Newsletter cover for May 2026",
    thumbnail_url: "/newsletters/2026/may-square.png",
  },
}

const NEWSLETTER_SUMMARIES: Record<string, string> = {
  "newsletter-september-2026":
    "The September monthly update for IPN members, including community news, opportunities, and upcoming programs.",
  "newsletter-august-2026":
    "The August update previews portal conference tools, the next Labs roundtable, PsychedelX honorees, and events.",
  "newsletter-july-2026":
    "The July update launches the Member Portal and WhatsApp community, celebrates PsychedelX winners, and previews events.",
  "newsletter-june-2026":
    "The June update seeks feedback on community chat and shares IPN Labs, PsychedelX, conferences, and field news.",
  "newsletter-may-2026":
    "The May update highlights IPN Labs, PsychedelX opportunities, conferences, and major psychedelic policy developments.",
}

export const DEFAULT_NEWSLETTERS: ResourceRecord[] = [
  {
    id: "newsletter-september-2026",
    slug: "newsletter-september-2026",
    resource_type: "newsletter",
    title: "IPN Members Newsletter - September 2026",
    description: NEWSLETTER_SUMMARIES["newsletter-september-2026"],
    url: MAILCHIMP_NEWSLETTER_ARCHIVE_URL,
    category: "Monthly newsletter",
    ...NEWSLETTER_COVERS["newsletter-september-2026"],
    benefit_note: null,
    detail_body: null,
    author: "Intercollegiate Psychedelics Network",
    published_at: "2026-09-01T12:00:00Z",
    source_id: MAILCHIMP_NEWSLETTER_ARCHIVE_URL,
    source_name: "Mailchimp",
    featured: true,
    sort_order: 5,
    status: "published",
  },
  {
    id: "newsletter-august-2026",
    slug: "newsletter-august-2026",
    resource_type: "newsletter",
    title: "IPN Members Newsletter - August 2026",
    description: NEWSLETTER_SUMMARIES["newsletter-august-2026"],
    url: "https://eepurl.com/jccYiYwGYy",
    category: "Monthly newsletter",
    ...NEWSLETTER_COVERS["newsletter-august-2026"],
    benefit_note: null,
    detail_body: null,
    author: "Intercollegiate Psychedelics Network",
    published_at: "2026-08-01T12:00:00Z",
    source_id: "https://eepurl.com/jccYiYwGYy",
    source_name: "Mailchimp",
    featured: false,
    sort_order: 10,
    status: "published",
  },
  {
    id: "newsletter-july-2026",
    slug: "newsletter-july-2026",
    resource_type: "newsletter",
    title: "IPN Members Newsletter - July 2026",
    description: NEWSLETTER_SUMMARIES["newsletter-july-2026"],
    url: "https://eepurl.com/g9_33y7qAY",
    category: "Monthly newsletter",
    ...NEWSLETTER_COVERS["newsletter-july-2026"],
    benefit_note: null,
    detail_body: null,
    author: "Intercollegiate Psychedelics Network",
    published_at: "2026-07-03T12:00:00Z",
    source_id: "https://eepurl.com/g9_33y7qAY",
    source_name: "Mailchimp",
    featured: false,
    sort_order: 20,
    status: "published",
  },
  {
    id: "newsletter-june-2026",
    slug: "newsletter-june-2026",
    resource_type: "newsletter",
    title: "IPN Members Newsletter - June 2026",
    description: NEWSLETTER_SUMMARIES["newsletter-june-2026"],
    url: "https://eepurl.com/1SSPfBtgif",
    category: "Monthly newsletter",
    ...NEWSLETTER_COVERS["newsletter-june-2026"],
    benefit_note: null,
    detail_body: null,
    author: "Intercollegiate Psychedelics Network",
    published_at: "2026-06-01T12:00:00Z",
    source_id: "https://eepurl.com/1SSPfBtgif",
    source_name: "Mailchimp",
    featured: false,
    sort_order: 30,
    status: "published",
  },
  {
    id: "newsletter-may-2026",
    slug: "newsletter-may-2026",
    resource_type: "newsletter",
    title: "IPN Members Newsletter - May 2026",
    description: NEWSLETTER_SUMMARIES["newsletter-may-2026"],
    url: "https://eepurl.com/hdnYtGNMVx",
    category: "Monthly newsletter",
    ...NEWSLETTER_COVERS["newsletter-may-2026"],
    benefit_note: null,
    detail_body: null,
    author: "Intercollegiate Psychedelics Network",
    published_at: "2026-05-04T12:00:00Z",
    source_id: "https://eepurl.com/hdnYtGNMVx",
    source_name: "Mailchimp",
    featured: false,
    sort_order: 40,
    status: "published",
  },
]

export function withNewsletterCoverImage(resource: ResourceRecord) {
  if (resource.resource_type !== "newsletter") return resource

  const cover = NEWSLETTER_COVERS[resource.slug]
  if (!cover) return resource

  return {
    ...resource,
    description: NEWSLETTER_SUMMARIES[resource.slug] ?? resource.description,
    image_url: resource.image_url ?? cover.image_url,
    image_alt: resource.image_alt ?? cover.image_alt,
    thumbnail_url: resource.thumbnail_url ?? cover.thumbnail_url,
  }
}

export function latestPublishedDefaultNewsletter(now = new Date()) {
  return (
    DEFAULT_NEWSLETTERS.find(
      (resource) =>
        !resource.published_at || new Date(resource.published_at) <= now,
    ) ?? DEFAULT_NEWSLETTERS[0]
  )
}

export function withNewsletterFallback(
  resources: ResourceRecord[],
  now = new Date(),
) {
  const resourcesWithCovers = resources.map(withNewsletterCoverImage)
  const existingNewsletterSlugs = new Set(
    resourcesWithCovers
      .filter((resource) => resource.resource_type === "newsletter")
      .map((resource) => resource.slug),
  )
  const missingPublishedNewsletters = DEFAULT_NEWSLETTERS.filter(
    (resource) =>
      !existingNewsletterSlugs.has(resource.slug) &&
      (!resource.published_at || new Date(resource.published_at) <= now),
  )
  const newsletters = [
    ...resourcesWithCovers.filter(
      (resource) => resource.resource_type === "newsletter",
    ),
    ...missingPublishedNewsletters,
  ].sort(
    (a, b) =>
      new Date(b.published_at ?? 0).getTime() -
      new Date(a.published_at ?? 0).getTime(),
  )

  return [
    ...resourcesWithCovers.filter(
      (resource) => resource.resource_type !== "newsletter",
    ),
    ...newsletters,
  ]
}
