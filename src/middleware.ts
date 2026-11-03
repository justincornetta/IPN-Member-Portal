import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { hostedGuestPreview, previewEventSlug, previewPathAllowed } from "./lib/guest-events/preview-mode"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (hostedGuestPreview()) {
    if (previewPathAllowed(pathname)) {
      const response = NextResponse.next({ request })
      response.headers.set("Cache-Control", "private, no-store")
      response.headers.set("X-IPN-Preview", "isolated-rsvp")
      return response
    }
    if (request.method !== "GET" || pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Live portal actions are disabled in this test preview." }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/events/" + previewEventSlug, request.url))
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  let isAuthenticated = false
  try {
    // getUser() validates the token server-side — never use getSession() here
    const { data } = await supabase.auth.getUser()
    isAuthenticated = Boolean(data.user)
  } catch (error) {
    console.error("Unable to validate Supabase session in middleware", error)
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url)
    const destination = pathname + (request.nextUrl.search || "")
    loginUrl.searchParams.set("next", destination)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
