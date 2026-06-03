import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DISCORD_API_URL = "https://discord.com/api/v10"
const DISCORD_INVITE_URL = "https://discord.gg/YDdMGNF7X5"
const DISCORD_STATE_COOKIE = "ipn_discord_oauth_state"

type DiscordTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

type DiscordUser = {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
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

function discordAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null
  const extension = user.avatar.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`
}

function profileRedirect(request: Request, status: string) {
  return NextResponse.redirect(`${getSiteUrl(request)}/dashboard/profile?discord=${status}`)
}

async function exchangeCodeForToken(
  request: Request,
  code: string,
): Promise<DiscordTokenResponse | null> {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const response = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${getSiteUrl(request)}/auth/discord/callback`,
    }),
  })

  if (!response.ok) return null
  return response.json()
}

async function fetchDiscordUser(token: DiscordTokenResponse): Promise<DiscordUser | null> {
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: { Authorization: `${token.token_type} ${token.access_token}` },
  })

  if (!response.ok) return null
  return response.json()
}

async function joinDiscordServer(
  discordUserId: string,
  accessToken: string,
): Promise<"joined" | "skipped" | "failed"> {
  const guildId = process.env.DISCORD_GUILD_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!guildId || !botToken) return "skipped"

  const response = await fetch(`${DISCORD_API_URL}/guilds/${guildId}/members/${discordUserId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: accessToken }),
  })

  if (response.ok) return "joined"
  return "failed"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(DISCORD_STATE_COOKIE)?.value
  cookieStore.delete(DISCORD_STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    return profileRedirect(request, "invalid_state")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return profileRedirect(request, "not_authenticated")

  const token = await exchangeCodeForToken(request, code)
  if (!token) return profileRedirect(request, "token_error")

  const discordUser = await fetchDiscordUser(token)
  if (!discordUser) return profileRedirect(request, "user_error")

  const serverStatus = await joinDiscordServer(discordUser.id, token.access_token)
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("profiles")
    .update({
      discord_user_id: discordUser.id,
      discord_username: discordUser.username,
      discord_global_name: discordUser.global_name,
      discord_avatar_url: discordAvatarUrl(discordUser),
      discord_connected_at: now,
      discord_server_status: serverStatus,
      discord_server_joined_at: serverStatus === "joined" ? now : null,
      updated_at: now,
    })
    .eq("id", user.id)

  if (error) return profileRedirect(request, "save_error")

  return NextResponse.redirect(DISCORD_INVITE_URL)
}
