import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DISCORD_INVITE_URL = "https://discord.gg/YDdMGNF7X5"

type DiscordTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

type DiscordUserResponse = {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
}

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

function sanitizeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/profile"
  }
  return value
}

function redirectWithStatus(origin: string, next: string, status: string) {
  const url = new URL(sanitizeNext(next), origin)
  url.searchParams.set("discord", status)
  return NextResponse.redirect(url)
}

function avatarUrl(user: DiscordUserResponse): string | null {
  if (!user.avatar) return null
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
}

async function addDiscordGuildMember(discordUserId: string, accessToken: string) {
  const guildId = process.env.DISCORD_GUILD_ID
  const botToken = process.env.DISCORD_BOT_TOKEN

  if (!guildId || !botToken) return { status: "not_configured" as const }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    },
  )

  if (response.status === 201) return { status: "joined" as const }
  if (response.status === 204) return { status: "already_member" as const }

  return { status: "join_failed" as const }
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const siteUrl = getSiteUrl(request, origin)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const cookieStore = await cookies()
  const savedState = cookieStore.get("ipn_discord_oauth_state")?.value
  const next = sanitizeNext(cookieStore.get("ipn_discord_oauth_next")?.value)
  cookieStore.delete("ipn_discord_oauth_state")
  cookieStore.delete("ipn_discord_oauth_next")

  if (!code || !state || !savedState || state !== savedState) {
    return redirectWithStatus(siteUrl, next, "state_error")
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return redirectWithStatus(siteUrl, next, "missing_config")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${siteUrl}/login`)

  const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${siteUrl}/auth/discord/callback`,
    }),
  })

  if (!tokenResponse.ok) return redirectWithStatus(siteUrl, next, "token_error")
  const token = (await tokenResponse.json()) as DiscordTokenResponse

  const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `${token.token_type} ${token.access_token}` },
  })

  if (!userResponse.ok) return redirectWithStatus(siteUrl, next, "user_error")
  const discordUser = (await userResponse.json()) as DiscordUserResponse
  const join = await addDiscordGuildMember(discordUser.id, token.access_token)

  const { error } = await supabase
    .from("profiles")
    .update({
      discord_user_id: discordUser.id,
      discord_username: discordUser.username,
      discord_global_name: discordUser.global_name,
      discord_avatar_url: avatarUrl(discordUser),
      discord_connected_at: new Date().toISOString(),
      discord_server_status: join.status,
      discord_server_joined_at:
        join.status === "joined" || join.status === "already_member"
          ? new Date().toISOString()
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) return redirectWithStatus(siteUrl, next, "save_error")

  return NextResponse.redirect(DISCORD_INVITE_URL)
}
