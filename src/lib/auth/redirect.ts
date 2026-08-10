export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (typeof path !== "string" || !path.startsWith("/")) return false
  // Reject protocol-relative ("//evil.com") and backslash ("/\evil.com") tricks
  // that browsers can resolve to an external host despite the leading "/".
  if (path.startsWith("//") || path.startsWith("/\\")) return false
  return true
}
