import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import WorkflowWorkspace from "@/components/leadership-workflows/WorkflowWorkspace"
import Sidebar from "@/components/Sidebar"
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
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row">
      <Sidebar
        firstName="Justin"
        lastName="Cornetta"
        email="justin@example.test"
        avatarUrl={null}
        pendingRequestCount={0}
        isAdmin
      />
      <div className="min-w-0 flex-1">
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
