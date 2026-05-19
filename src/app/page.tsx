"use client"

import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import logo from "../../assets/purple_full.png"
import NeuralBackground from "@/components/NeuralBackground"

const FEATURES = [
  {
    label: "Member Directory",
    description: "Find researchers, students, and professionals by school, field, and location.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    label: "Events",
    description: "Discover and register for workshops, conferences, and community webinars.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Resources",
    description: "Access curated research, video content, and community-vetted reading lists.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
]

export default function Home() {
  const cardRef = useRef<HTMLElement>(null)

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 font-sans">
      <NeuralBackground avoidRef={cardRef} />

      <main ref={cardRef} className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-10 text-center rounded-2xl border border-zinc-200 bg-white px-8 py-12 shadow-xl">

        {/* Identity */}
        <div className="flex flex-col items-center gap-4">
          <Image src={logo} alt="IPN" height={48} width={220} className="h-12 w-auto" />
          <div className="flex flex-col gap-2">
            <h1 className="text-5xl font-semibold tracking-tight text-zinc-900">
              Member Portal
            </h1>
            <p className="mx-auto max-w-md text-lg leading-relaxed text-zinc-500">
              A unified home for IPN&apos;s growing community of students,
              researchers, and professionals.
            </p>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white/70 p-4 text-left backdrop-blur-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ipn-light text-ipn">
                {f.icon}
              </div>
              <p className="text-sm font-semibold text-zinc-800">{f.label}</p>
              <p className="text-xs leading-relaxed text-zinc-500">{f.description}</p>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-ipn px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-ipn-dark"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-300 bg-white/80 px-6 py-2.5 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur-sm transition hover:bg-zinc-50"
            >
              Sign in
            </Link>
          </div>

        </div>

      </main>
    </div>
  )
}
