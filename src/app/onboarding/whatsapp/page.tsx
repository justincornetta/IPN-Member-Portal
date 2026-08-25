import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Connect on WhatsApp | IPN Member Portal",
  description: "Choose the IPN WhatsApp conversations that fit you.",
}

export default function WhatsAppPage() {
  redirect("/dashboard/whatsapp")
}
