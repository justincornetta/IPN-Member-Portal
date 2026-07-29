import { redirect } from "next/navigation"

export default function CommunityPage() {
  redirect("/dashboard/directory?tab=connections")
}
