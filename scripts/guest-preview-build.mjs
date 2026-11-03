import {writeFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {resolve} from "node:path"

export function guestPreviewBuild(env) {
  const enabled=env.CONTEXT==="deploy-preview" && env.REVIEW_ID==="70" && env.BRANCH==="feature/guest-event-rsvp"
  return {enabled,origin:enabled ? env.DEPLOY_PRIME_URL || "https://deploy-preview-70--ipn-member-portal.netlify.app" : ""}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  // A literal module survives both Next compilation and Netlify function packaging.
  // The committed fallback is disabled; every build regenerates it for its context.
  writeFileSync(new URL("../src/lib/guest-events/preview-build.json",import.meta.url),JSON.stringify(guestPreviewBuild(process.env),null,2)+"\n")
}
