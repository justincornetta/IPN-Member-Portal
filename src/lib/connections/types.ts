import type { ConnectionEntry, DirectoryContact } from "../directory/types"

export type ConnectionActionResult =
  | { error: string; entry?: never; contact?: never; contactWarning?: never }
  | { error?: never; entry: ConnectionEntry; contact: DirectoryContact | null; contactWarning?: string }
