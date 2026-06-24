const CONTACT_EMAIL = "info@intercollegiatepsychedelics.net"

export default function BannedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-zinc-900">Account suspended</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Your account has been suspended by an IPN administrator. If you believe this is a mistake, please reach out to us at
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-2 inline-block text-sm font-medium text-ipn hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </div>
  )
}
