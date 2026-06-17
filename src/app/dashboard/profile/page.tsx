import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMailchimpStatus } from "@/lib/mailchimp/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import ProfileForm from "./ProfileForm"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const { data: contact } = await supabase
    .from("member_contacts")
    .select("whatsapp_url")
    .eq("user_id", user.id)
    .maybeSingle()

  const storedMailchimpStatus = profile?.mailchimp_status as MailchimpStatus | null
  const mailchimpStatus =
    storedMailchimpStatus ?? (user.email ? await getMailchimpStatus(user.email) : "unknown")

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Profile</h1>
      </div>
      <ProfileForm
        profile={profile}
        contact={contact}
        userId={user.id}
        userEmail={user.email ?? ""}
        mailchimpStatus={mailchimpStatus}
      />
    </div>
  )
}
