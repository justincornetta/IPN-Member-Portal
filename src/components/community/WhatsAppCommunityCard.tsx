"use client"

type WhatsAppCommunityCardProps = {
  className?: string
  compact?: boolean
  onJoin?: () => void
}

const WHATSAPP_COMMUNITY_URL = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_URL

export const WHATSAPP_COMMUNITY_COPY =
  "Connect with members, stay up to date on IPN events, ask questions, share feedback, and join event-specific chats."

function WhatsAppIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.05 4.91A9.8 9.8 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.27-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.86 9.86 0 0 0-2.9-7.01ZM12.04 20.15h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.54 3.69-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.23 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.16 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  )
}

export default function WhatsAppCommunityCard({
  className = "",
  compact = false,
  onJoin,
}: WhatsAppCommunityCardProps) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white ${compact ? "p-4" : "p-5"} shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <WhatsAppIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">
            Join the IPN WhatsApp Community
          </span>
          <span className="mt-1 block text-sm leading-6 text-zinc-500">
            {WHATSAPP_COMMUNITY_COPY}
          </span>
        </span>
      </div>

      <div className="mt-4">
        {WHATSAPP_COMMUNITY_URL ? (
          <a
            href={WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noreferrer"
            onClick={onJoin}
            className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Join WhatsApp Community
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400"
          >
            WhatsApp invite coming soon
          </button>
        )}
      </div>
    </div>
  )
}
