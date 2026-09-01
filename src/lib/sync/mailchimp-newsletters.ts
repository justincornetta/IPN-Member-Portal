import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildNewsletterResource,
  findLatestNewsletterCampaign,
  isAutomaticNewsletterSyncWindow,
  newsletterMonth,
  type MailchimpCampaign,
  type NewsletterResourcePayload,
} from "@/lib/sync/mailchimp-newsletter-core"
import {
  fallbackNewsletterSummary,
  type MailchimpCampaignContent,
} from "@/lib/sync/newsletter-content"
import {
  generateNewsletterPhoto,
  generateNewsletterSummary,
  reviewNewsletterCovers,
  type OpenAIConfig,
} from "@/lib/sync/newsletter-ai"
import { renderNewsletterCovers } from "@/lib/sync/newsletter-cover-renderer"

const MAILCHIMP_API_ROOT = "api.mailchimp.com/3.0"
const CAMPAIGN_LOOKBACK_DAYS = 45

type MailchimpConfig = {
  apiKey: string
  serverPrefix: string
  audienceId: string
  folderId: string | null
}

type NetlifyRuntime = {
  env?: { get(name: string): string | undefined }
}

declare const Netlify: NetlifyRuntime | undefined

export type NewsletterSyncResult = {
  status:
    | "inserted"
    | "updated"
    | "unchanged"
    | "dry_run"
    | "not_found"
    | "skipped"
  reason?: string
  campaignId?: string
  slug?: string
  payload?: NewsletterResourcePayload
}

function env(name: string) {
  const value =
    (typeof Netlify !== "undefined" ? Netlify.env?.get(name) : undefined) ??
    process.env[name]
  return value?.trim() || undefined
}

function mailchimpConfig(): MailchimpConfig | null {
  const apiKey = env("MAILCHIMP_API_KEY")
  const audienceId = env("MAILCHIMP_AUDIENCE_ID")
  const serverPrefix =
    env("MAILCHIMP_SERVER_PREFIX") ?? apiKey?.split("-").at(-1)

  if (!apiKey || !audienceId || !serverPrefix) return null
  if (!/^[a-z0-9-]+$/i.test(serverPrefix)) {
    throw new Error("Invalid Mailchimp server prefix")
  }

  return {
    apiKey,
    audienceId,
    serverPrefix,
    folderId: env("MAILCHIMP_NEWSLETTER_FOLDER_ID") ?? null,
  }
}

async function fetchMailchimpCampaigns(config: MailchimpConfig) {
  const since = new Date(Date.now() - CAMPAIGN_LOOKBACK_DAYS * 86400000)
  const url = new URL(
    `https://${config.serverPrefix}.${MAILCHIMP_API_ROOT}/campaigns`,
  )
  url.searchParams.set("status", "sent")
  url.searchParams.set("type", "regular")
  url.searchParams.set("list_id", config.audienceId)
  url.searchParams.set("sort_field", "send_time")
  url.searchParams.set("sort_dir", "DESC")
  url.searchParams.set("since_send_time", since.toISOString())
  url.searchParams.set("count", "25")
  if (config.folderId) url.searchParams.set("folder_id", config.folderId)

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`portal:${config.apiKey}`).toString("base64")}`,
      Accept: "application/json",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Mailchimp campaigns request failed (${response.status})`)
  }

  const body = (await response.json()) as { campaigns?: MailchimpCampaign[] }
  return body.campaigns ?? []
}

async function fetchMailchimpCampaignContent(
  config: MailchimpConfig,
  campaignId: string,
) {
  const response = await fetch(
    `https://${config.serverPrefix}.${MAILCHIMP_API_ROOT}/campaigns/${encodeURIComponent(campaignId)}/content`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`portal:${config.apiKey}`).toString("base64")}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  )
  if (!response.ok) {
    throw new Error(`Mailchimp campaign content request failed (${response.status})`)
  }
  return (await response.json()) as MailchimpCampaignContent
}

function openAIConfig(): OpenAIConfig | null {
  const apiKey = env("OPENAI_API_KEY")
  if (!apiKey) return null
  return {
    apiKey,
    textModel: env("OPENAI_NEWSLETTER_TEXT_MODEL") ?? "gpt-5-mini",
    imageModel: env("OPENAI_NEWSLETTER_IMAGE_MODEL") ?? "gpt-image-1",
  }
}

function generatedCoverPaths(campaign: MailchimpCampaign) {
  const { year, monthName } = newsletterMonth(campaign)
  const safeCampaignId = campaign.id.replace(/[^a-z0-9_-]+/gi, "-")
  const stem = `${monthName.toLowerCase()}-${safeCampaignId}`
  return {
    directory: `newsletters/${year}`,
    search: stem,
    cover: `newsletters/${year}/${stem}.png`,
    square: `newsletters/${year}/${stem}-square.png`,
    coverName: `${stem}.png`,
    squareName: `${stem}-square.png`,
  }
}

async function existingCoverUrls(
  supabase: ReturnType<typeof createAdminClient>,
  campaign: MailchimpCampaign,
) {
  const paths = generatedCoverPaths(campaign)
  const { data, error } = await supabase.storage
    .from("content-images")
    .list(paths.directory, { search: paths.search, limit: 20 })
  if (error) throw new Error(error.message)
  const names = new Set((data ?? []).map((item) => item.name))
  if (!names.has(paths.coverName) || !names.has(paths.squareName)) return null

  const bucket = supabase.storage.from("content-images")
  return {
    imageUrl: bucket.getPublicUrl(paths.cover).data.publicUrl,
    thumbnailUrl: bucket.getPublicUrl(paths.square).data.publicUrl,
  }
}

