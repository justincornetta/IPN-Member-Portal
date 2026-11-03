import RegistrationForm from "./RegistrationForm"
import { guestDemoEnabled } from "@/lib/guest-events/demo"

export default function RegisterPage() {
  return <RegistrationForm preview={guestDemoEnabled()}/>
}
