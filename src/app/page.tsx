/**
 * Landing page placeholder.
 *
 * This is the v0.0 of the IPN Member Portal — just a "we're building this"
 * splash. Replaced once we have real auth + a directory + events to show.
 *
 * The Supabase env-var smoke check below confirms the deploy environment
 * has the right keys wired up. Remove once we have a real signed-in flow
 * that exercises Supabase end-to-end.
 */

const supabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "PASTE_YOUR_ANON_KEY_HERE"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Intercollegiate Psychedelics Network
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            Member Portal
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            We&apos;re building a home for community discovery, events, and
            resources. Launching summer 2026.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
              supabaseConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                supabaseConfigured ? "bg-emerald-500" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            {supabaseConfigured
              ? "Supabase configured"
              : "Supabase not yet configured"}
          </span>
          <p className="text-xs">
            Build status indicator. Will be removed before launch.
          </p>
        </div>
      </main>

      <footer className="mt-16 text-xs text-zinc-400 dark:text-zinc-600">
        intercollegiatepsychedelics.net
      </footer>
    </div>
  )
}