async function uploadCover(
  supabase: ReturnType<typeof createAdminClient>,
  path: string,
  image: Buffer,
) {
  const { error } = await supabase.storage
    .from("content-images")
    .upload(path, image, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    })
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(error.message)
  }
}

async function prepareNewsletterEnhancements(options: {
  config: MailchimpConfig
  openAI: OpenAIConfig
  campaign: MailchimpCampaign
}) {
  const supabase = createAdminClient()
  const month = newsletterMonth(options.campaign)
  const content = await fetchMailchimpCampaignContent(
    options.config,
    options.campaign.id,
  )
  const fallback = fallbackNewsletterSummary(
    options.campaign.settings?.preview_text,
    content,
    month.monthName,
  )
  const description = await generateNewsletterSummary({
    config: options.openAI,
    content,
    fallback,
    monthLabel: month.label,
  }).catch((error: unknown) => {
    console.warn("[newsletter-sync] Summary generation failed; using fallback", {
      campaignId: options.campaign.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return fallback
  })

  const stored = await existingCoverUrls(supabase, options.campaign)
  if (stored) return { description, ...stored }

  let images: Awaited<ReturnType<typeof renderNewsletterCovers>> | null = null
  let corrections: string | undefined
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const photo = await generateNewsletterPhoto({
      config: options.openAI,
      month: month.month,
      monthLabel: month.label,
      summary: description,
      corrections,
    })
    const candidate = await renderNewsletterCovers({
      photo,
      monthName: month.monthName,
      year: month.year,
    })
    const review = await reviewNewsletterCovers({
      config: options.openAI,
      cover: candidate.cover,
      square: candidate.square,
    })
    if (review.verdict === "GO") {
      images = candidate
      break
    }
    corrections = review.issues.join(" ").slice(0, 1_000)
    console.warn("[newsletter-sync] Cover review requested regeneration", {
      campaignId: options.campaign.id,
      attempt,
      issues: review.issues,
    })
  }
  if (!images) {
    throw new Error("Newsletter cover failed visual quality review after two attempts")
  }
  const paths = generatedCoverPaths(options.campaign)
  await uploadCover(supabase, paths.cover, images.cover)
  await uploadCover(supabase, paths.square, images.square)

  const bucket = supabase.storage.from("content-images")
  return {
    description,
    imageUrl: bucket.getPublicUrl(paths.cover).data.publicUrl,
    thumbnailUrl: bucket.getPublicUrl(paths.square).data.publicUrl,
  }
}

export async function syncLatestMailchimpNewsletter(
  options: { dryRun?: boolean; force?: boolean; now?: Date } = {},
): Promise<NewsletterSyncResult> {
  const now = options.now ?? new Date()
  if (!options.force && !isAutomaticNewsletterSyncWindow(now)) {
    return { status: "skipped", reason: "outside automatic sync window" }
  }

  const config = mailchimpConfig()
  if (!config) {
    return { status: "skipped", reason: "Mailchimp sync is not configured" }
  }

  const campaigns = await fetchMailchimpCampaigns(config)
  const campaign = findLatestNewsletterCampaign(campaigns, {
    now,
    audienceId: config.audienceId,
    folderId: config.folderId,
  })
  if (!campaign) {
    return { status: "not_found", reason: "no matching newsletter this month" }
  }

  const previewPayload = buildNewsletterResource(campaign)
  if (options.dryRun) {
    return {
      status: "dry_run",
      campaignId: campaign.id,
      slug: previewPayload.slug,
      payload: previewPayload,
    }
  }

  const supabase = createAdminClient()
  const { data: existing, error: lookupError } = await supabase
    .from("resources")
    .select("id, source_id, url, published_at, description, image_url, thumbnail_url")
    .eq("slug", previewPayload.slug)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)

  const alreadyComplete = Boolean(
    existing &&
      existing.source_id === previewPayload.source_id &&
      existing.url === previewPayload.url &&
      existing.published_at === previewPayload.published_at &&
      existing.description &&
      existing.image_url &&
      existing.thumbnail_url,
  )
  if (alreadyComplete) {
    return {
      status: "unchanged",
      campaignId: campaign.id,
      slug: previewPayload.slug,
    }
  }

  const ai = openAIConfig()
  if (!ai) {
    throw new Error("OpenAI newsletter generation is not configured")
  }

  const enhancements = await prepareNewsletterEnhancements({
    config,
    openAI: ai,
    campaign,
  })
  const payload = buildNewsletterResource(campaign, enhancements)

  const unchanged = Boolean(
    existing &&
      existing.source_id === payload.source_id &&
      existing.url === payload.url &&
      existing.published_at === payload.published_at,
  )

  const query = existing
    ? supabase.from("resources").update(payload).eq("id", existing.id)
    : supabase.from("resources").insert(payload)
  const { error } = await query
  if (error) throw new Error(error.message)

  const { error: featureError } = await supabase
    .from("resources")
    .update({ featured: false })
    .eq("resource_type", "newsletter")
    .neq("slug", payload.slug)
  if (featureError) throw new Error(featureError.message)

  return {
    status: unchanged ? "unchanged" : existing ? "updated" : "inserted",
    campaignId: campaign.id,
    slug: payload.slug,
  }
}
