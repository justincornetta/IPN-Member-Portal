"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

export default function PageLoadError({ title, reset }: { title: string; reset?: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const retry = () => startTransition(() => {
    if (reset) reset()
    else router.refresh()
  })
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <div role="alert" className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <p className="font-medium text-zinc-900">We couldn’t load this page.</p>
        <p className="mt-2 text-sm text-zinc-600">Please try again. You can also open another page from the navigation.</p>
        <button type="button" onClick={retry} disabled={pending} className="mt-4 min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white hover:bg-ipn/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn">{pending ? "Trying again…" : "Try again"}</button>
      </div>
    </section>
  )
}
