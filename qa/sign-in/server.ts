import { cookies } from "next/headers"
import { AuthApiError, AuthSessionMissingError } from "@supabase/supabase-js"
import { makeClient, sampleData, previewUser } from "../performance/fixtures/data"
import { record } from "./state"

export async function createClient() {
  const jar = await cookies()
  const data = sampleData()
  const role = jar.get("qa-sign-in-role")?.value
  const profile = data.profiles.find(row => row.id === previewUser.id)!
  profile.role = role === "admin" ? "admin" : "member"
  const user = { ...previewUser, aud:"authenticated", app_metadata:{}, created_at:"2026-11-01T00:00:00Z" }
  const client = makeClient(data, {latencyMs:100})
  client.auth.getUser = async () => role
    ? {data:{user},error:null}
    : {data:{user:null},error:new AuthSessionMissingError()}
  client.auth.signInWithPassword = async (credentials) => {
    record("auth-start")
    await new Promise(resolve => setTimeout(resolve,150))
    if (!("email" in credentials) || credentials.password !== "preview-password") {
      record("auth-error")
      return {data:{user:null,session:null},error:new AuthApiError("Invalid login credentials",400,"invalid_credentials")}
    }
    jar.set("qa-sign-in-role",credentials.email === "admin@example.test" ? "admin" : "member",{httpOnly:true,path:"/",sameSite:"lax"})
    record("auth-complete")
    return {data:{user,session:{access_token:"qa-only",refresh_token:"qa-only",expires_in:3600,token_type:"bearer",user}},error:null}
  }
  client.auth.signOut = async () => { jar.delete("qa-sign-in-role");return {error:null} }
  return client
}
export function createAdminClient(): ReturnType<typeof makeClient> { throw new Error("Live admin access is disabled in sign-in QA") }
