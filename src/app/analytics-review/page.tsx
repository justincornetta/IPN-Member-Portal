import { notFound } from "next/navigation"

import AnalyticsDashboardShell from "@/app/dashboard/admin/AnalyticsDashboardShell"
import { buildAnalyticsReviewFixture } from "@/lib/admin/analytics/review-fixture"

export default function AnalyticsReviewPage() {
  if (process.env.NODE_ENV === "production") notFound()

  const fixture = buildAnalyticsReviewFixture()
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Local review only · synthetic identities · this route returns 404 in production.
        </div>
        <AnalyticsDashboardShell
          {...fixture}
          analyticsRefresh={null}
          eventLabelOverrides={[]}
          isSuperadmin={false}
        />
      </div>
    </main>
  )
}
