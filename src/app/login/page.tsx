"use client"

import { useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import icon from "../../../assets/purple_icon.png"
import { signIn } from "@/lib/auth/actions"
import NeuralBackground from "@/components/NeuralBackground"

function LoginCard() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? ""
  const urlError = searchParams.get("error")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await signIn(
      fd.get("email") as string,
      fd.get("password") as string,
      next || undefined,
    )
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <NeuralBackground avoidRef={cardRef} />
      <div ref={cardRef} className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mb-5 flex flex-col items-center gap-2">
            <Image src={icon} alt="IPN" height={40} width={40} className="h-10 w-auto" />
            <p className="text-sm font-semibold text-ipn">Intercollegiate Psychedelics Network</p>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-zinc-400 transition hover:text-ipn">
                Forgot password?
              </Link>
            </div>
          </div>

          {(error || urlError) && (
            <p className="text-sm text-red-600">{error ?? urlError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in…
              </>
            ) : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-medium text-ipn hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  )
}
