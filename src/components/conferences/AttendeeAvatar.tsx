function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return `${first}${last}`.toUpperCase()
}

type Props = {
  name: string
  avatarUrl?: string | null
  size?: "xs" | "sm"
  ringed?: boolean
}

export default function AttendeeAvatar({ name, avatarUrl, size = "sm", ringed = false }: Props) {
  const cls = size === "xs" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"

  return (
    <div
      title={name}
      className={`${cls} flex-shrink-0 overflow-hidden rounded-full ${ringed ? "ring-2 ring-white" : ""}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn font-semibold text-white">
          {getInitials(name)}
        </div>
      )}
    </div>
  )
}
