import { DataReadError } from "../data-read-error.ts"
/** Read every RLS-visible page, with stable ordering supplied by the caller. */
export async function readRows<T>(
  query: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string; code?: string } | null
  }>,
): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const result = await query(from, from + pageSize - 1)
    if (result.error) throw new DataReadError("Directory data could not be loaded", result.error.code)
    if (!result.data) throw new DataReadError("Directory data could not be loaded")
    rows.push(...result.data)
    if (result.data.length < pageSize) return rows
  }
}
