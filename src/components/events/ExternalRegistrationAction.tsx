import { externalRegistrationLabel } from "@/lib/events/external-registration"

type Props = {
  url: string
  provider?: string | null
  analyticsId: string
  className?: string
  preview?: boolean
}

const DEFAULT_CLASS_NAME =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"

export default function ExternalRegistrationAction({
  url,
  provider,
  analyticsId,
  className = DEFAULT_CLASS_NAME,
  preview = false,
}: Props) {
  const label = externalRegistrationLabel(provider)

  if (preview) {
    return <span className={className}>{label}</span>
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      data-analytics-event="curated_click"
      data-analytics-id={analyticsId}
      data-analytics-label={label}
      className={className}
    >
      {label}
    </a>
  )
}
