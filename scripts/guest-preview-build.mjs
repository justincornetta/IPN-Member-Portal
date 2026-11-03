import {writeFileSync} from "node:fs"
import {fileURLToPath} from "node:url"
import {resolve} from "node:path"

export function guestPreviewBuild(env) {
  // Netlify checks out pull/70/head, not necessarily the feature branch name.
  const previewIdMatches=env.REVIEW_ID==="70" || (!env.REVIEW_ID && env.DEPLOY_PRIME_URL==="https://deploy-preview-70--ipn-member-portal.netlify.app")
  const enabled=env.CONTEXT==="deploy-preview" && previewIdMatches
  return {enabled,origin:enabled ? env.DEPLOY_PRIME_URL || "https://deploy-preview-70--ipn-member-portal.netlify.app" : ""}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  // A literal module survives both Next compilation and Netlify function packaging.
  // The committed fallback is disabled; every build regenerates it for its context.
  const build=guestPreviewBuild(process.env)
  writeFileSync(new URL("../src/lib/guest-events/preview-build.json",import.meta.url),JSON.stringify(build,null,2)+"\n")
  console.info("[guest-preview]",JSON.stringify({enabled:build.enabled,context:process.env.CONTEXT??"local",reviewId:process.env.REVIEW_ID??null,branch:process.env.BRANCH??null}))
}
