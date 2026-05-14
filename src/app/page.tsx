import Link from "next/link"
import Image from "next/image"
import icon from "../../assets/IPN Icon.webp"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Image src={icon} alt="IPN" width={56} height={56} />
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Intercollegiate Psychedelics Network
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Member Portal
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-zinc-600">
            A home for community discovery, events, and resources.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-ipn px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ipn-dark"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  )
}
