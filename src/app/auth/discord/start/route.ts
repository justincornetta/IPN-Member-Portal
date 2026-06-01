import { randomBytes } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

function normalizeSiteUrl(url: string): string {
  const withProtocol = url.startsWith("http") ? url : `https://${url}`
  return withProtocol.replace(/\/$/, "")
}

function getSiteUrl(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? "https"

  if (!forwardedHost) return normalizeSiteUrl(fallbackOrigin)

  return normalizeSiteUrl(`${forwardedProtocol}://${forwardedHost}`)
}

function sanitizeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/profile"
  }
  return value
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const siteUrl = getSiteUrl(request, origin)
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(`${siteUrl}/dashboard/profile?discord=missing_config`)
  }

  const next = sanitizeNext(searchParams.get("next"))
  const state = randomBytes(24).toString("hex")
  const scopes = ["identify"]
  if (process.env.DISCORD_GUILD_ID && process.env.DISCORD_BOT_TOKEN) {
    scopes.push("guilds.join")
  }
  const cookieStore = await cookies()
  cookieStore.set("ipn_discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  })
  cookieStore.set("ipn_discord_oauth_next", next, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${siteUrl}/auth/discord/callback`,
    response_type: "code",
    scope: scopes.join(" "),
    state,
  })

  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`)
}
