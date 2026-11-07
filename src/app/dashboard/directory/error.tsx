"use client"
import PageLoadError from "@/components/navigation/PageLoadError"
export default function Error({ reset }: { reset: () => void }) {
  return <PageLoadError title="Unable to load" reset={reset} />
}
