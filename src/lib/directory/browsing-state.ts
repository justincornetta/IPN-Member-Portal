import type { ConnectionEntry, DirectoryMember, DirectoryParams } from "./types"

export function directoryQueryKey(params: DirectoryParams, view: string, userId: string) {
  return JSON.stringify([userId, view, params.tab, params.q.trim(), params.school,
    params.field, [...params.personas].sort(), [...params.tags].sort()])
}

/** Revalidation refreshes page one; it is not a request to discard later pages. */
export function reconcileDirectoryMembers(
  loaded: DirectoryMember[],
  incoming: DirectoryMember[],
  connections: Record<string, ConnectionEntry>,
  currentUserId: string,
): DirectoryMember[] {
  const fresh = new Map(incoming.map((member) => [member.id, member]))
  const seen = new Set(loaded.map((member) => member.id))
  return [...loaded.map((member) => fresh.get(member.id) ?? member),
    ...incoming.filter((member) => !seen.has(member.id))]
    .map((member) => ({
      ...member,
      contact: member.id === currentUserId || connections[member.id]?.status === "accepted"
        ? member.contact : null,
    }))
}
