import { redirect } from "next/navigation"
import { getDashboardProfile, getDashboardViewer } from "@/lib/supabase/dashboard-viewer"
import Sidebar from "@/components/Sidebar"
import FeedbackFooter from "@/components/FeedbackFooter"
import { ProductTourProvider } from "@/components/product-tour/ProductTourProvider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await getDashboardViewer()

  if (!user) redirect("/login")

  const [profileResult, pendingResult, tourProgressResult] = await Promise.all([
    getDashboardProfile(user.id),
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("member_onboarding_progress")
      .select("product_tour_started_at, product_tour_current_step, product_tour_completed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  if ((profile as { is_banned?: boolean } | null)?.is_banned === true) redirect("/banned")

  const pendingRequestCount = pendingResult.count ?? 0
  const isAdmin = profile?.role === "superadmin" || profile?.role === "admin"

  return (
    <ProductTourProvider
      userId={user.id}
      serverStateAvailable={!tourProgressResult.error}
      serverProgress={{
        startedAt: tourProgressResult.data?.product_tour_started_at ?? null,
        currentStep: tourProgressResult.data?.product_tour_current_step ?? null,
        completedAt: tourProgressResult.data?.product_tour_completed_at ?? null,
      }}
    >
      <div className="flex h-full flex-col overflow-hidden md:flex-row">
        <Sidebar
          firstName={profile?.first_name ?? null}
          lastName={profile?.last_name ?? null}
          email={user.email ?? ""}
          avatarUrl={profile?.avatar_url ?? null}
          pendingRequestCount={pendingRequestCount}
          isAdmin={isAdmin}
        />
        <div className="flex flex-1 flex-col overflow-y-auto bg-zinc-50 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
          <FeedbackFooter />
        </div>
      </div>
    </ProductTourProvider>
  )
}
