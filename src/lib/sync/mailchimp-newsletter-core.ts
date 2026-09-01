const NEWSLETTER_TIME_ZONE = "America/New_York"
const AUTOMATIC_SYNC_LAST_DAY = 5

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export type MailchimpCampaign = {
  id: string
  parent_campaign_id?: string
  type?: string
  status?: string
  archive_url?: string
  long_archive_url?: string
  send_time?: string
  recipients?: {
    list_id?: string
  }
  settings?: {
    title?: string
    subject_line?: string
    preview_text?: string
    folder_id?: string | number
  }
  social_card?: {
    image_url?: string
  }
}

export type NewsletterResourcePayload = {
  slug: string
  resource_type: "newsletter"
  title: string
  description: string
  url: string
  category: "Monthly newsletter"
  author: "Intercollegiate Psychedelics Network"
  published_at: string
  source_id: string
  source_name: "Mailchimp"
  featured: true
  sort_order: 5
  status: "published"
  image_url?: string
  image_alt?: string
  thumbnail_url?: string
}

export type NewsletterResourceEnhancements = {
  description?: string
  imageUrl?: string
  thumbnailUrl?: string
}

function monthParts(date: Date, timeZone = NEWSLETTER_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  }
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`
}

function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`
}

function campaignCopy(campaign: MailchimpCampaign) {
  return [campaign.settings?.title, campaign.settings?.subject_line]
    .filter(Boolean)
    .join(" ")
}

function explicitCampaignMonth(campaign: MailchimpCampaign) {
  const match = campaignCopy(campaign).match(
    new RegExp(`\\b(${MONTHS.join("|")})\\s+(20\\d{2})\\b`, "i"),
  )
  if (!match) return null

  const month = MONTHS.findIndex(
    (candidate) => candidate.toLowerCase() === match[1].toLowerCase(),
  ) + 1
  return { year: Number(match[2]), month }
}

function campaignMonth(campaign: MailchimpCampaign) {
  const explicit = explicitCampaignMonth(campaign)
  if (explicit) return explicit
  if (!campaign.send_time) return null

  const sent = new Date(campaign.send_time)
  if (Number.isNaN(sent.getTime())) return null
  return monthParts(sent)
}

export function isAutomaticNewsletterSyncWindow(now = new Date()) {
  const { day } = monthParts(now)
  return day >= 1 && day <= AUTOMATIC_SYNC_LAST_DAY
}

export function findLatestNewsletterCampaign(
  campaigns: MailchimpCampaign[],
  options: {
    now?: Date
    audienceId?: string
    folderId?: string | null
  } = {},
) {
  const now = options.now ?? new Date()
  const expected = monthParts(now)
  const expectedMonthKey = monthKey(expected.year, expected.month)

  return campaigns
    .filter((campaign) => {
      if (campaign.status && campaign.status !== "sent") return false
      if (campaign.type && campaign.type !== "regular") return false
      if (campaign.parent_campaign_id) return false
      if (
        options.audienceId &&
        campaign.recipients?.list_id &&
        campaign.recipients.list_id !== options.audienceId
      ) return false
      if (
        options.folderId &&
        String(campaign.settings?.folder_id ?? "") !== options.folderId
      ) return false

      const copy = campaignCopy(campaign)
      if (!/\bipn\b/i.test(copy) || !/\bnewsletter\b/i.test(copy)) return false

      const candidateMonth = campaignMonth(campaign)
      return Boolean(
        candidateMonth &&
          monthKey(candidateMonth.year, candidateMonth.month) ===
            expectedMonthKey,
      )
    })
    .sort(
      (a, b) =>
        new Date(b.send_time ?? 0).getTime() -
        new Date(a.send_time ?? 0).getTime(),
    )[0] ?? null
}

export function buildNewsletterResource(
  campaign: MailchimpCampaign,
  enhancements: NewsletterResourceEnhancements = {},
): NewsletterResourcePayload {
  const campaignDate = campaignMonth(campaign)
  const archiveUrl = campaign.archive_url ?? campaign.long_archive_url
  if (!campaignDate || !campaign.send_time || !archiveUrl) {
    throw new Error("Mailchimp newsletter is missing its date or archive URL")
  }

  const label = monthLabel(campaignDate.year, campaignDate.month)
  const slug = `newsletter-${MONTHS[campaignDate.month - 1].toLowerCase()}-${campaignDate.year}`
  const imageUrl =
    enhancements.imageUrl?.trim() ?? campaign.social_card?.image_url?.trim()
  const thumbnailUrl = enhancements.thumbnailUrl?.trim() ?? imageUrl
  const payload: NewsletterResourcePayload = {
    slug,
    resource_type: "newsletter",
    title: `IPN Members Newsletter - ${label}`,
    description: enhancements.description?.trim() ||
      campaign.settings?.preview_text?.trim() ||
      `The ${MONTHS[campaignDate.month - 1]} monthly update for IPN members.`,
    url: archiveUrl,
    category: "Monthly newsletter",
    author: "Intercollegiate Psychedelics Network",
    published_at: new Date(campaign.send_time).toISOString(),
    source_id: `mailchimp:${campaign.id}`,
    source_name: "Mailchimp",
    featured: true,
    sort_order: 5,
    status: "published",
  }

  if (imageUrl) {
    payload.image_url = imageUrl
    payload.image_alt = `IPN Members Newsletter cover for ${label}`
    payload.thumbnail_url = thumbnailUrl
  }

  return payload
}

export function newsletterMonth(campaign: MailchimpCampaign) {
  const value = campaignMonth(campaign)
  if (!value) throw new Error("Mailchimp newsletter is missing its date")
  return {
    ...value,
    monthName: MONTHS[value.month - 1],
    label: monthLabel(value.year, value.month),
  }
}
