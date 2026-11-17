type Props = {
  src?: string | null
  className?: string
}

/** Event artwork is a complete graphic, so never crop it to fill a frame. */
export default function EventArtwork({ src, className = "" }: Props) {
  return (
    <div className={`relative aspect-[2/1] overflow-hidden bg-zinc-100 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || "/purple_icon.png"}
        alt=""
        className={`absolute inset-0 h-full w-full object-contain ${src ? "" : "p-[10%]"}`}
      />
    </div>
  )
}
