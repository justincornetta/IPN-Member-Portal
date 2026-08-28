import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  LEADERSHIP_TEAMS,
  isLeadershipTeam,
  isPortalAdminRole,
  roleAfterLeadershipAssignment,
} from "../src/lib/admin/leadership.ts"

const ADMIN_ACTIONS_SOURCE = readFileSync(
  new URL("../src/lib/admin/actions.ts", import.meta.url),
  "utf8",
)

function exportedFunctionSource(name, nextName) {
  const start = ADMIN_ACTIONS_SOURCE.indexOf(`export async function ${name}`)
  const end = ADMIN_ACTIONS_SOURCE.indexOf(`export async function ${nextName}`, start)
  assert.notEqual(start, -1, `${name} must remain an exported server action`)
  assert.notEqual(end, -1, `${nextName} must follow ${name}`)
  return ADMIN_ACTIONS_SOURCE.slice(start, end)
}

test("admins can search leadership while only superadmins can assign access", () => {
  assert.equal(isPortalAdminRole("admin"), true)
  assert.equal(isPortalAdminRole("superadmin"), true)
  assert.equal(isPortalAdminRole(null), false)
  assert.equal(isPortalAdminRole("member"), false)

  const searchSource = exportedFunctionSource("searchMembersForAdmin", "getMemberDetail")
  const assignmentSource = exportedFunctionSource("assignAdminAccess", "publishAdminContent")
  assert.match(searchSource, /await verifyAdmin\(\)/)
  assert.doesNotMatch(searchSource, /verifySuperadmin(?:User)?\(\)/)
  assert.match(assignmentSource, /await verifySuperadminUser\(\)/)
  assert.doesNotMatch(assignmentSource, /await verifyAdmin\(\)/)
})

test("leadership assignments use the database's canonical team names", () => {
  assert.deepEqual(LEADERSHIP_TEAMS, [
    "Strategy and Operations",
    "Media",
    "PsychedelX",
    "Community",
    "IPN Labs",
  ])
  for (const team of LEADERSHIP_TEAMS) assert.equal(isLeadershipTeam(team), true)
  assert.equal(isLeadershipTeam("Strategy"), false)
})

test("leadership assignment promotes members without downgrading superadmins", () => {
  assert.equal(roleAfterLeadershipAssignment(null, "Director of Community", "Community"), "admin")
  assert.equal(roleAfterLeadershipAssignment(null, "Coordinator", null), "admin")
  assert.equal(roleAfterLeadershipAssignment(null, null, "Media"), "admin")
  assert.equal(roleAfterLeadershipAssignment("admin", null, null), null)
  assert.equal(roleAfterLeadershipAssignment("superadmin", null, null), "superadmin")
})
