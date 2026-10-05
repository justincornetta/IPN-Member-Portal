import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import WorkflowWorkspace from "@/components/leadership-workflows/WorkflowWorkspace"
import AdminMenu from "@/components/admin/AdminMenu"
export default async function Page({
  params
}: {
  params: Promise<{ kind: string }>
}) {
  const { kind } = await params
  const host = (await headers()).get("host") || ""
  if (
    process.env.NODE_ENV === "production" ||
    process.env.LEADERSHIP_LOCAL_DEMO !== "1" ||
    !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
    !["media", "expenses"].includes(kind)
  )
    notFound()
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-zinc-50 md:flex-row">
      <aside className="hidden h-full overflow-y-auto border-r border-zinc-200 bg-white p-4 md:block md:w-60 md:shrink-0">
        <p className="mb-6 px-3 text-lg font-semibold text-ipn">
          IPN Member Portal
        </p>
        <nav aria-label="Preview admin navigation">
          <AdminMenu preview />
        </nav>
        <p className="mt-6 px-3 text-xs leading-relaxed text-zinc-500">
          Local workflow preview. Other portal pages are unavailable here. No
          sign-in is needed; use “Preview as” to switch roles.
        </p>
      </aside>
      <div
        aria-label="Workflow content"
        role="region"
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ipn"
      >
        <nav className="flex gap-5 border-b border-zinc-200 bg-white px-8 py-4 text-sm">
          <Link className="text-ipn" href="/workflow-preview/media">
            Media Requests
          </Link>
          <Link className="text-ipn" href="/workflow-preview/expenses">
            Expense Submissions
          </Link>
        </nav>
        <WorkflowWorkspace kind={kind === "media" ? "media" : "expense"} demo />
      </div>
    </div>
  )
}
