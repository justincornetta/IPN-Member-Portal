export type ResourceType = "content" | "partner" | "affiliate_benefit"

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
  benefit_note: string | null
  featured: boolean
  sort_order: number
  status: string
}
