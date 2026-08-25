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

export function productTourProgressFromServer(input: {
  startedAt: string | null
  currentStep: string | null
  completedAt: string | null
}): ProductTourProgress | null {
  if (input.completedAt) {
    return {
      version: PRODUCT_TOUR_VERSION,
      status: "completed",
      stepIndex: PRODUCT_TOUR_STEPS.length - 1,
    }
  }
  if (!input.startedAt) return null

  const match = input.currentStep?.match(/^(active|paused)_(.+)$/)
  const stepIndex = match
    ? PRODUCT_TOUR_STEPS.findIndex((step) => step.id === match[2])
    : 0
  return {
    version: PRODUCT_TOUR_VERSION,
    status: match?.[1] === "active" ? "active" : "paused",
    stepIndex: stepIndex >= 0 ? stepIndex : 0,
  }
}

export function productTourServerStep(progress: ProductTourProgress): string {
  if (progress.status === "completed") return "complete"
  return `${progress.status}_${PRODUCT_TOUR_STEPS[progress.stepIndex].id}`
}

// Browser storage is a resilience fallback only when durable server progress
// cannot be read or written. It is never the primary product-tour truth.
export function productTourStorageKey(userId: string): string {
  return `ipn_product_tour_v${PRODUCT_TOUR_VERSION}_${userId}`
}
