import {
  api,
  bootstrap,
  readJson,
  submit,
  retry,
  resetDemo,
  importBank
} from "@/lib/leadership-workflows/server"
import { object, WorkflowError } from "@/lib/leadership-workflows/domain"
export async function GET(request: Request) {
  return api(request, bootstrap)
}
export async function POST(request: Request) {
  return api(request, async (c) => {
    const body = object(await readJson(request))
    if (body.action === "retry") {
      await retry(c)
      return { saved: true }
    }
    if (body.action === "reset_demo") {
      await resetDemo(c)
      return { saved: true }
    }
    if (body.action === "import_bank") return importBank(c, body)
    if (body.action && body.action !== "submit")
      throw new WorkflowError("Unknown workflow action.")
    return submit(c, body)
  })
}
