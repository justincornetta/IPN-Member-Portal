export function parseBankCsv(source: string) {
  if (source.length > 1_000_000) throw new Error("Use a CSV smaller than 1 MB.")
  const rows: string[][] = []
  let row: string[] = [],
    cell = "",
    quoted = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = !quoted
    } else if (c === "," && !quoted) {
      row.push(cell)
      cell = ""
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++
      row.push(cell)
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.")
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  const headers = (rows.shift() ?? []).map((h) =>
    h
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
  )
  const index = (names: string[]) => headers.findIndex((h) => names.includes(h))
  const day = index(["date", "transaction date", "posted date"]),
    description = index(["description", "merchant", "memo"]),
    amount = index(["amount", "net amount"]),
    id = index(["transaction id", "id", "reference"]),
    status = index(["status"])
  if ([day, description, amount].some((n) => n < 0))
    throw new Error(
      "Include Date, Description, and Amount columns with signed USD amounts."
    )
  const seen = new Set<string>()
  return rows
    .filter((r) => status < 0 || r[status]?.trim().toLowerCase() !== "pending")
    .map((r, i) => {
      const d = r[day]?.trim()
      let date = d
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const m = d?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (!m)
          throw new Error(`Row ${i + 2}: use YYYY-MM-DD or MM/DD/YYYY dates.`)
        date = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
      }
      const value = r[amount]?.trim().replace(/[$,]/g, "")
      if (!/^-?\d+(\.\d{1,2})?$/.test(value))
        throw new Error(
          `Row ${i + 2}: use signed USD amounts, expenses negative.`
        )
      const amountCents = Math.round(Number(value) * 100)
      const sourceId = id >= 0 ? r[id]?.trim() : ""
      const entry = {
        date,
        description: r[description]?.trim(),
        amountCents,
        sourceId
      }
      const key = JSON.stringify(
        sourceId || [date, amountCents, entry.description]
      )
      if (seen.has(key))
        throw new Error(
          "Repeated bank entries need distinct Transaction IDs so separate payments are not collapsed."
        )
      seen.add(key)
      return entry
    })
}
