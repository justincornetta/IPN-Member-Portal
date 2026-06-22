export type DirectoryContact = {
  email: string | null
  whatsapp_url: string | null
}

export type DirectoryMember = {
  id: string
  first_name: string | null
  last_name: string | null
  country?: string | null
  persona: string | null
  school: string | null
  affiliation: string | null
  field: string | null
  city: string | null
  state: string | null
  city_lat?: number | null
  city_lng?: number | null
  bio: string | null
  interest_tags: string[] | null
  linkedin_url: string | null
  avatar_url: string | null
  admin_role: string | null
  team: string | null
  contact?: DirectoryContact | null
}

export type DirectoryMapMember = DirectoryMember & {
  country: string | null
  city_lat: number
  city_lng: number
}

export type DirectoryMapCity = {
  id: string
  city: string
  state: string | null
  country: string | null
  lat: number
  lng: number
  memberCount: number
  members: DirectoryMapMember[]
}

export type DirectoryParams = {
  q: string
  personas: string[]
  school: string
  field: string
  tab: string
  tags: string[]
  recording: boolean
}

export type DirectoryProps = {
  members: DirectoryMember[]
  showSchoolTab: boolean
  currentParams: DirectoryParams
  schools: string[]
}

export type ConnectionStatus = "pending" | "accepted" | "declined"

export type ConnectionEntry = {
  status: ConnectionStatus
  amRequester: boolean
}
