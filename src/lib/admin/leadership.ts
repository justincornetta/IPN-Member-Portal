export const LEADERSHIP_TEAMS = [
  "Strategy and Operations",
  "Media",
  "PsychedelX",
  "Community",
  "IPN Labs",
] as const

export type LeadershipTeam = (typeof LEADERSHIP_TEAMS)[number]
export type PortalAdminRole = "admin" | "superadmin"

export function isPortalAdminRole(role: unknown): role is PortalAdminRole {
  return role === "admin" || role === "superadmin"
}

export function isLeadershipTeam(team: string): team is LeadershipTeam {
  return (LEADERSHIP_TEAMS as readonly string[]).includes(team)
}

export function roleAfterLeadershipAssignment(
  currentRole: string | null | undefined,
  adminRole: string | null,
  team: string | null,
): PortalAdminRole | null {
  if (currentRole === "superadmin") return "superadmin"
  return adminRole || team ? "admin" : null
}
