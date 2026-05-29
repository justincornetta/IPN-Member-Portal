"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import logo from "../../../assets/purple_full.png"
import { sendPasswordResetEmail } from "@/lib/auth/actions"
import NeuralBackground from "@/components/NeuralBackground"

export default function ForgotPasswordPage() {
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
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16">
      <NeuralBackground avoidRef={cardRef} />
      <div ref={cardRef} className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <Image src={logo} alt="IPN" height={40} width={200} className="h-10 w-auto" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Reset your password</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Enter your email and we&apos;ll send you a reset link.
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
              Check your inbox — a reset link is on its way. It may take a minute to arrive.
            </p>
            <Link href="/login" className="text-sm font-medium text-ipn hover:underline">
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
                className="mt-1 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              <Link href="/login" className="font-medium text-ipn hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
