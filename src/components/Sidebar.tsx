"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import icon from "../../assets/purple_icon.png"
import { signOut } from "@/lib/auth/actions"

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/directory",
    label: "Directory",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/events",
    label: "Events",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/resources",
    label: "Resources",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: "/dashboard/community",
    label: "Community",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
]

const CONFERENCES_NAV_ITEM = {
  href: "/dashboard/conferences",
  label: "Conferences",
  icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
}

type Props = {
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl: string | null
  pendingRequestCount: number
  isAdmin: boolean
}

function AvatarCircle({
  avatarUrl,
  initials,
  size = "sm",
}: {
  avatarUrl: string | null
  initials: string
  size?: "sm" | "md"
}) {
  const cls = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"
  return (
    <div className={`${cls} flex-shrink-0 overflow-hidden rounded-full`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  )
}

// Shared nav links + user footer — used inside both desktop aside and mobile drawer
function NavContent({
  pathname,
  displayName,
  initials,
  avatarUrl,
  pendingRequestCount,
  isAdmin,
  onClose,
}: {
  pathname: string
  displayName: string
  initials: string
  avatarUrl: string | null
  pendingRequestCount: number
  isAdmin: boolean
  onClose?: () => void
}) {
  const profileActive = pathname === "/dashboard/profile"

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV.map((item) => {
          const active = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.href || pathname.startsWith(item.href + "/")
          const isCommunity = item.href === "/dashboard/community"
          return (
            <Fragment key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-ipn-light font-medium text-ipn"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span className={active ? "text-ipn" : "text-zinc-400"}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {isCommunity && pendingRequestCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                  </span>
                )}
              </Link>
              {item.href === "/dashboard/events" && isAdmin && (() => {
                const conferencesActive =
                  pathname === "/dashboard/conferences" || pathname.startsWith("/dashboard/conferences/")
                return (
                  <Link
                    href={CONFERENCES_NAV_ITEM.href}
                    onClick={onClose}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      conferencesActive
                        ? "bg-ipn-light font-medium text-ipn"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <span className={conferencesActive ? "text-ipn" : "text-zinc-400"}>
                      {CONFERENCES_NAV_ITEM.icon}
                    </span>
                    <span className="flex-1">{CONFERENCES_NAV_ITEM.label}</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                      Beta
                    </span>
                  </Link>
                )
              })()}
            </Fragment>
          )
        })}

        <div className="my-2 border-t border-zinc-100" />

        <Link
          href="/dashboard/profile"
          onClick={onClose}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            profileActive
              ? "bg-ipn-light font-medium text-ipn"
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          }`}
        >
          <span className={profileActive ? "text-ipn" : "text-zinc-400"}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </span>
          Profile
        </Link>

        {isAdmin && (() => {
          const adminActive = pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/")
          return (
            <Link
            href="/dashboard/admin"
            onClick={onClose}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                adminActive
                  ? "bg-ipn-light font-medium text-ipn"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <span className={adminActive ? "text-ipn" : "text-zinc-400"}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </span>
              Admin
            </Link>
          )
        })()}

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new Event("ipn:open-feedback"))
            onClose?.()
          }}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          <span className="text-zinc-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75m-6.75 3h4.5m8.625-.75c0 4.142-4.03 7.5-9 7.5a10.6 10.6 0 0 1-3.45-.566L3 20.25l1.316-3.95A6.9 6.9 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z" />
            </svg>
          </span>
          Feedback
        </button>
      </nav>

      <div className="border-t border-zinc-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/profile"
            onClick={onClose}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded transition hover:opacity-75"
          >
            <AvatarCircle avatarUrl={avatarUrl} initials={initials} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-800">{displayName}</p>
            </div>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              title="Sign out"
              className="ml-2 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default function Sidebar({ firstName, lastName, email, avatarUrl, pendingRequestCount, isAdmin }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const displayName = firstName ? `${firstName} ${lastName ?? ""}`.trim() : email
  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ""}`.toUpperCase()
    : email[0].toUpperCase()

  const sharedProps = { pathname, displayName, initials, avatarUrl, pendingRequestCount, isAdmin }

  return (
    <>
      {/* ── Mobile: top header bar ───────────────────── */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <Link href="/dashboard" className="inline-flex items-center justify-center rounded-lg">
          <Image src={icon} alt="IPN" width={28} height={28} />
        </Link>

        <Link href="/dashboard/profile" className="inline-flex h-11 w-11 items-center justify-center rounded-lg">
          <AvatarCircle avatarUrl={avatarUrl} initials={initials} />
        </Link>
      </header>

      {/* ── Desktop: sidebar ─────────────────────────── */}
      <aside className="hidden md:flex md:w-56 md:flex-shrink-0 md:flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4">
          <Image src={icon} alt="IPN" width={28} height={28} />
          <span className="text-sm font-semibold text-zinc-800">Member Portal</span>
        </div>
        <NavContent {...sharedProps} />
      </aside>

      {/* ── Mobile: slide-in drawer overlay ──────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Image src={icon} alt="IPN" width={28} height={28} />
                <span className="text-sm font-semibold text-zinc-800">Member Portal</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavContent {...sharedProps} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-2 pt-1 shadow-[0_-10px_30px_rgba(24,24,27,0.08)] backdrop-blur md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {NAV.map((item) => {
            const active = item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(item.href + "/")
            const isCommunity = item.href === "/dashboard/community"

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 text-[10px] font-medium leading-none transition min-[380px]:text-[11px] ${
                  active
                    ? "bg-ipn-light text-ipn"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span className={active ? "text-ipn" : "text-zinc-400"}>{item.icon}</span>
                <span className="max-w-full truncate">{item.label}</span>
                {isCommunity && pendingRequestCount > 0 && (
                  <span className="absolute right-3 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                    {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
