"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
export default function AdminMenu({
  onClose,
  preview = false
}: {
  onClose?: () => void
  preview?: boolean
}) {
  const pathname = usePathname()
  const active =
    pathname.startsWith("/dashboard/admin") ||
    (preview && pathname.startsWith("/workflow-preview/"))
  return (
    <details open={active} className="rounded-lg">
      <summary
        className={`flex min-h-11 cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${active ? "bg-ipn-light font-medium text-ipn" : "text-zinc-600 hover:bg-zinc-50"}`}
      >
        <span>Admin</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="mt-1 flex flex-col gap-1 border-l border-zinc-200 pl-3">
        {[
          { label: "Analytics", href: "/dashboard/admin?tab=analytics" },
          { label: "Content", href: "/dashboard/admin?tab=content" },
          { label: "Media Requests", href: "/dashboard/admin/media" },
          { label: "Expense Submissions", href: "/dashboard/admin/expenses" },
          { label: "Leadership", href: "/dashboard/admin?tab=leadership" }
        ].map((link) => {
          const previewHref =
            link.label === "Media Requests"
              ? "/workflow-preview/media"
              : link.label === "Expense Submissions"
                ? "/workflow-preview/expenses"
                : null
          if (preview && !previewHref)
            return (
              <span
                key={link.label}
                aria-disabled="true"
                title="Unavailable in the local workflow preview"
                className="min-h-11 rounded-lg px-3 py-3 text-sm text-zinc-400"
              >
                {link.label}
              </span>
            )
          const href = preview ? (previewHref ?? link.href) : link.href
          return (
            <Link
              key={link.label}
              href={href}
              onClick={onClose}
              className={`min-h-11 rounded-lg px-3 py-3 text-sm ${pathname === href ? "bg-ipn-light text-ipn" : "text-zinc-600 hover:bg-zinc-50"}`}
            >
              {link.label}
            </Link>
          )
        })}
      </div>
    </details>
  )
}
