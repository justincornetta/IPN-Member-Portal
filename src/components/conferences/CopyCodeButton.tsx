"use client"

import { useState } from "react"

export default function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard API unavailable — no-op, code is still visible to select/copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs font-medium text-zinc-700 transition hover:border-ipn/30 hover:bg-ipn/5 sm:min-h-0"
    >
      {code}
      <span className={copied ? "text-ipn" : "text-zinc-400"}>
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  )
}
