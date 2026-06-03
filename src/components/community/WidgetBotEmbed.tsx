type Props = {
  title: string
  src: string | null
  className?: string
  height?: string
}

export default function WidgetBotEmbed({
  title,
  src,
  className = "",
  height = "420px",
}: Props) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center ${className}`}
        style={{ minHeight: height }}
      >
        <p className="max-w-xs text-sm leading-6 text-zinc-500">
          Add the WidgetBot server and channel IDs to enable this Discord pilot surface.
        </p>
      </div>
    )
  }

  return (
    <iframe
      title={title}
      src={src}
      className={`w-full rounded-lg border border-zinc-200 bg-white ${className}`}
      style={{ height }}
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-forms"
      referrerPolicy="no-referrer"
    />
  )
}
