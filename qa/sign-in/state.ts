type Entry = {event:string;at:number}
const scope = globalThis as typeof globalThis & {signInQaEvents?:Entry[]}
export function entries() { return scope.signInQaEvents ??= [] }
export function record(event:string) { entries().push({event,at:Date.now()}) }
export function reset() { scope.signInQaEvents=[] }
export async function recordFixtureAnalytics(eventName:string) {
  record(`${eventName}-start`)
  await new Promise(resolve=>setTimeout(resolve,1000))
  record(`${eventName}-complete`)
}
