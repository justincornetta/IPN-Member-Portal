import type { ProfileCompletionField, ProfileCompletionItem } from "./profile-completion"

export default function ProfileCompletionStatus({
  completedCount,
  totalCount,
  items,
  onFocusField,
}: {
  completedCount: number
  totalCount: number
  items: ProfileCompletionItem[]
  onFocusField: (field: ProfileCompletionField) => void
}) {
  const isComplete = completedCount === totalCount
  const ringRadius = 25
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - completedCount / totalCount)

  return (
    <section
      aria-labelledby="profile-completion-heading"
      className="overflow-hidden rounded-2xl border border-[#E0D4F0] bg-[#FAF7FF]"
    >
      <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="min-w-0 pt-0.5">
          <h2 id="profile-completion-heading" className="text-base font-semibold text-[#1A1034]">
            {isComplete ? "Your profile is complete" : "Complete your profile"}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-[#6E6287]">
            {isComplete
              ? "These essentials help members recognize you and find common ground."
              : "Add the essentials that help other members recognize you and connect."}
          </p>
        </div>
        <div
          className="relative h-16 w-16 shrink-0"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={completedCount}
          aria-label={`${completedCount} of ${totalCount} profile essentials complete`}
          aria-live="polite"
        >
          <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={ringRadius} fill="white" stroke="#E0D4F0" strokeWidth="4" />
            <circle
              cx="32"
              cy="32"
              r={ringRadius}
              fill="none"
              stroke="#5C2D91"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              className="transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-[#1A1034]">
            {completedCount} of {totalCount}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-[#E0D4F0] border-t border-[#E0D4F0]">
        {items.map((item) => (
          <li
            key={item.field}
            className="grid min-h-13 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-1 sm:px-6"
          >
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                item.complete
                  ? "border-[#CDB9E8] bg-[#EDE5F7] text-[#5C2D91]"
                  : "border-[#CDB9E8] bg-white text-[#8A79A5]"
              }`}
            >
              {item.complete ? (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m4 10 4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <p className="min-w-0 text-sm font-medium text-[#1A1034]">{item.label}</p>
            {item.complete ? (
              <span className="text-xs font-medium text-[#6E6287]">Complete</span>
            ) : (
              <button
                type="button"
                onClick={() => onFocusField(item.field)}
                className="min-h-11 rounded-md px-1 text-right text-xs font-semibold text-[#5C2D91] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C2D91] focus-visible:ring-offset-2"
              >
                {item.actionLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
