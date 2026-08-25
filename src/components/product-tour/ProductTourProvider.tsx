"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { saveOnboardingFlowProgress } from "@/lib/onboarding/actions"
import {
  PRODUCT_TOUR_STEPS,
  PRODUCT_TOUR_VERSION,
  nextTourProgress,
  parseProductTourProgress,
  productTourProgressFromServer,
  productTourServerStep,
  productTourStorageKey,
  type ProductTourProgress,
} from "./tour-state"

type ProductTourContextValue = {
  ready: boolean
  progress: ProductTourProgress | null
  startOrResume: () => void
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null)

function isVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
}

function findTarget(stepId: string): HTMLElement | null {
  const targetId = stepId === "dashboard-return" ? "dashboard" : stepId
  const candidates = [
    ...document.querySelectorAll(`[data-tour-nav="${targetId}"]`),
    ...document.querySelectorAll(`[data-tour-page="${targetId}"]`),
    ...document.querySelectorAll("h1"),
  ]
  return candidates.find(isVisible) ?? null
}

export function ProductTourProvider({
  userId,
  serverProgress,
  serverStateAvailable,
  children,
}: {
  userId: string
  serverProgress: { startedAt: string | null; currentStep: string | null; completedAt: string | null }
  serverStateAvailable: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const tourWasActiveRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<ProductTourProgress | null>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  const persist = useCallback((next: ProductTourProgress) => {
    setProgress(next)
    void saveOnboardingFlowProgress({
      flow: "product_tour",
      currentStep: productTourServerStep(next),
      complete: next.status === "completed",
    }).then((result) => {
      if (result.error) {
        window.localStorage.setItem(productTourStorageKey(userId), JSON.stringify(next))
      } else {
        window.localStorage.removeItem(productTourStorageKey(userId))
      }
    }).catch(() => {
      window.localStorage.setItem(productTourStorageKey(userId), JSON.stringify(next))
    })
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const durable = productTourProgressFromServer(serverProgress)
      const storageKey = productTourStorageKey(userId)
      if (serverStateAvailable) {
        window.localStorage.removeItem(storageKey)
        setProgress(durable)
      } else {
        setProgress(parseProductTourProgress(window.localStorage.getItem(storageKey)))
      }
      setReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [serverProgress, serverStateAvailable, userId])

  const step = progress ? PRODUCT_TOUR_STEPS[progress.stepIndex] : null
  const isActive = progress?.status === "active"
  const isOnStepRoute = Boolean(step && pathname === step.route)

  const startOrResume = useCallback(() => {
    const next: ProductTourProgress = {
      version: PRODUCT_TOUR_VERSION,
      status: "active",
      stepIndex: progress?.status === "completed" ? 0 : progress?.stepIndex ?? 0,
    }
    persist(next)
    router.push(PRODUCT_TOUR_STEPS[next.stepIndex].route)
  }, [persist, progress, router])

  const move = useCallback((direction: 1 | -1) => {
    if (!progress) return
    const next = nextTourProgress(progress, direction)
    persist(next)
    router.push(PRODUCT_TOUR_STEPS[next.stepIndex].route)
  }, [persist, progress, router])

  const pause = useCallback(() => {
    if (!progress) return
    persist({ ...progress, status: "paused" })
  }, [persist, progress])

  const complete = useCallback(() => {
    if (!progress) return
    persist({ ...progress, status: "completed" })
  }, [persist, progress])

  useEffect(() => {
    if (!isActive || !isOnStepRoute || !step) return

    let frame = 0
    const updateTarget = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const target = findTarget(step.id)
        setTargetRect(target?.getBoundingClientRect() ?? null)
      })
    }

    updateTarget()
    window.addEventListener("resize", updateTarget)
    window.addEventListener("scroll", updateTarget, true)
    const timer = window.setTimeout(updateTarget, 250)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener("resize", updateTarget)
      window.removeEventListener("scroll", updateTarget, true)
    }
  }, [isActive, isOnStepRoute, pathname, step])

  const restoreTourFocus = useCallback(() => {
    const original = returnFocusRef.current
    const fallback = document.querySelector<HTMLElement>("[data-tour-launcher]")
      ?? document.querySelector<HTMLElement>("h1")
    const target = original?.isConnected ? original : fallback
    if (target && !target.matches("button, [href], input, select, textarea, [tabindex]")) {
      target.tabIndex = -1
    }
    target?.focus({ preventScroll: true })
    returnFocusRef.current = null
  }, [])

  useEffect(() => {
    if (isActive && !tourWasActiveRef.current) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    }
    if (!isActive && tourWasActiveRef.current) restoreTourFocus()
    tourWasActiveRef.current = isActive
  }, [isActive, restoreTourFocus])

  useEffect(() => {
    if (isActive && isOnStepRoute) cardRef.current?.focus({ preventScroll: true })
  }, [isActive, isOnStepRoute, progress?.stepIndex])

  useEffect(() => () => {
    if (tourWasActiveRef.current) restoreTourFocus()
  }, [restoreTourFocus])

  useEffect(() => {
    if (!isActive || !isOnStepRoute) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditable = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable
      if (event.key === "Escape") {
        event.preventDefault()
        pause()
        return
      }
      if (isEditable) return
      if (event.key === "ArrowRight") {
        event.preventDefault()
        if (progress.stepIndex === PRODUCT_TOUR_STEPS.length - 1) complete()
        else move(1)
      }
      if (event.key === "ArrowLeft" && progress.stepIndex > 0) {
        event.preventDefault()
        move(-1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [complete, isActive, isOnStepRoute, move, pause, progress])

  const cardStyle = useMemo<CSSProperties>(() => {
    if (!targetRect || typeof window === "undefined" || window.innerWidth < 768) return {}
    const width = 336
    const left = targetRect.right + width + 32 < window.innerWidth
      ? targetRect.right + 16
      : Math.max(16, targetRect.left - width - 16)
    return {
      left,
      top: Math.max(16, Math.min(targetRect.top, window.innerHeight - 280)),
      width,
    }
  }, [targetRect])

  const contextValue = useMemo(() => ({ ready, progress, startOrResume }), [ready, progress, startOrResume])

  return (
    <ProductTourContext.Provider value={contextValue}>
      {children}

      {isActive && !isOnStepRoute && (
        <button
          type="button"
          data-tour-launcher
          onClick={startOrResume}
          className="fixed bottom-24 right-4 z-[60] rounded-full border border-ipn/25 bg-white px-4 py-2 text-sm font-semibold text-ipn shadow-lg transition hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn md:bottom-6"
        >
          Resume portal tour
        </button>
      )}

      {isActive && isOnStepRoute && step && (
        <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
          {targetRect && (
            <div
              className="fixed rounded-xl border-2 border-ipn shadow-[0_0_0_5px_rgba(102,79,161,0.14)] motion-safe:transition-all motion-reduce:transition-none"
              style={{
                left: targetRect.left - 5,
                top: targetRect.top - 5,
                width: targetRect.width + 10,
                height: targetRect.height + 10,
              }}
              aria-hidden="true"
            />
          )}

          <div
            ref={cardRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="product-tour-title"
            tabIndex={-1}
            style={cardStyle}
            className="pointer-events-auto fixed inset-x-3 bottom-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-ipn/20 bg-white p-4 shadow-2xl outline-none motion-safe:transition-all motion-reduce:transition-none md:inset-x-auto md:bottom-auto md:max-h-[min(32rem,calc(100dvh-2rem))] md:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ipn">
                  Portal tour · {progress.stepIndex + 1} of {PRODUCT_TOUR_STEPS.length}
                </p>
                <h2 id="product-tour-title" className="mt-1 text-lg font-semibold text-[#1A1034]">
                  {step.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={pause}
                className="-mr-2 -mt-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-ipn"
                aria-label="Pause portal tour"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{step.description}</p>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={pause}
                className="min-h-11 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-ipn"
              >
                Skip for now
              </button>
              <div className="flex gap-2">
                {progress.stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    className="min-h-11 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-ipn"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => progress.stepIndex === PRODUCT_TOUR_STEPS.length - 1 ? complete() : move(1)}
                  className="min-h-11 rounded-lg bg-ipn px-4 text-sm font-semibold text-white hover:bg-ipn-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
                >
                  {progress.stepIndex === PRODUCT_TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Use ← and → to move, or Esc to pause.</p>
          </div>
        </div>
      )}
    </ProductTourContext.Provider>
  )
}

export function useProductTour(): ProductTourContextValue {
  const value = useContext(ProductTourContext)
  if (!value) throw new Error("useProductTour must be used within ProductTourProvider")
  return value
}
