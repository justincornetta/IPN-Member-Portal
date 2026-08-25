export const PRODUCT_TOUR_VERSION = 1

export type ProductTourStatus = "active" | "paused" | "completed"

export type ProductTourProgress = {
  version: number
  status: ProductTourStatus
  stepIndex: number
}

export const PRODUCT_TOUR_STEPS = [
  {
    id: "dashboard",
    title: "Your dashboard",
    description: "See upcoming events, your activation path, and ways to explore IPN.",
    route: "/dashboard",
  },
  {
    id: "profile",
    title: "Build your profile",
    description: "Add a photo, bio, and interests so members can get to know you.",
    route: "/dashboard/profile",
  },
  {
    id: "events",
    title: "Find IPN events",
    description: "Browse upcoming gatherings, RSVP, and return for event details.",
    route: "/dashboard/events",
  },
  {
    id: "community",
    title: "Meet the community",
    description: "Discover members by school, field, location, and shared interests.",
    route: "/dashboard/directory",
  },
  {
    id: "conferences",
    title: "Navigate conferences",
    description: "Find conference details and connect with other IPN attendees.",
    route: "/dashboard/conferences",
  },
  {
    id: "resources",
    title: "Use member resources",
    description: "Explore member benefits, articles, and partner organizations.",
    route: "/dashboard/resources",
  },
  {
    id: "dashboard-return",
    title: "You’re ready to explore",
    description: "Return here anytime to see what’s next across the network.",
    route: "/dashboard",
  },
] as const

export function clampTourStep(stepIndex: number): number {
  if (!Number.isFinite(stepIndex)) return 0
  return Math.max(0, Math.min(PRODUCT_TOUR_STEPS.length - 1, Math.trunc(stepIndex)))
}

export function parseProductTourProgress(value: string | null): ProductTourProgress | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<ProductTourProgress>
    if (
      parsed.version !== PRODUCT_TOUR_VERSION ||
      !["active", "paused", "completed"].includes(parsed.status ?? "") ||
      typeof parsed.stepIndex !== "number"
    ) {
      return null
    }

    return {
      version: PRODUCT_TOUR_VERSION,
      status: parsed.status as ProductTourStatus,
      stepIndex: clampTourStep(parsed.stepIndex),
    }
  } catch {
    return null
  }
}

export function nextTourProgress(
  progress: ProductTourProgress,
  direction: 1 | -1,
): ProductTourProgress {
  return {
    ...progress,
    status: "active",
    stepIndex: clampTourStep(progress.stepIndex + direction),
  }
}

// Integration adapter: replace these browser-storage functions with the shared,
// durable onboarding/tour adapter when that foundation lands. No onboarding
// checklist milestone reads from this state.
export function productTourStorageKey(userId: string): string {
  return `ipn_product_tour_v${PRODUCT_TOUR_VERSION}_${userId}`
}
