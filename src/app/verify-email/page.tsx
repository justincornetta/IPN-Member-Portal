import Image from "next/image"
import icon from "../../../assets/IPN Icon.webp"

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <Image src={icon} alt="IPN" width={48} height={48} />
        </div>
        <h1 className="text-xl font-semibold text-zinc-900">Check your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          We sent a confirmation link to your email address. Click it to
          activate your account and access the portal.
        </p>
        <p className="mt-4 text-xs text-zinc-400">
          Didn&apos;t receive it? Check your spam folder, or{" "}
          <a href="/register" className="text-ipn hover:underline">
            try again
          </a>
          .
        </p>
      </div>
    </div>
  )
}
