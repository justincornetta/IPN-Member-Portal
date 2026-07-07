export type MemberDirectorySources = {
  portal: boolean
  form: boolean
  mailchimp: boolean
  oldapp: boolean
}

export type MemberDirectoryRow = {
  id: string
  normalizedEmail: string
  portalId: string | null
  legacyId: string | null
  name: string
  email: string
  location: string
  country: string
  state: string
  city: string
  persona: string
  selfDescription: string
  primaryField: string
  psychedelicFieldStatus: string
  psychedelicFieldBarriers: string[]
  referralSource: string
  school: string
  interestTags: string[]
  firstSeenAt: string | null
  firstSeenSource: string
  firstSeenConfidence: "high" | "low"
  sources: MemberDirectorySources
  sourceCount: number
  channelsPresent: string
  whatsappConnected: boolean
  portalDiscoverable: boolean | null
  portalInterestTagCount: number
  mailchimpStatus: string
  eventCount: number
  engagementStatus: string
}

export type MemberDirectoryDetail = MemberDirectoryRow & {
  portal: {
    id: string | null
    firstName: string
    lastName: string
    email: string
    discoverable: boolean | null
    persona: string
    affiliation: string
    school: string
    field: string
    psychedelicFieldStatus: string
    psychedelicFieldBarriers: string[]
    roleAndGoals: string
    inspiration: string
    referralSource: string
    country: string
    state: string
    city: string
    whatsappUrl: string
    linkedinUrl: string
    bio: string
    interestTags: string[]
    createdAt: string | null
    mailchimpStatus: string
  }
  legacy: {
    personId: string
    firstName: string
    lastName: string
    fullName: string
    email: string
    originalEmail: string
    affiliation: string
    country: string
    state: string
    city: string
    selfDescription: string
    primaryField: string
    psychedelicFieldStatus: string
    psychedelicFieldBarriers: string
    currentRoleAndGoals: string
    ipnInspiration: string
    referralSource: string
    channelsPresent: string
    channelCount: number
    engagementStatus: string
    firstSeenAt: string | null
    lastSeenAt: string | null
    mailchimpId: string
    mailchimpAudiences: string
    mailchimpStatus: string
    zoomRegistrations: number
    zoomAttended: number
    zoomTotalMinutes: number
    zoomLastEventDate: string
    zoomAttendanceStatus: string
    eventbriteEventCount: number
    eventbriteLastEventDate: string
    notes: string
  }
  sensitive: {
    oldappUserId: string
    dateOfBirth: string
    gender: string
    race: string
    oldappSignupLocation: string
  }
}

export type MemberDirectoryData = {
  generatedAt: string
  importFreshness: {
    importedAt: string | null
    sourcePulledAt: string | null
    rowCount: number
  }
  rows: MemberDirectoryRow[]
  sourceTotals: { id: keyof MemberDirectorySources; label: string; value: number }[]
  chartData: {
    stageBreakdown: { label: string; value: number }[]
    fieldBreakdown: { label: string; value: number }[]
    topInterestTags: { label: string; value: number }[]
    topSchools: { label: string; value: number }[]
    bestDescribes: { label: string; value: number }[]
    primaryField: { label: string; value: number }[]
    referralSources: { label: string; value: number }[]
    psychedelicFieldStatus: { label: string; value: number }[]
    psychedelicFieldBarriers: { label: string; value: number }[]
    gender: { label: string; value: number }[]
    age: { label: string; value: number }[]
    raceEthnicity: { label: string; value: number }[]
  }
  geography: {
    id: string
    city: string
    state: string
    country: string
    lat: number | null
    lng: number | null
    memberCount: number
    identifiableCount: number
    sourceCounts: { id: keyof MemberDirectorySources; label: string; value: number }[]
    members: {
      id: string
      name: string
      email: string
      sources: MemberDirectorySources
    }[]
  }[]
  whatsapp: {
    connected: number
    totalPortalMembers: number
  }
}
