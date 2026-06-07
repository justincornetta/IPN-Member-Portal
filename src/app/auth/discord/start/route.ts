import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
const DISCORD_STATE_COOKIE = "ipn_discord_oauth_state"
const DISCORD_STATE_COOKIE_MAX_AGE = 10 * 60

type DiscordOAuthState = {
  state: string
  next: string
}

function normalizeSiteUrl(url: string): string {
  const withProtocol = url.startsWith("http") ? url : `https://${url}`
  return withProtocol.replace(/\/$/, "")
}

function getSiteUrl(request: Request): string {
  const fallbackOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const requestUrl = new URL(request.url)
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const forwardedProtocol =
    request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "")

  if (!forwardedHost) return normalizeSiteUrl(fallbackOrigin)
  return normalizeSiteUrl(`${forwardedProtocol}://${forwardedHost}`)
}

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/profile"
  }

  return value
}

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${getSiteUrl(request)}/dashboard/profile?discord=missing_config`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${getSiteUrl(request)}/login`)
  }

  const siteUrl = getSiteUrl(request)
  const requestUrl = new URL(request.url)
  const redirectUri = `${siteUrl}/auth/discord/callback`
  const state = crypto.randomUUID()
  const next = safeNextPath(requestUrl.searchParams.get("next"))
  const scopes = ["identify"]

  if (process.env.DISCORD_GUILD_ID && process.env.DISCORD_BOT_TOKEN) {
    scopes.push("guilds.join")
  }

  const cookieStore = await cookies()
  const stateCookie: DiscordOAuthState = { state, next }
  cookieStore.set(`${DISCORD_STATE_COOKIE}.${state}`, JSON.stringify(stateCookie), {
    httpOnly: true,
    maxAge: DISCORD_STATE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: siteUrl.startsWith("https://"),
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    state,
  })

  return NextResponse.redirect(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`)
}
