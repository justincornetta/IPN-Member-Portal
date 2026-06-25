"use client"

import { useState, useRef, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import icon from "../../../assets/purple_icon.png"
import { sendPasswordResetEmail } from "@/lib/auth/actions"
import NeuralBackground from "@/components/NeuralBackground"

function ForgotPasswordCard() {
  const searchParams = useSearchParams()
  const expired = searchParams.get("expired") === "1"
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const email = (new FormData(e.currentTarget).get("email") as string).trim()
    const result = await sendPasswordResetEmail(email)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-16">
      <NeuralBackground avoidRef={cardRef} />
      <div ref={cardRef} className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-5 py-8 shadow-xl sm:px-8 sm:py-10">
        <div className="mb-8 text-center">
          <div className="mb-5 flex flex-col items-center gap-2">
            <Image src={icon} alt="IPN" height={40} width={40} className="h-10 w-auto" />
            <p className="text-sm font-semibold text-ipn">Intercollegiate Psychedelics Network</p>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Reset your password</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {expired
              ? "Your reset link has expired. Enter your email to get a new one."
              : "Enter your email and we’ll send you a reset link."}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-sm text-zinc-600">
              Check your inbox. A reset link is on its way. It may take a minute to arrive.
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center text-sm font-medium text-ipn hover:underline sm:min-h-0"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="text-sm font-medium text-zinc-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center font-medium text-ipn hover:underline sm:min-h-0"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordCard />
    </Suspense>
  )
}
