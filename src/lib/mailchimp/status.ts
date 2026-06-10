export type MailchimpStatus =
  | "subscribed"
  | "unsubscribed"
  | "cleaned"
  | "pending"
  | "transactional"
  | "sync_failed"
  | "not_found"
  | "unknown"

export type MailchimpErrorRaw = {
  status?: number
  type?: string
  title?: string
  detail?: string
  instance?: string
  response?: unknown
}

export type MailchimpSyncResult = {
  status: MailchimpStatus
  error?: string
  errorRaw?: MailchimpErrorRaw
  errorDescription?: string
}

export function profileMailchimpFields(result: MailchimpSyncResult) {
  return {
    mailchimp_status: result.status,
    mailchimp_synced_at: new Date().toISOString(),
    mailchimp_last_error_raw: result.errorRaw ?? null,
    mailchimp_last_error_description: result.errorDescription ?? null,
  }
}

export function canonicalMailchimpErrorDescription(raw: MailchimpErrorRaw): string {
  const status = raw.status
  const title = raw.title?.toLowerCase() ?? ""
  const detail = raw.detail?.toLowerCase() ?? ""

  if (detail.includes("forgotten")) {
    return "Mailchimp rejected this address because the contact was permanently deleted. It may need to resubscribe through a hosted Mailchimp form."
  }
  if (status === 400 || title.includes("invalid resource")) {
    return "Mailchimp could not process this subscriber record. Check the email address and any required audience fields."
  }
  if (status === 401 || title.includes("api key")) {
    return "Mailchimp rejected the API credentials. Check MAILCHIMP_API_KEY and confirm its data center suffix matches the account."
  }
  if (status === 403 || title.includes("forbidden")) {
    return "The Mailchimp API key does not have permission to update this audience."
  }
  if (status === 404 || title.includes("not found")) {
    return "Mailchimp could not find this email in the configured audience, or the audience ID/API data center is wrong."
  }
  if (status === 405 || title.includes("method not allowed")) {
    return "The Mailchimp endpoint rejected this request method. Check the API URL and member update method."
  }
  if (status === 414 || title.includes("nesting")) {
    return "Mailchimp rejected the request URL as malformed. Check the audience ID and subscriber path."
  }
  if (status === 422 || title.includes("invalidmethodoverride")) {
    return "Mailchimp rejected an unsupported method override."
  }
  if (status === 429 || title.includes("toomanyrequests")) {
    return "Mailchimp is rate limiting API requests. Retry after current requests finish."
  }
  if (status && status >= 500) {
    return "Mailchimp reported a server-side problem or outage. Retry later and check Mailchimp status if it persists."
  }
  return "Mailchimp did not sync this member. Review the raw error for the exact response."
}

export function normalizeMailchimpStatus(status: string | null | undefined): MailchimpStatus {
  switch (status) {
    case "subscribed":
    case "unsubscribed":
    case "cleaned":
    case "pending":
    case "transactional":
      return status
    default:
      return "unknown"
  }
}
