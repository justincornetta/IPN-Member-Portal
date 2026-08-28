import Image from "next/image"

const CATEGORY_GRADIENTS: Record<string, string> = {
  Academic: "bg-[radial-gradient(circle_at_20%_20%,#a78bfa_0,#664fa1_30%,#18181b_75%)]",
  Industry: "bg-[radial-gradient(circle_at_20%_20%,#fbbf24_0,#b45309_30%,#18181b_75%)]",
  Community: "bg-[radial-gradient(circle_at_20%_20%,#5eead4_0,#0f766e_30%,#18181b_75%)]",
  "Harm Reduction": "bg-[radial-gradient(circle_at_20%_20%,#f9a8d4_0,#9d174d_30%,#18181b_75%)]",
}

type ConferenceCoverProps = {
  imageUrl: string | null
  category: string | null
  hasMeetup?: boolean
  className?: string
  sizes: string
  priority?: boolean
}

export default function ConferenceCover({
  imageUrl,
  category,
  hasMeetup = false,
  className = "",
  sizes,
  priority = false,
}: ConferenceCoverProps) {
  const gradient = CATEGORY_GRADIENTS[category ?? ""] ?? CATEGORY_GRADIENTS.Community

  return (
    <div className={`relative aspect-video overflow-hidden ${gradient} ${className}`}>
      {imageUrl && (
        <>
          <Image
            src={imageUrl}
            alt=""
            fill
            priority={priority}
            sizes={sizes}
            unoptimized
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/5" />
        </>
      )}

      {category && (
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800 shadow-sm backdrop-blur-sm sm:left-4 sm:top-4">
          {category}
        </span>
      )}
      {hasMeetup && (
        <span className="absolute right-3 top-3 rounded-md bg-ipn px-2 py-1 text-[11px] font-medium text-white shadow-sm sm:right-4 sm:top-4">
          IPN meetup
        </span>
      )}
    </div>
  )
}
