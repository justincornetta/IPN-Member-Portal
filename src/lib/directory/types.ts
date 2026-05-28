export type DirectoryMember = {
  id: string
  first_name: string | null
  last_name: string | null
  persona: string | null
  school: string | null
  affiliation: string | null
  field: string | null
  city: string | null
  state: string | null
  bio: string | null
  interest_tags: string[] | null
  linkedin_url: string | null
  avatar_url: string | null
}

export type DirectoryParams = {
  q: string
  personas: string[]
  school: string
  field: string
  tab: string
  tags: string[]
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
