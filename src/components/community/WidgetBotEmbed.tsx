type WidgetBotEmbedProps = {
  title: string
  src: string | null
  className?: string
  height?: string
}

export default function WidgetBotEmbed({
  title,
  src,
  className = "",
  height = "h-[520px]",
}: WidgetBotEmbedProps) {
  if (!src) {
    return (
      <div className={`flex ${height} items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-5 text-center ${className}`}>
        <div>
          <p className="text-sm font-medium text-zinc-700">{title} is not configured yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Add the WidgetBot server and channel IDs to enable this pilot surface.
          </p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      title={title}
      src={src}
      className={`w-full rounded-lg border border-zinc-200 bg-white ${height} ${className}`}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
    />
  )
}
