export type ResourceType =
  | "affiliate_benefit"
  | "ipn_lab_recording"
  | "psychedelx_recording"
  | "blog_post"
  | "partner"

export type ResourceRecord = {
  id: string
  slug: string
  resource_type: ResourceType
  title: string
  description: string | null
  url: string
  category: string
  image_url: string | null
  image_alt: string | null
  thumbnail_url: string | null
  benefit_note: string | null
  detail_body: string | null
  author: string | null
  published_at: string | null
  source_id: string | null
  source_name: string | null
  featured: boolean
  sort_order: number
  status: string
}
