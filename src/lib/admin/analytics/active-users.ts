import type { PortalUtilizationData } from "./portal-utilization"

export type ActiveUserWindow = "monthly" | "weekly"

export function activeUserWindowStart(date: string, window: ActiveUserWindow) {
  const start = new Date(`${date}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() - (window === "weekly" ? 6 : 29))
  return start.toISOString().slice(0, 10)
}

export function activeUserIds(
  actions: PortalUtilizationData["qualifyingActions"], date: string, window: ActiveUserWindow,
) {
  const start = activeUserWindowStart(date, window)
  return new Set(actions.filter((action) => action.date >= start && action.date <= date).map((action) => action.userId))
}

export function buildActiveUserDetails(data: PortalUtilizationData, cohortIds: Set<string>, date: string, window: ActiveUserWindow) {
  const actions = data.qualifyingActions.filter((action) => cohortIds.has(action.userId))
  const ids = activeUserIds(actions, date, window)
  const end = new Date(`${date}T23:59:59.999Z`).getTime()
  const beforeEnd = (value: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= end
  const latest = <T extends { occurredAt: string }>(rows: T[]) => rows.filter((row) => beforeEnd(row.occurredAt))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0] ?? null
  return data.members.filter((member) => ids.has(member.userId)).map((member) => {
    const qualifying = latest(actions.filter((action) => action.userId === member.userId))
    const signIn = latest(data.signInActions.filter((action) => action.userId === member.userId))?.occurredAt ?? null
    const authSignIn = member.signInActivity.all.lastSignedInAt
    const lastSignIn = [signIn, authSignIn].filter((value): value is string => Boolean(value && beforeEnd(value)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
    return { userId: member.userId, name: member.fullName, email: member.email, lastSignIn, lastQualifyingActivity: qualifying }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email))
}
