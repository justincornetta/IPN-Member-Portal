import { api, change, readJson } from "@/lib/leadership-workflows/server"
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return api(request, (c) =>
    readJson(request).then((body) => change(c, id, body))
  )
}
