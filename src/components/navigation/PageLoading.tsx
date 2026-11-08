export default function PageLoading({ title = "Loading page", kind = "page" }: {
  title?: string
  kind?: "page" | "community" | "events"
}) {
  return (
    <section aria-busy="true" aria-label={title} className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <p role="status" className="mt-2 text-sm text-zinc-500">Loading, please wait…</p>
      <div aria-hidden="true" className="mt-6 motion-safe:animate-pulse">
        {kind === "community" && <div className="mb-6 h-11 max-w-xl rounded-lg bg-zinc-200/70" />}
        <div className={`grid gap-4 ${kind === "community" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {Array.from({ length: kind === "community" ? 6 : 4 }, (_, index) => (
            <div key={index} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="h-10 w-10 rounded-full bg-zinc-100" />
              <div className="mt-4 h-4 w-3/4 rounded bg-zinc-200/70" />
              <div className="mt-3 h-3 w-1/2 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
