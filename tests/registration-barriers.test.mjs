import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as registration from '../src/lib/constants/registration.ts'

function mockedSignUp() {
  let clientCalls = 0
  let payload
  const mockModule = { exports: {} }
  const source = readFileSync(new URL('../src/lib/auth/actions.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const require = (path) => {
    if (path === '@/lib/constants/registration') return registration
    if (path === '@/lib/auth/redirect') return { isSafeRedirectPath: () => false }
    if (path === '@/lib/supabase/server') return { createClient: async () => {
      clientCalls++
      return { auth: { signUp: async (value) => {
        payload = value
        return { data: {}, error: { message: 'isolated fixture stop' } }
      } } }
    } }
    return {}
  }
  new Function('require', 'module', 'exports', compiled)(require, mockModule, mockModule.exports)
  return { signUp: mockModule.exports.signUp, calls: () => clientCalls, payload: () => payload }
}
const base = { persona: 'Professional in another field', referral_source: 'Social Media', email: 'fixture@example.invalid', password: 'fixture-only-password' }

test('applicable registration statuses require a nonblank choice before any auth side effects', async () => {
  for (const status of registration.FIELD_STATUS_OPTIONS.slice(1)) {
    for (const barriers of [[], ['  '], null, 'not an array']) {
      const fixture = mockedSignUp()
      assert.deepEqual(await fixture.signUp({ ...base, psychedelic_field_status: status, psychedelic_field_barriers: barriers }), { error: 'Please select at least one reason.' })
      assert.equal(fixture.calls(), 0)
    }
  }
})
test('Yes submission succeeds without barriers and strips stale hidden data', async () => {
  const fixture = mockedSignUp()
  await fixture.signUp({ ...base, psychedelic_field_status: registration.FIELD_STATUS_OPTIONS[0], psychedelic_field_barriers: ['Other', 'stale hidden text'] })
  assert.equal(fixture.calls(), 1)
  assert.deepEqual(fixture.payload().options.data.psychedelic_field_barriers, [])
})
test('new choice is immediately above Other and persists unchanged through the server action', async () => {
  const choice = "I'm not interested in the field"
  assert.deepEqual(registration.BARRIER_OPTIONS.slice(-2), [choice, 'Other'])
  const fixture = mockedSignUp()
  await fixture.signUp({ ...base, psychedelic_field_status: registration.FIELD_STATUS_OPTIONS[1], psychedelic_field_barriers: [choice] })
  assert.deepEqual(fixture.payload().options.data.psychedelic_field_barriers, [choice])
  assert.equal(registration.canonicalPsychedelicFieldBarrier(choice), choice)
})
test('invalid field statuses fail before auth', async () => {
  const fixture = mockedSignUp()
  assert.deepEqual(await fixture.signUp({ ...base, psychedelic_field_status: '', psychedelic_field_barriers: [] }), { error: 'Please select your field status.' })
  assert.equal(fixture.calls(), 0)
})
