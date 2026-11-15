import test from "node:test"
import assert from "node:assert/strict"
import {
  BUILT_IN_EXCLUDED_REQUEST_IDS,
  isExcludedRequest
} from "../src/lib/leadership-workflows/request-exclusions.ts"

const OCT6_TEST_EXPENSE_ID = "6d4e4dce-0a2a-4c08-8ea6-5cfe34e6d6ab"

test("the October 6 TEST expense is excluded even without the environment list", () => {
  const previous = process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
  try {
    delete process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
    assert.ok(BUILT_IN_EXCLUDED_REQUEST_IDS.includes(OCT6_TEST_EXPENSE_ID))
    assert.equal(isExcludedRequest(OCT6_TEST_EXPENSE_ID), true)
    assert.equal(isExcludedRequest("f26c3adb-ac52-4a65-b018-48ed7f2b55df"), false)
  } finally {
    if (previous === undefined) delete process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
    else process.env.WORKFLOW_EXCLUDED_REQUEST_IDS = previous
  }
})

test("environment IDs are still excluded alongside the built-in list", () => {
  const previous = process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
  try {
    process.env.WORKFLOW_EXCLUDED_REQUEST_IDS =
      " e6e42ae8-9f5e-416d-986e-1bf105f4a222 , extra-id "
    assert.equal(isExcludedRequest(OCT6_TEST_EXPENSE_ID), true)
    assert.equal(
      isExcludedRequest("e6e42ae8-9f5e-416d-986e-1bf105f4a222"),
      true
    )
    assert.equal(isExcludedRequest("extra-id"), true)
    assert.equal(isExcludedRequest("not-excluded"), false)
  } finally {
    if (previous === undefined) delete process.env.WORKFLOW_EXCLUDED_REQUEST_IDS
    else process.env.WORKFLOW_EXCLUDED_REQUEST_IDS = previous
  }
})
