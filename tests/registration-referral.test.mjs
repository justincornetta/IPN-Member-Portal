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

const base = {
  persona: 'Professional in another field',
  referral_source: 'Social Media',
  email: 'fixture@example.invalid',
  password: 'fixture-only-password',
  psychedelic_field_status: registration.FIELD_STATUS_OPTIONS[0],
  psychedelic_field_barriers: [],
}

test('event, organization, and other referral sources require a follow-up detail before auth', async () => {
  for (const source of registration.REFERRAL_SOURCES_WITH_DETAIL) {
    for (const other of [null, '', '   ']) {
      const fixture = mockedSignUp()
      assert.deepEqual(await fixture.signUp({
        ...base,
        referral_source: source,
        referral_source_other: other,
      }), { error: 'Please tell us how you heard about IPN.' })
      assert.equal(fixture.calls(), 0)
    }
  }
})

test('event and organization referral details are saved on the existing other field', async () => {
  const cases = [
    ['Event / Conference', 'MAPS 2026'],
    ['Academic / Professional Organization', 'NYU Psychedelic Club'],
    ['Other', 'A podcast'],
  ]
  for (const [source, detail] of cases) {
    const fixture = mockedSignUp()
    await fixture.signUp({
      ...base,
      referral_source: source,
      referral_source_other: `  ${detail}  `,
    })
    assert.equal(fixture.calls(), 1)
    assert.equal(fixture.payload().options.data.referral_source, source)
    assert.equal(fixture.payload().options.data.referral_source_other, detail)
  }
})

test('non-detail referral sources do not persist leftover other text', async () => {
  const fixture = mockedSignUp()
  await fixture.signUp({
    ...base,
    referral_source: 'Social Media',
    referral_source_other: 'leftover',
  })
  assert.equal(fixture.calls(), 1)
  assert.equal(fixture.payload().options.data.referral_source_other, null)
})

test('signup form shows a follow-up text box for event and organization referrals', () => {
  const form = readFileSync(new URL('../src/app/register/RegistrationForm.tsx', import.meta.url), 'utf8')
  assert.match(form, /referralSourceNeedsDetail\(data\.referral_source\)/)
  assert.match(form, /referralSourceDetailLabel\(data\.referral_source\)/)
  assert.match(form, /referralSourceDetailPlaceholder\(data\.referral_source\)/)
  assert.match(form, /referral_source_other: referralSourceNeedsDetail\(data\.referral_source\)/)
})

test('referral detail helpers keep Other labels and mark the new sources', () => {
  assert.equal(registration.referralSourceNeedsDetail('Event / Conference'), true)
  assert.equal(registration.referralSourceNeedsDetail('Academic / Professional Organization'), true)
  assert.equal(registration.referralSourceNeedsDetail('Other'), true)
  assert.equal(registration.referralSourceNeedsDetail('Social Media'), false)
  assert.equal(registration.referralSourceDetailLabel('Event / Conference'), 'Which event or conference?')
  assert.equal(registration.referralSourceDetailPlaceholder('Event / Conference'), 'Event or conference name')
  assert.equal(registration.referralSourceDetailLabel('Academic / Professional Organization'), 'Which organization referred you?')
  assert.equal(registration.referralSourceDetailPlaceholder('Academic / Professional Organization'), 'Organization name')
  assert.equal(registration.referralSourceDetailLabel('Other'), 'Please tell us more')
  assert.equal(registration.referralSourceDetailPlaceholder('Other'), 'How did you hear about IPN?')
})
