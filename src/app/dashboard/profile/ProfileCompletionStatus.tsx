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

  return (
    <section
      aria-labelledby="profile-completion-heading"
      className="overflow-hidden rounded-2xl border border-[#E0D4F0] bg-[#FAF7FF]"
    >
      <div className="border-b border-[#E0D4F0] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="profile-completion-heading" className="text-base font-semibold text-[#1A1034]">
              {isComplete ? "Your profile is complete" : "Complete your profile"}
            </h2>
            <p className="mt-1 max-w-lg text-sm leading-6 text-[#6E6287]">
              {isComplete
                ? "These essentials help members recognize you and find common ground."
                : "Add the essentials that help other members recognize you and connect."}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-[#5C2D91]" aria-live="polite">
            {completedCount} of {totalCount} complete
          </p>
        </div>
        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#DED6E8]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={completedCount}
          aria-label={`${completedCount} of ${totalCount} profile essentials complete`}
        >
          <div
            className="h-full rounded-full bg-[#5C2D91] transition-[width] motion-reduce:transition-none"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-1 divide-y divide-[#E0D4F0] sm:grid-cols-2 sm:divide-y-0">
        {items.map((item, index) => (
          <li
            key={item.field}
            className={`flex min-h-16 items-center gap-3 px-5 py-3 sm:px-6 ${
              index > 1 ? "sm:border-t sm:border-[#E0D4F0]" : ""
            } ${index % 2 === 1 ? "sm:border-l sm:border-[#E0D4F0]" : ""}`}
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
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#1A1034]">{item.label}</p>
              {item.complete ? (
                <p className="text-xs text-[#6E6287]">Complete</p>
              ) : (
                <button
                  type="button"
                  onClick={() => onFocusField(item.field)}
                  className="-ml-1 min-h-11 rounded-md px-1 text-left text-xs font-semibold text-[#5C2D91] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C2D91] focus-visible:ring-offset-2"
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
